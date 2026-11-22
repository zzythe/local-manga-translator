// End-to-end test of dist/chrome in Microsoft Edge against the local Ollama.
//   node tools/e2e.mjs            (Ollama must be running with a qwen3-vl model)
// Screenshots go to tools/e2e-out/.
import {chromium} from 'playwright-core';
import {mkdtempSync, mkdirSync, readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root = process.cwd();
const ext = join(root, 'dist/chrome');
const out = join(root, 'tools/e2e-out');
mkdirSync(out, {recursive: true});
const results = [];
const check = (name, ok, detail = '') => { results.push({name, ok, detail}); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); };

// A "manga site" on :8765 whose images live on another origin (:8766). The image server
// refuses requests without the reader page as referrer and sends no CORS headers.
const site = createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  // /strip: two images stacked edge to edge, like a long-strip reader.
  const images = req.url.startsWith('/strip') ? ['strip-a.jpg', 'strip-b.jpg'] : ['page.jpg'];
  res.end(`<!doctype html><title>Reader</title><body style="margin:0;background:#111">
    ${images.map(i => `<img src="http://localhost:8766/${i}" style="display:block;width:900px;margin:0 auto">`).join('')}</body>`);
}).listen(8765);
let refererSeen = '';
const images = createServer((req, res) => {
  refererSeen = req.headers.referer || '';
  if (!refererSeen.startsWith('http://127.0.0.1:8765/')) { res.statusCode = 403; return res.end('hotlinking not allowed'); }
  res.setHeader('content-type', 'image/jpeg');
  res.end(readFileSync(join(root, 'extension/demo/ja_E36P03.jpg')));
}).listen(8766);

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mlt-')), {
  channel: 'msedge', headless: false, viewport: {width: 1280, height: 900},
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
// The control is in a closed shadow root; open ones let the test read it on the sample page,
// where the translator runs in the page itself.
await ctx.addInitScript(() => {
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) { return attach.call(this, {...options, mode: 'open'}); };
});

try {
  // 1. Setup page opens on install and detects Ollama + model.
  let welcome = ctx.pages().find(p => p.url().includes('welcome.html'));
  if (!welcome) welcome = await ctx.waitForEvent('page', {predicate: p => p.url().includes('welcome.html'), timeout: 10000}).catch(() => null);
  check('setup page opens on install', !!welcome);
  if (welcome) {
    await welcome.waitForFunction(() => document.getElementById('step-model').dataset.state === 'done', null, {timeout: 20000}).catch(() => {});
    const states = await welcome.evaluate(() => ['step-engine', 'step-model', 'step-try'].map(id => document.getElementById(id).dataset.state));
    check('setup page detects Ollama and the model', states[0] === 'done' && states[1] === 'done', states.join(','));
    const meter = await welcome.locator('.meter-line').innerText();
    check('setup page shows the free meter', /30 of 30 free pages left today/.test(meter), meter);
    await welcome.screenshot({path: join(out, 'welcome.png'), fullPage: true});
  }

  // The setup page fetches the text detector; wait for it so the sample pages use it.
  const t1 = Date.now();
  const prepared = await sw.evaluate(() => toDetector({type: 'prepare'}));
  const stats0 = await sw.evaluate(() => toDetector({type: 'stats'}));
  check('helper models downloaded and loaded', prepared?.ready === true,
    `${((Date.now() - t1) / 1000).toFixed(0)} s, ${stats0?.threads} threads${prepared?.error ? ', ' + prepared.error : ''}`);

  // Settings as an older version stored them: names for every site, and the helper models off.
  const oldNames = 'テスト = Test\nサンプル = Sample';
  await sw.evaluate(terms => chrome.storage.local.set({settings: {terms, detector: false}}), oldNames);

  // 2. The sample page translates both pages.
  const demo = await ctx.newPage();
  const t0 = Date.now();
  await demo.goto(`chrome-extension://${id}/demo.html`);
  await demo.waitForFunction(() => [...document.querySelectorAll('.reader img')].filter(i => i.src.startsWith('blob:')).length >= 1, null, {timeout: 300000});
  check('sample page 1 translated', true, `${((Date.now() - t0) / 1000).toFixed(0)} s including model load`);
  await demo.screenshot({path: join(out, 'demo-first.png')});
  await demo.waitForFunction(() => [...document.querySelectorAll('.reader img')].filter(i => i.src.startsWith('blob:')).length >= 2, null, {timeout: 300000});
  check('sample page 2 translated', true, `${((Date.now() - t0) / 1000).toFixed(0)} s total`);
  await demo.locator('.reader img').first().screenshot({path: join(out, 'demo-page1-translated.png')});
  await demo.locator('.reader img').nth(1).screenshot({path: join(out, 'demo-page2-translated.png')});
  const stats = await sw.evaluate(() => toDetector({type: 'stats'}));
  check('sample pages used the text detector', stats?.runs >= 2, JSON.stringify(stats));
  // Page 2 has a sound effect on the artwork (シュウウ…).
  check('sound effect repainted by the inpainting model', stats?.repaints >= 1, JSON.stringify(stats));
  let plan = await sw.evaluate(() => plan());
  check('meter counted 2 pages', plan.used === 2, JSON.stringify(plan));

  // 2b. The settings panel.
  let {settings} = await sw.evaluate(() => chrome.storage.local.get('settings'));
  check('old names moved to this site, old settings removed', settings.names?.[id] === oldNames &&
    !('terms' in settings) && !('detector' in settings), JSON.stringify(settings));
  const panel = () => demo.evaluate(() => {
    const root = document.querySelector('manga-translator').shadowRoot, $ = s => root.querySelector(s);
    const shown = s => !!$(s) && $(s).checkVisibility();
    return {language: navigator.language, into: $('#target').value, auto: $('#always-label').textContent, moreOpen: $('#more').open,
      visible: ['#target', '#always', '#source', '#model', '#font', '#uppercase', '#terms'].filter(shown), detector: !!$('#detector'),
      models: $('#model').options.length, modelRow: !$('#model-row').hidden, font: $('#font').options[0].textContent,
      capitals: $('#uppercase').parentElement.textContent.trim(), names: $('#names-label').textContent,
      labelFont: getComputedStyle($('#always-label')).fontFamily, titleFont: getComputedStyle($('#title')).fontFamily};
  });
  await demo.evaluate(() => document.querySelector('manga-translator').shadowRoot.getElementById('gear').click());
  let p = await panel();
  check('panel: Into from the browser language, no site setting on the sample page, the rest under More', p.into === 'English' && /^en(-|$)/.test(p.language) &&
    p.auto === `Translate ${id} automatically` && !p.moreOpen && p.visible.join() === '#target' && !p.detector, JSON.stringify(p));
  check('panel labels in the system font, title in Comic Neue', !/MangaLettering/.test(p.labelFont) && /^system-ui/.test(p.labelFont) &&
    /^MangaTranslatorUI/.test(p.titleFont), `${p.labelFont} | ${p.titleFont}`);
  await demo.evaluate(() => document.querySelector('manga-translator').shadowRoot.querySelector('#more > summary').click());
  await demo.waitForTimeout(300);
  p = await panel();
  check('More: From, Model only with two or more models, Font, All capitals, Names with a count',
    p.moreOpen && p.visible.includes('#source') && p.visible.includes('#font') && p.visible.includes('#uppercase') && !p.visible.includes('#terms') &&
    p.modelRow === (p.models >= 2) && p.font === 'Automatic' && p.capitals === 'All capitals' && p.names === 'Names (2)', JSON.stringify(p));
  ({settings} = await sw.evaluate(() => chrome.storage.local.get('settings')));
  await demo.reload();
  await demo.waitForFunction(() => document.querySelector('manga-translator')?.shadowRoot?.getElementById('more'));
  await demo.evaluate(() => document.querySelector('manga-translator').shadowRoot.getElementById('gear').click());
  p = await panel();
  check('More stays open after a reload', settings.more === true && p.moreOpen, JSON.stringify({stored: settings.more, open: p.moreOpen}));

  // 3. A site with hotlink-protected images on another origin, opened like the toolbar button does.
  const reader = await ctx.newPage();
  await reader.goto('http://127.0.0.1:8765/chapter-1');
  await reader.bringToFront();
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://127.0.0.1:8765/*'}); await openOn(tab); });
  await reader.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout: 300000});
  check('hotlink-protected cross-origin image translated', true, `referer sent: ${refererSeen}`);
  await reader.screenshot({path: join(out, 'reader.png')});
  plan = await sw.evaluate(() => plan());
  check('meter counted 3 pages', plan.used === 3, JSON.stringify(plan));
  const meterText = await reader.evaluate(() => document.querySelector('manga-translator') ? 'present' : 'missing');
  check('translator control present on the site', meterText === 'present');

  // 4. Reloading the tab shows the translated page again without counting it.
  await reader.reload();
  await reader.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout: 60000});
  plan = await sw.evaluate(() => plan());
  check('reload keeps the translation on and free', plan.used === 3, JSON.stringify(plan));

  // 4b. Images of a long strip count as half a page each.
  const strip = await ctx.newPage();
  await strip.goto('http://127.0.0.1:8765/strip');
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://127.0.0.1:8765/strip'}); await openOn(tab); });
  await strip.waitForFunction(() => [...document.images].every(i => i.src.startsWith('blob:')), null, {timeout: 300000});
  await strip.waitForTimeout(500);
  plan = await sw.evaluate(() => plan());
  check('strip images count as half a page', plan.used === 4, JSON.stringify(plan));
  await strip.close();

  // 5. At the daily limit, new pages wait and the control says why.
  await sw.evaluate(async () => {
    const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await chrome.storage.local.set({usage: {day, count: CONFIG.freePagesPerDay}});
  });
  const limited = await ctx.newPage();
  await limited.goto('http://127.0.0.1:8765/chapter-2');
  // Same tab session flag isn't set in a new tab, so open it like the toolbar button.
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://127.0.0.1:8765/chapter-2'}); await openOn(tab); });
  await limited.waitForTimeout(6000);
  const blockedState = await limited.evaluate(() => ({src: document.images[0].src}));
  check('limit reached: page left untranslated', !blockedState.src.startsWith('blob:'), blockedState.src.slice(0, 40));
  await limited.screenshot({path: join(out, 'limit.png')});

  // 6. Pro unlocks it straight away.
  await sw.evaluate(() => chrome.storage.local.set({pro: {paid: true, checked: Date.now()}}));
  await limited.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout: 300000}).then(
    () => check('Pro unlocks the waiting page', true), () => check('Pro unlocks the waiting page', false));

  // 6b. Names entered on the sample page belong to it alone. (Changing them translates its pages
  // again, so this comes after Pro.)
  await demo.bringToFront();
  await demo.evaluate(() => {
    const root = document.querySelector('manga-translator').shadowRoot, terms = root.getElementById('terms');
    root.getElementById('names').open = true;
    terms.value = 'テスト = Test';
    terms.dispatchEvent(new Event('change'));
  });
  await demo.waitForTimeout(300);
  ({settings} = await sw.evaluate(() => chrome.storage.local.get('settings')));
  check('names are kept for this site only', JSON.stringify(settings.names) === JSON.stringify({[id]: 'テスト = Test'}), JSON.stringify(settings.names));

  // 7. Websites still can't use Ollama directly (the origin rule only covers the extension).
  // Use an ordinary website origin: Ollama always trusts pages served from 127.0.0.1 itself.
  await ctx.route('http://manga.example/**', route => route.fulfill({contentType: 'text/html', body: '<title>x</title>'}));
  const outside = await ctx.newPage();
  await outside.goto('http://manga.example/');
  const status = await outside.evaluate(() => fetch('http://127.0.0.1:11434/api/tags').then(r => r.status, e => 'blocked: ' + e.message));
  check('web pages still refused by Ollama', status !== 200, String(status));
} catch (error) {
  check('run completed', false, error.message);
} finally {
  await ctx.close(); site.close(); images.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
