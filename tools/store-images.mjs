// Store and website images from the captures in store/raw/ (tools/capture-translations.mjs and
// tools/store-shots.mjs). Needs no model.
//   node tools/store-images.mjs
// Writes store/images/screenshot-*.png (1280×800), promo-small.png (440×280),
// promo-marquee.png (1400×560), and docs/img/before.jpg, after.jpg.
import {chromium} from 'playwright-core';
import {copyFileSync, mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const root = process.cwd(), raw = join(root, 'store/raw'), out = join(root, 'store/images');
mkdirSync(out, {recursive: true});
const url = p => pathToFileURL(join(root, p)).href;
const work = mkdtempSync(join(tmpdir(), 'mlt-images-'));

const css = `
  @font-face { font-family: Lettering; src: url(${url('src/fonts/ComicNeue-Bold.ttf')}); font-weight: 700; }
  * { box-sizing: border-box; margin: 0; }
  body { width: var(--w); height: var(--h); overflow: hidden; color: #1c1526; font: 400 17px system-ui, "Segoe UI", sans-serif;
    background: #f6f1ea radial-gradient(rgba(28, 21, 38, .07) 1px, transparent 1.2px) 0 0 / 14px 14px; }
  .brand { display: flex; align-items: center; gap: 12px; font: 700 26px Lettering, sans-serif; }
  .card { position: relative; overflow: hidden; border: 3px solid #1c1526; border-radius: 16px; background: #222;
    box-shadow: 6px 7px 0 rgba(28, 21, 38, .85); }
  .card img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .tag { position: absolute; top: 12px; left: 12px; padding: 2px 12px; border-radius: 999px; background: #fffdfa;
    border: 2px solid #1c1526; font: 700 16px Lettering, sans-serif; }
  .credit { position: absolute; font-size: 12px; color: #6e6378; }`;

// A card showing part of a 1200 px wide page: x, y, width, height in page pixels, scaled to the
// card's width.
const crop = (src, [x, y, w, h], width, label) => {
  const scale = width / w;
  return `<div class="card" style="width:${width}px;height:${Math.round(h * scale)}px">
  <img src="${src}" style="width:${1200 * scale}px;height:auto;max-width:none;object-fit:initial;margin:${-y * scale}px 0 0 ${-x * scale}px">
  ${label ? `<span class="tag">${label}</span>` : ''}</div>`;
};

const before = url('extension/demo/ja_E35P02.jpg'), after = url('store/raw/en_P01.png');
const credit = 'Pages: Pepper&amp;Carrot by David Revoy, CC BY 4.0';
const pages = {
  compare: `<body style="--w:1280px;--h:800px;padding:34px 44px">
    <div class="brand"><img src="${url('extension/icons/icon128.png')}" width="44" height="44">Local Manga Translator</div>
    <div style="display:flex;gap:40px;margin-top:28px">
      ${crop(before, [50, 15, 1100, 1112], 576, 'Original')}
      ${crop(after, [50, 15, 1100, 1112], 576, 'Translated')}
    </div>
    <div class="credit" style="right:44px;bottom:16px">${credit}</div></body>`,
  // One speech bubble before and after, big enough to read at this size.
  promoSmall: `<body style="--w:440px;--h:280px;padding:0 24px;display:flex;flex-direction:column;justify-content:center">
    <div class="brand" style="font-size:24px;gap:10px"><img src="${url('extension/icons/icon128.png')}" width="40" height="40">Local Manga Translator</div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:18px">
      ${crop(before, [705, 1168, 290, 222], 178, '')}
      <div style="font:700 28px Lettering,sans-serif">→</div>
      ${crop(after, [705, 1168, 290, 222], 178, '')}
    </div></body>`,
  promoMarquee: `<body style="--w:1400px;--h:560px;padding:56px 64px;display:flex;gap:48px;align-items:center">
    <div style="flex:1">
      <img src="${url('extension/icons/icon128.png')}" width="96" height="96">
      <div style="font:700 54px/1.1 Lettering,sans-serif;margin:18px 0 14px">Local Manga Translator</div>
      <div style="font-size:24px;color:#6e6378">Translates manga in place, on your own computer.</div>
    </div>
    ${crop(before, [400, 15, 360, 470], 330, 'Original')}
    ${crop(after, [400, 15, 360, 470], 330, 'Translated')}
    <div class="credit" style="right:64px;bottom:14px">${credit}</div></body>`
};

const browser = await chromium.launch({channel: 'msedge'});
const render = async (name, html, w, h) => {
  const file = join(work, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`);
  const page = await browser.newPage({viewport: {width: w, height: h}});
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
  await page.screenshot({path: join(out, name)});
  await page.close();
  console.log('saved', name);
};
await render('screenshot-1.png', pages.compare, 1280, 800);
await render('promo-small.png', pages.promoSmall, 440, 280);
await render('promo-marquee.png', pages.promoMarquee, 1400, 560);

// Live captures from tools/store-shots.mjs are already 1280×800.
[['shot-reader.png', 'screenshot-2.png'], ['shot-settings.png', 'screenshot-3.png'], ['shot-welcome.png', 'screenshot-4.png']]
  .forEach(([from, to]) => { copyFileSync(join(raw, from), join(out, to)); console.log('saved', to); });

// Website before/after: the full first sample page, as JPEG.
const page = await browser.newPage({viewport: {width: 1200, height: 1660}});
for (const [src, name] of [['extension/demo/ja_E35P02.jpg', 'before.jpg'], ['store/raw/en_P01.png', 'after.jpg']]) {
  const file = join(work, 'page.html');
  writeFileSync(file, `<!doctype html><body style="margin:0"><img src="${url(src)}" style="display:block">`);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.images[0].decode());
  await page.screenshot({path: join(root, 'docs/img', name), type: 'jpeg', quality: 86});
  console.log('saved docs/img/' + name);
}
await browser.close();
