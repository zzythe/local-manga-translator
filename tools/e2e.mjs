// End-to-end test of dist/chrome in Microsoft Edge against the local Ollama.
//   node tools/e2e.mjs            (Ollama must be running with a qwen3-vl model)
// Edge runs headless, nothing on screen; --headed shows its window.
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
// refuses requests without the reader page as referrer and sends no CORS headers. Each address
// has its own image. The site is also reached as a.mlt.localhost and b.mlt.localhost (two
// subdomains of one site).
const pageLog = [];
const site = createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  pageLog.push({url: req.url, referer: req.headers.referer || ''});
  const sub = (req.headers.host || '').split('.')[0].replace(/\W/g, '');
  // /strip: two images stacked edge to edge, like a long-strip reader.
  const images = req.url.startsWith('/strip') ? ['strip-a.jpg', 'strip-b.jpg'] : [`page-${sub}${req.url.replace(/\W/g, '-')}.jpg`];
  // /reader/N: one page per address, with a link to the next page (and one to the next chapter).
  const n = +(/^\/reader\/(\d+)$/.exec(req.url)?.[1] || 0);
  const nav = n ? `<nav style="text-align:center"><a href="/reader-2/1" style="color:#fff">Next chapter</a> · <a href="/reader/${n + 1}" style="color:#fff">Next ›</a></nav>` : '';
  res.end(`<!doctype html><title>Reader</title><body style="margin:0;background:#111"><main>
    ${images.map(i => `<img src="http://localhost:8766/${i}" style="display:block;width:900px;margin:0 auto">`).join('')}</main>${nav}</body>`);
}).listen(8765);
let refererSeen = '';
const imageLog = [];
const images = createServer((req, res) => {
  refererSeen = req.headers.referer || '';
  imageLog.push({url: req.url, referer: refererSeen});
  if (!/^http:\/\/(127\.0\.0\.1|[a-z]+\.mlt\.localhost):8765\//.test(refererSeen)) { res.statusCode = 403; return res.end('hotlinking not allowed'); }
  res.setHeader('content-type', 'image/jpeg');
  res.end(readFileSync(join(root, 'extension/demo/ja_E36P03.jpg')));
}).listen(8766);
const translated = (page, timeout = 300000) => page.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout}).then(() => true, () => false);
const used = async () => (await sw.evaluate(() => plan())).used;
const tabOf = url => sw.evaluate(async url => (await chrome.tabs.query({url}))[0]?.id, url);
const control = page => page.evaluate(() => !!document.querySelector('manga-translator'));
// On websites the control's shadow root is closed (the translator runs in the extension's own
// world, which the test's open-root patch doesn't reach); the DevTools protocol can still reach
// it. fn gets the shadow root.
async function inControl(page, fn) {
  const cdp = await ctx.newCDPSession(page);
  try {
    const {root} = await cdp.send('DOM.getDocument', {depth: -1, pierce: true});
    const find = n => n.localName === 'manga-translator' ? n : (n.children || []).map(find).find(Boolean);
    const shadow = find(root)?.shadowRoots?.[0];
    if (!shadow) throw new Error('translator control not found');
    const {object} = await cdp.send('DOM.resolveNode', {backendNodeId: shadow.backendNodeId});
    const {result, exceptionDetails} = await cdp.send('Runtime.callFunctionOn', {objectId: object.objectId,
      functionDeclaration: `function () { return (${fn})(this); }`, returnByValue: true, awaitPromise: true});
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  } finally { await cdp.detach().catch(() => {}); }
}

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mlt-')), {
  channel: 'msedge', headless: !process.argv.includes('--headed'), viewport: {width: 1280, height: 900},
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
    check('setup page shows the free meter', /50 of 50 free pages left today/.test(meter), meter);
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
  check('sample pages are free', plan.used === 0, JSON.stringify(plan));

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
  // Finished pages were kept in the site's IndexedDB by older versions: removed.
  await reader.evaluate(() => new Promise(resolve => { const r = indexedDB.open('manga-translator'); r.onsuccess = () => { r.result.close(); resolve(); }; }));
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://127.0.0.1:8765/*'}); await openOn(tab); });
  await reader.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout: 300000});
  check('hotlink-protected cross-origin image translated', true, `referer sent: ${refererSeen}`);
  await reader.screenshot({path: join(out, 'reader.png')});
  await reader.waitForTimeout(500);
  plan = await sw.evaluate(() => plan());
  check('meter counted 1 page', plan.used === 1, JSON.stringify(plan));
  const meterText = await reader.evaluate(() => document.querySelector('manga-translator') ? 'present' : 'missing');
  check('translator control present on the site', meterText === 'present');
  const databases = await reader.evaluate(async () => (await indexedDB.databases()).map(d => d.name));
  check('old page store in the site removed, nothing stored there', !databases.includes('manga-translator'), JSON.stringify(databases));
  const {usage} = await sw.evaluate(() => chrome.storage.local.get('usage'));
  check('pages seen today kept as salted hashes', usage.seen.length === 1 && /^[0-9a-f]{24}$/.test(usage.seen[0]) && /^[0-9a-f]{32}$/.test(usage.salt),
    JSON.stringify(usage));

  // 4. Reloading the tab shows the translated page again from memory, without counting it.
  let t2 = Date.now();
  await reader.reload();
  await reader.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout: 60000});
  const reloadTime = (Date.now() - t2) / 1000;
  await reader.waitForTimeout(500);
  plan = await sw.evaluate(() => plan());
  check('reload keeps the translation on, shown from memory and free', plan.used === 1 && reloadTime < 8, `${reloadTime.toFixed(1)} s, ${JSON.stringify(plan)}`);

  // 4b. Images of a long strip count as half a page each, and only once they are on screen.
  const strip = await ctx.newPage();
  await strip.goto('http://127.0.0.1:8765/strip');
  await strip.waitForTimeout(3000);
  await strip.waitForFunction(() => [...document.images].every(i => i.src.startsWith('blob:')), null, {timeout: 300000});
  await strip.waitForTimeout(1000);
  plan = await sw.evaluate(() => plan());
  check('site stays on in a new tab; strip image below the screen translated ahead but not counted', plan.used === 1.5, JSON.stringify(plan));
  await strip.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await strip.waitForTimeout(1500);
  plan = await sw.evaluate(() => plan());
  check('strip image counted (half a page) once scrolled to', plan.used === 2, JSON.stringify(plan));
  await strip.close();

  // 4c. Moving to another page of the site keeps the translator on.
  await reader.bringToFront();
  await reader.goto('http://127.0.0.1:8765/chapter-3');
  check('next page of the site (full navigation) translated', await translated(reader));
  // 4d. Readers that swap the picture without loading a new page.
  const firstSwap = await reader.evaluate(() => document.images[0].src);
  await reader.evaluate(() => { history.pushState({}, '', '/chapter-4'); document.images[0].src = 'http://localhost:8766/page-127-chapter-4.jpg'; });
  const swapped = await reader.waitForFunction(old => document.images[0].src.startsWith('blob:') && document.images[0].src !== old, firstSwap, {timeout: 300000}).then(() => true, () => false);
  check('picture swapped by the site (pushState) translated', swapped && imageLog.some(l => l.url === '/page-127-chapter-4.jpg'));
  await reader.waitForTimeout(1000);
  check('each page counted once', await used() === 4, String(await used()));

  // 4e. The next chapter on another subdomain of the site, and in a new tab.
  const sub = await ctx.newPage();
  await sub.goto('http://a.mlt.localhost:8765/chapter-5');
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://a.mlt.localhost:8765/*'}); await openOn(tab); });
  check('subdomain site translated', await translated(sub));
  await sub.goto('http://b.mlt.localhost:8765/chapter-6');
  check('next chapter on another subdomain stays on', await translated(sub));
  const subTab = await ctx.newPage();
  await subTab.goto('http://a.mlt.localhost:8765/chapter-7');
  check('chapter opened in a new tab stays on', await translated(subTab));
  // "Translate <site> automatically" is for the whole site.
  const always = await inControl(subTab, root => {
    root.getElementById('gear').click();
    const box = root.getElementById('always'); box.click();
    return root.getElementById('always-label').textContent;
  });
  await subTab.waitForTimeout(500);
  let stored = (await sw.evaluate(() => chrome.storage.local.get('settings'))).settings.sites;
  await inControl(subTab, root => root.getElementById('always').click());
  await subTab.waitForTimeout(500);
  const cleared = (await sw.evaluate(() => chrome.storage.local.get('settings'))).settings.sites;
  check('"automatically" is kept for the site', always === 'Translate mlt.localhost automatically' && stored.includes('mlt.localhost') && !cleared.includes('mlt.localhost'),
    JSON.stringify({always, stored, cleared}));
  // The X turns it off for the site, in new tabs too, until it is turned on again.
  await inControl(subTab, root => root.getElementById('close').click());
  await subTab.close(); await sub.close();
  const offTab = await ctx.newPage();
  await offTab.goto('http://b.mlt.localhost:8765/chapter-8');
  await offTab.waitForTimeout(4000);
  check('closed with the X: off for the site', !(await control(offTab)) && !(await offTab.evaluate(() => document.images[0].src.startsWith('blob:'))));
  await offTab.close();

  // 4f. A reader with one page per address: the next page is translated ahead, shown at once
  // when the reader moves on, and counted only then.
  const before4f = await used();
  const paged = await ctx.newPage();
  await paged.goto('http://127.0.0.1:8765/reader/1');
  check('page 1 of a page-per-address reader translated', await translated(paged));
  const pagedTab = await tabOf('http://127.0.0.1:8765/reader/*');
  const ahead = await (async () => {
    for (const end = Date.now() + 300000; Date.now() < end; await paged.waitForTimeout(500)) {
      if ((await sw.evaluate(tab => toDetector({type: 'page-count', tab}), pagedTab))?.count >= 2) return true;
    }
    return false;
  })();
  const fetched = pageLog.find(l => l.url === '/reader/2');
  check('next page translated ahead (its address fetched with this page as referrer)', ahead && fetched?.referer === 'http://127.0.0.1:8765/reader/1' &&
    !pageLog.some(l => l.url === '/reader-2/1'), JSON.stringify(fetched));
  await paged.waitForTimeout(1000);
  check('page read ahead not counted yet', await used() === before4f + 1, `${await used()} (was ${before4f})`);
  t2 = Date.now();
  await paged.getByText('Next ›').click();
  const shownAhead = await translated(paged, 60000);
  const aheadTime = (Date.now() - t2) / 1000;
  await paged.waitForTimeout(1000);
  check('next page shown translated at once after clicking Next, counted once shown', shownAhead && aheadTime < 6 && await used() === before4f + 2,
    `${aheadTime.toFixed(1)} s, used ${await used()}`);
  await paged.screenshot({path: join(out, 'read-ahead.png')});

  // 4g. Save image, beside the page's mark.
  const download = paged.waitForEvent('download', {timeout: 10000}).catch(() => null);
  const saveLabel = await inControl(paged, root => { const b = root.querySelector('.markbox .save'); b.click(); return b.textContent; });
  const file = await download;
  check('Save image downloads the translated page', saveLabel === 'Save image' && /^page-127-+reader-2-translated\.(png|jpg)$/.test(file?.suggestedFilename() || ''),
    file?.suggestedFilename() || 'no download');
  await paged.close();

  // 5. At the daily limit, new pages wait and the control says why.
  await sw.evaluate(async () => {
    const d = new Date(), day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const {usage} = await chrome.storage.local.get('usage');
    await chrome.storage.local.set({usage: {...usage, day, count: CONFIG.freePagesPerDay}});
  });
  const limited = await ctx.newPage();
  await limited.goto('http://127.0.0.1:8765/chapter-2');
  // Same tab session flag isn't set in a new tab, so open it like the toolbar button.
  await sw.evaluate(async () => { const [tab] = await chrome.tabs.query({url: 'http://127.0.0.1:8765/chapter-2'}); await openOn(tab); });
  await limited.waitForTimeout(6000);
  const blockedState = await limited.evaluate(() => ({src: document.images[0].src}));
  check('limit reached: page left untranslated', !blockedState.src.startsWith('blob:'), blockedState.src.slice(0, 40));
  await limited.screenshot({path: join(out, 'limit.png')});

  // 5b. Names entered on the sample page belong to it alone. Changing them translates its pages
  // again, shown bubble by bubble in the page beside each image. The sample page is free, so this
  // works at the limit too.
  await demo.bringToFront();
  const before = await demo.evaluate(() => [...document.images].map(i => i.src));
  await demo.evaluate(() => {
    const root = document.querySelector('manga-translator').shadowRoot, terms = root.getElementById('terms');
    root.getElementById('names').open = true;
    terms.value = 'テスト = Test';
    terms.dispatchEvent(new Event('change'));
  });
  await demo.waitForTimeout(300);
  ({settings} = await sw.evaluate(() => chrome.storage.local.get('settings')));
  check('names are kept for this site only', JSON.stringify(settings.names) === JSON.stringify({[id]: 'テスト = Test'}), JSON.stringify(settings.names));
  const early = await demo.waitForFunction(() => {
    const b = document.querySelector('manga-translator-bubbles');
    return b && [...document.images].some(i => i.parentNode === b.parentNode) && getComputedStyle(b).position === 'absolute';
  }, null, {timeout: 300000, polling: 50}).then(() => true, () => false);
  check('bubbles shown early, in the page beside the image', early);
  const again = await demo.waitForFunction(old => [...document.images].every((i, k) => i.src.startsWith('blob:') && i.src !== old[k]) &&
    !document.querySelector('manga-translator-bubbles'), before, {timeout: 300000}).then(() => true, () => false);
  plan = await sw.evaluate(() => plan());
  check('sample page translated again at the limit with other names, not counted', again && plan.used === plan.limit, JSON.stringify(plan));
  // A web page translated again the same day (other names, a reload, another tab) is counted once.
  const twice = await sw.evaluate(async () => [(await recordPage({url: 'http://e2e/page.jpg'})).used, (await recordPage({url: 'http://e2e/page.jpg'})).used]);
  check('a page translated again the same day counts once', twice[1] === twice[0], JSON.stringify(twice));

  // 6. Pro unlocks it straight away.
  await sw.evaluate(() => chrome.storage.local.set({pro: {paid: true, checked: Date.now()}}));
  await limited.waitForFunction(() => document.images[0]?.src.startsWith('blob:'), null, {timeout: 300000}).then(
    () => check('Pro unlocks the waiting page', true), () => check('Pro unlocks the waiting page', false));

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
