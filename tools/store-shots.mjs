// Live store screenshots: dist/chrome in Edge, translating the sample pages on a plain reader page
// through the local Ollama. Saves 1280×800 captures to store/raw/ for tools/store-images.mjs.
//   node build.mjs && node tools/store-shots.mjs      (Ollama must be running with a qwen3-vl model)
import {chromium} from 'playwright-core';
import {mkdtempSync, mkdirSync, readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {bundledFontsBuild} from './bundled-fonts.mjs';

const root = process.cwd(), ext = bundledFontsBuild(root), out = join(root, 'store/raw');
mkdirSync(out, {recursive: true});
const pages = ['ja_E35P02.jpg', 'ja_E36P03.jpg'];

const server = createServer((req, res) => {
  const name = req.url.slice(1);
  if (pages.includes(name)) { res.setHeader('content-type', 'image/jpeg'); return res.end(readFileSync(join(root, 'extension/demo', name))); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><title>Chapter 35</title>
    <body style="margin:0;background:#18151c;font:15px system-ui,sans-serif;color:#cfc8d6">
    <div style="text-align:center;padding:14px 0 12px">Chapter 35</div>
    ${pages.map(p => `<img src="/${p}" style="display:block;width:760px;margin:0 auto 14px">`).join('')}</body>`);
}).listen(8770);

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mlt-')), {
  channel: 'msedge', headless: false, viewport: {width: 1280, height: 800},
  // The reader shows as comics.example (the local server) in the translator's site setting.
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--host-resolver-rules=MAP comics.example 127.0.0.1']
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const shot = (p, name) => p.screenshot({path: join(out, name)}).then(() => console.log('saved', name));

try {
  // Setup page, once it has found Ollama and the model.
  let welcome = ctx.pages().find(p => p.url().includes('welcome.html'));
  if (!welcome) welcome = await ctx.waitForEvent('page', {predicate: p => p.url().includes('welcome.html'), timeout: 10000});
  await welcome.waitForFunction(() => document.getElementById('step-model').dataset.state === 'done', null, {timeout: 20000});
  await welcome.waitForTimeout(500);
  await shot(welcome, 'shot-welcome.png');

  // The reader, translated.
  const reader = await ctx.newPage();
  await reader.goto('http://comics.example:8770/');
  await reader.bringToFront();
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://comics.example:8770/*'}); await openOn(tab); });
  await reader.waitForFunction(() => [...document.images].every(i => i.src.startsWith('blob:') && i.complete), null, {timeout: 600000});
  await reader.waitForTimeout(1500);
  await reader.mouse.move(5, 5);
  await shot(reader, 'shot-reader.png');
  await reader.evaluate(() => scrollTo(0, 1090));
  await reader.waitForTimeout(500);
  await shot(reader, 'shot-reader-2.png');

  // The control is in a closed shadow root, so its buttons are clicked by position (bottom right).
  const button = name => reader.mouse.click(1280 - {swap: 186, gear: 106}[name], 800 - 82);
  // Originals shown again with the swap button.
  await reader.evaluate(() => scrollTo(0, 0));
  await button('swap');
  await reader.waitForTimeout(800);
  await reader.mouse.move(5, 5);
  await shot(reader, 'shot-original.png');
  await button('swap');
  await reader.waitForTimeout(800);

  // Settings panel open.
  await button('gear');
  await reader.waitForTimeout(400);
  await reader.mouse.move(5, 5);
  await shot(reader, 'shot-settings.png');
} finally {
  await ctx.close(); server.close();
}
