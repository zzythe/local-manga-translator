// Renders extension/icons/icon.svg to PNGs with the installed Microsoft Edge.
//   node tools/render-icons.mjs
import {chromium} from 'playwright-core';
import {readFileSync, writeFileSync} from 'node:fs';
const big = readFileSync(new URL('../extension/icons/icon.svg', import.meta.url), 'utf8');
const small = readFileSync(new URL('../extension/icons/icon-small.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({channel: 'msedge'});
const page = await browser.newPage();
for (const size of [16, 32, 48, 128, 512]) {
  const svg = size === 16 ? small : big;
  await page.setViewportSize({width: size, height: size});
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  const png = await page.screenshot({omitBackground: true});
  writeFileSync(new URL(`../extension/icons/icon${size}.png`, import.meta.url), png);
}
await browser.close();
console.log('icons written');
