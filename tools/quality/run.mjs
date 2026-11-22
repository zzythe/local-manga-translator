// Quality harness: translates every page in tools/quality/pages/ with the real pipeline, in Edge,
// through the local Ollama, and writes for each page:
//   tools/quality/out/<name>.png          the translated page
//   tools/quality/out/<name>-side.png     original | translated, side by side
//   tools/quality/out/<name>.json         what was read, translated and where it was lettered
//     node build.mjs && node tools/quality/run.mjs [name-filter] [--source=Japanese] [--model=qwen3-vl:4b-instruct]
//       [--out=out] [--unload] [--pause=30]   unload the model after each page, wait 30 s between pages
import {chromium} from 'playwright-core';
import {readFileSync, writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {join, dirname, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '../..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const filter = args.find(a => !a.startsWith('--')) || '';
const model = option('model', 'qwen3-vl:4b-instruct'), source = option('source', 'Auto-detect');
const outDir = join(here, option('out', 'out'));
const unload = args.includes('--unload'), pause = Number(option('pause', 0));
mkdirSync(outDir, {recursive: true});

// The built userscript, made to hand its internals to the page instead of starting its UI.
const script = readFileSync(join(root, 'local-manga-translator.user.js'), 'utf8')
  .replace("if (typeof document === 'undefined') {", 'if (true) {')
  .replace(/if \(typeof module !== 'undefined'\) module\.exports =/, 'globalThis.MLT =');
if (!script.includes('globalThis.MLT =')) throw new Error('Could not expose the translator internals.');

const pages = readdirSync(join(here, 'pages')).filter(f => /\.(jpe?g|png|webp)$/i.test(f) && f.includes(filter)).sort();
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1200, height: 900}});
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
await page.route('http://quality.test/**', route => {
  const path = new URL(route.request().url()).pathname.slice(1);
  if (path === '') return route.fulfill({contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>'});
  if (path === 'translator.js') return route.fulfill({contentType: 'text/javascript', body: script});
  const type = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}[extname(path).toLowerCase()];
  return route.fulfill({contentType: type || 'application/octet-stream', body: readFileSync(join(here, 'pages', decodeURIComponent(path)))});
});

let calls = [];
await page.exposeFunction('askOllama', async job => {
  const started = Date.now();
  const response = await fetch('http://127.0.0.1:11434/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(job)});
  const body = await response.json();
  const s = ns => Math.round((ns || 0) / 1e6);
  calls.push({ms: Date.now() - started, kind: job.messages[0].content.slice(0, 40), images: job.messages[1].images?.length || 0,
    loadMs: s(body?.load_duration), promptTokens: body?.prompt_eval_count, promptMs: s(body?.prompt_eval_duration),
    outputTokens: body?.eval_count, outputMs: s(body?.eval_duration), output: body?.message?.content});
  return body;
});
await page.goto('http://quality.test/');
await page.addScriptTag({url: 'http://quality.test/translator.js'});
await page.evaluate(async () => {
  const M = globalThis.MLT;
  for (const face of M.letteringFonts ? M.letteringFonts() : [{family: 'MangaLettering', data: M.comicNeueBold(), weight: '700'}]) {
    const bytes = Uint8Array.from(atob(face.data), c => c.charCodeAt(0));
    document.fonts.add(await new FontFace(face.family, bytes.buffer, {weight: face.weight || '400'}).load());
  }
});

const summary = [];
for (const name of pages) {
  calls = [];
  const started = Date.now();
  const result = await page.evaluate(async ({name, model, source}) => {
    const M = globalThis.MLT;
    const env = {
      makeCanvas: (w, h) => Object.assign(document.createElement('canvas'), {width: w, height: h}),
      async encode(canvas, mime = 'image/jpeg', quality = 0.9) {
        const url = canvas.toDataURL(mime, quality);
        return {mime, data: url.slice(url.indexOf(',') + 1)};
      },
      pause: () => new Promise(r => setTimeout(r, 0))
    };
    const img = new Image();
    img.src = `/${encodeURIComponent(name)}`;
    await img.decode();
    // A fresh pipeline per page, like a reader opening one chapter page after another would share
    // one; pages here are from different episodes, so context would only mislead.
    const pipeline = M.createPipeline(env);
    const job = {ask: async j => M.readChat(await globalThis.askOllama(M.chatPayload(model, j))), report: () => {}};
    const out = await pipeline.translate(img, {source, target: 'English', uppercase: true}, job);
    const translated = out.canvas || img;
    const side = document.createElement('canvas');
    side.width = img.width * 2 + 12; side.height = img.height;
    const g = side.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, side.width, side.height);
    g.drawImage(img, 0, 0); g.drawImage(translated, img.width + 12, 0);
    const full = document.createElement('canvas');
    full.width = img.width; full.height = img.height; full.getContext('2d').drawImage(translated, 0, 0);
    return {png: full.toDataURL('image/png'), side: side.toDataURL('image/jpeg', 0.88), translated: out.translated, kept: out.kept,
      message: out.message || '', debug: out.debug || null, skipped: out.skipped || []};
  }, {name, model, source});
  const ms = Date.now() - started, base = name.replace(/\.[^.]+$/, '');
  writeFileSync(join(outDir, `${base}.png`), Buffer.from(result.png.split(',')[1], 'base64'));
  writeFileSync(join(outDir, `${base}-side.jpg`), Buffer.from(result.side.split(',')[1], 'base64'));
  writeFileSync(join(outDir, `${base}.json`), JSON.stringify({ms, translated: result.translated, kept: result.kept, message: result.message,
    readings: result.debug, skipped: result.skipped, modelMs: calls.reduce((a, c) => a + c.ms, 0), calls}, null, 2));
  console.log(`${name}: ${(ms / 1000).toFixed(1)} s, ${calls.length} model calls, ${result.translated} lettered, ${result.kept} kept${result.message ? ' — ' + result.message : ''}`);
  summary.push({name, ms, calls: calls.length, translated: result.translated, kept: result.kept});
  // Gentle mode, for a PC that is in use: the model leaves video memory after every page, and the
  // next page waits.
  if (unload) await fetch('http://127.0.0.1:11434/api/generate', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({model, keep_alive: 0})}).catch(() => {});
  if (pause && name !== pages[pages.length - 1]) await new Promise(resolve => setTimeout(resolve, pause * 1000));
}
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
