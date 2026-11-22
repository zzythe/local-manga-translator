// Translates the bundled sample pages in Edge and saves the results to store/raw/.
import {chromium} from 'playwright-core';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const ext = join(process.cwd(), 'dist/chrome');
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mlt-')), {
  channel: 'msedge', headless: false, viewport: {width: 1280, height: 900},
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
});
let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/demo.html`);
await page.waitForFunction(() => [...document.querySelectorAll('.reader img')].every(i => i.src.startsWith('blob:') && i.complete), null, {timeout: 600000});
const images = await page.evaluate(async () => Promise.all([...document.querySelectorAll('.reader img')].map(async img => {
  const blob = await (await fetch(img.src)).blob();
  return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
})));
images.forEach((d, i) => writeFileSync(`store/raw/en_P0${i + 1}.${d.startsWith('data:image/png') ? 'png' : 'jpg'}`, Buffer.from(d.split(',')[1], 'base64')));
console.log('saved', images.length);
await ctx.close();
