// Setup-page test: Ollama missing, then a model download with progress.
//   node tools/e2e-setup.mjs before|download
import {chromium} from 'playwright-core';
import {mkdtempSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const ext = join(process.cwd(), 'dist/chrome'), out = join(process.cwd(), 'tools/e2e-out');
mkdirSync(out, {recursive: true});
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mlt-')), {
  channel: 'msedge', headless: !process.argv.includes('--headed'), viewport: {width: 1100, height: 900},
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
});
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const page = ctx.pages().find(p => p.url().includes('welcome.html')) || await ctx.waitForEvent('page', {predicate: p => p.url().includes('welcome.html')});
await page.waitForTimeout(3500);
if (process.argv[2] === 'before') {
  const s = await page.evaluate(() => ({engine: document.getElementById('step-engine').dataset.state, model: document.getElementById('step-model').dataset.state,
    link: document.getElementById('engine-download').href, label: document.getElementById('engine-download').textContent, pill: document.getElementById('engine-pill').textContent}));
  console.log(JSON.stringify(s));
  await page.screenshot({path: join(out, 'welcome-no-ollama.png')});
} else {
  if (await page.locator('#model-change').isVisible()) await page.click('#model-change');
  // Swap the first choice for a tiny model so the test downloads ~100 MB, not 3 GB.
  await page.evaluate(() => { const r = document.querySelector('input[name="model"]'); r.value = 'smollm:135m'; r.checked = true; });
  await page.click('#model-download');
  const seen = [];
  for (let i = 0; i < 240; i++) {
    const s = await page.evaluate(() => ({status: document.getElementById('model-status').textContent, fill: document.getElementById('model-fill').style.width,
      error: document.getElementById('model-error').hidden ? '' : document.getElementById('model-error').textContent, pill: document.getElementById('model-pill').textContent}));
    if (!seen.length || seen.at(-1).status !== s.status) seen.push(s);
    if (i === 6) await page.screenshot({path: join(out, 'welcome-downloading.png')});
    if (s.error || (s.fill === '100.0%' && s.pill !== 'Downloading…')) break;
    await page.waitForTimeout(500);
  }
  console.log(seen.slice(0, 4).concat(seen.slice(-3)).map(s => JSON.stringify(s)).join('\n'));
  const settings = await sw.evaluate(() => chrome.storage.local.get('settings'));
  console.log('saved model:', settings.settings?.model);
}
await ctx.close();
