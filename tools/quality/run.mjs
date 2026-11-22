// Quality harness: translates every page in tools/quality/pages/ with the real pipeline, in Edge,
// through the local Ollama, and writes for each page:
//   tools/quality/out/<name>.png          the translated page
//   tools/quality/out/<name>-side.png     original | translated, side by side
//   tools/quality/out/<name>.json         what was read, translated and where it was lettered
//     node build.mjs && node tools/quality/run.mjs [name-filter] [--source=Japanese] [--model=qwen3-vl:4b-instruct]
//       [--out=out] [--unload] [--pause=30]   unload the model after each page, wait 30 s between pages
//       [--concurrency=2]   after the first page, translate this many at once, as when reading ahead
//       [--no-stream]       translate without streaming the answer (no bubbles shown early)
//       [--pages=<folder>]  pages from another folder (pages that may not be kept in the repository)
//       [--dump=<folder>]   save every image sent to the model there (<page>-<call>.jpg), to see what it read
import {chromium} from 'playwright-core';
import {readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync} from 'node:fs';
import {join, dirname, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, '../..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const filter = args.find(a => !a.startsWith('--')) || '';
const model = option('model', 'qwen3-vl:4b-instruct'), source = option('source', 'Auto-detect');
const outDir = resolve(here, option('out', 'out'));
// --pages=<folder>: translate the pages in another folder (pages that can't be kept in the repo).
const pagesDir = resolve(here, option('pages', 'pages'));
// --terms=terms.txt: the reader's names and terms (one per line, シチミ = Shichimi), as in settings.
const terms = option('terms') ? readFileSync(join(here, option('terms')), 'utf8') : '';
const unload = args.includes('--unload'), pause = Number(option('pause', 0)), concurrency = Number(option('concurrency', 1));
const stream = !args.includes('--no-stream');
const dumpDir = option('dump') ? resolve(here, option('dump')) : '';
if (dumpDir) mkdirSync(dumpDir, {recursive: true});
mkdirSync(outDir, {recursive: true});

// The built userscript, made to hand its internals to the page instead of starting its UI.
const script = readFileSync(join(root, 'local-manga-translator.user.js'), 'utf8')
  .replace("if (typeof document === 'undefined') {", 'if (true) {')
  .replace(/if \(typeof module !== 'undefined'\) module\.exports =/, 'globalThis.MLT =');
if (!script.includes('globalThis.MLT =')) throw new Error('Could not expose the translator internals.');

const pages = readdirSync(pagesDir).filter(f => /\.(jpe?g|png|webp)$/i.test(f) && f.includes(filter)).sort();
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1200, height: 900}});
page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
await page.route('http://quality.test/**', route => {
  const path = new URL(route.request().url()).pathname.slice(1);
  if (path === '') return route.fulfill({contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>'});
  if (path === 'translator.js') return route.fulfill({contentType: 'text/javascript', body: script});
  const type = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}[extname(path).toLowerCase()];
  return route.fulfill({contentType: type || 'application/octet-stream', body: readFileSync(join(pagesDir, decodeURIComponent(path)))});
});

// The extension's helper models, run here with onnxruntime-node: by default from models/ when
// they are there (see CHECKLIST.md), or --detector=… and --inpainter=…; --no-models runs without.
const helper = (name, file) => args.includes('--no-models') ? '' : option(name) || (existsSync(join(here, 'models', file)) ? join(here, 'models', file) : '');
const detectorFile = helper('detector', 'detector_int8.onnx'), inpainterFile = helper('inpainter', 'migan_pipeline_v2.onnx');
let detector = null;
if (inpainterFile) {
  const ort = await import('onnxruntime-node');
  const {inpaintImage} = await import('data:text/javascript,' + encodeURIComponent(readFileSync(join(root, 'extension/text-detector.js'), 'utf8')));
  const session = await ort.InferenceSession.create(inpainterFile);
  await page.exposeFunction('inpaintImage', async (rgba, mask, w, h) =>
    Buffer.from(await inpaintImage(ort, session, Buffer.from(rgba, 'base64'), Buffer.from(mask, 'base64'), w, h)).toString('base64'));
}
if (detectorFile) {
  const ort = await import('onnxruntime-node');
  // An ES module for the extension, in a CommonJS package: loaded from its source text.
  const {detectText} = await import('data:text/javascript,' + encodeURIComponent(readFileSync(join(root, 'extension/text-detector.js'), 'utf8')));
  const session = await ort.InferenceSession.create(detectorFile);
  detector = {ms: 0, run: (rgba, w, h) => detectText(ort, session, rgba, w, h)};
  await page.exposeFunction('detectText', async (data, w, h) => {
    const started = Date.now();
    const found = await detector.run(Buffer.from(data, 'base64'), w, h);
    detector.ms += Date.now() - started;
    return found;
  });
}

const callsOf = new Map();
// As in the extension: one request at a time (Ollama runs one at a time for this model anyway),
// the earliest page first, so pages read ahead do not hold up the one on screen.
const waiting = [];
let asking = false;
const turn = priority => new Promise(resolve => { waiting.push({priority, resolve}); next(); });
const next = () => {
  if (asking || !waiting.length) return;
  waiting.sort((a, b) => a.priority - b.priority);
  asking = true;
  waiting.shift().resolve(() => { asking = false; next(); });
};
// A streamed answer (job.stream) is passed to the page's globalThis.onText[streamId] piece by
// piece, as the extension does, and returned whole at the end.
await page.exposeFunction('askOllama', async (job, name, streamId) => {
  const calls = callsOf.get(name);
  const done = await turn(pages.indexOf(name));
  if (dumpDir) (job.messages[1].images || []).forEach((data, k) =>
    writeFileSync(join(dumpDir, `${name.replace(/\.[^.]+$/, '')}-${calls.length + 1}${k ? '-' + k : ''}.jpg`), Buffer.from(data, 'base64')));
  const started = Date.now();
  let body;
  try {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(job)});
    if (!job.stream) body = await response.json();
    else {
      let content = '', pending = '';
      const decoder = new TextDecoder();
      for await (const bytes of response.body) {
        const lines = (pending + decoder.decode(bytes, {stream: true})).split('\n');
        pending = lines.pop();
        for (const line of lines.filter(l => l.trim())) {
          const part = JSON.parse(line);
          if (part.error) { body = part; break; }
          body = part;
          content += part.message?.content || '';
          if (part.message?.content) await page.evaluate(([id, piece]) => globalThis.onText[id]?.(piece), [streamId, part.message.content]);
        }
        if (body?.error) break;
      }
      if (!body?.error) body = {...body, message: {...body?.message, content}};
    }
  } finally { done(); }
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

console.log(`Helper models: ${detectorFile ? 'detector' : 'no detector'}, ${inpainterFile ? 'inpainter' : 'no inpainter'}.`);
const summary = [], runStarted = Date.now();
let nextIndex = 0;
async function worker() {
  while (nextIndex < pages.length) await translatePage(pages[nextIndex++]);
}
async function translatePage(name) {
  const calls = [];
  callsOf.set(name, calls);
  const started = Date.now();
  const result = await page.evaluate(async ({name, model, source, terms, stream}) => {
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
    if (globalThis.detectText) env.detectText = async crop => {
      const c = Object.assign(document.createElement('canvas'), {width: 640, height: 640});
      c.getContext('2d').drawImage(crop, 0, 0, 640, 640);
      const rgba = c.getContext('2d').getImageData(0, 0, 640, 640).data;
      let bin = '';
      for (let i = 0; i < rgba.length; i += 0x8000) bin += String.fromCharCode(...rgba.subarray(i, i + 0x8000));
      return globalThis.detectText(btoa(bin), crop.width, crop.height);
    };
    const b64 = bytes => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
    if (globalThis.inpaintImage) env.inpaint = async (img, mask) =>
      Uint8Array.from(atob(await globalThis.inpaintImage(b64(img.data), b64(mask), img.width, img.height)), c => c.charCodeAt(0));
    const pipeline = M.createPipeline(env);
    globalThis.onText ||= {};
    const started = performance.now();
    let firstBubble = null;
    const job = {
      async ask(j, onText) {
        if (!stream || !onText) return M.readChat(await globalThis.askOllama(M.chatPayload(model, j), name));
        const id = Math.random().toString(36).slice(2);
        globalThis.onText[id] = onText;
        try { return M.readChat(await globalThis.askOllama(M.chatPayload(model, j, true), name, id)); }
        finally { delete globalThis.onText[id]; }
      },
      report: () => {},
      // Bubbles shown early, as in the extension: when the first one is ready.
      preview: () => { firstBubble ??= performance.now() - started; }
    };
    const out = await pipeline.translate(img, {source, target: 'English', uppercase: true, terms}, job);
    const translated = out.canvas || img;
    const side = document.createElement('canvas');
    side.width = img.width * 2 + 12; side.height = img.height;
    const g = side.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, side.width, side.height);
    g.drawImage(img, 0, 0); g.drawImage(translated, img.width + 12, 0);
    const full = document.createElement('canvas');
    full.width = img.width; full.height = img.height; full.getContext('2d').drawImage(translated, 0, 0);
    return {png: full.toDataURL('image/png'), side: side.toDataURL('image/jpeg', 0.88), translated: out.translated, kept: out.kept,
      message: out.message || '', debug: out.debug || null, skipped: out.skipped || [], firstBubble: firstBubble && Math.round(firstBubble)};
  }, {name, model, source, terms, stream});
  const ms = Date.now() - started, base = name.replace(/\.[^.]+$/, '');
  writeFileSync(join(outDir, `${base}.png`), Buffer.from(result.png.split(',')[1], 'base64'));
  writeFileSync(join(outDir, `${base}-side.jpg`), Buffer.from(result.side.split(',')[1], 'base64'));
  writeFileSync(join(outDir, `${base}.json`), JSON.stringify({ms, firstBubbleMs: result.firstBubble, translated: result.translated, kept: result.kept, message: result.message,
    readings: result.debug, skipped: result.skipped, modelMs: calls.reduce((a, c) => a + c.ms, 0), calls}, null, 2));
  const first = result.firstBubble ? `, first bubble after ${(result.firstBubble / 1000).toFixed(1)} s` : '';
  console.log(`${name}: ${(ms / 1000).toFixed(1)} s${first}, ${calls.length} model calls, ${result.translated} lettered, ${result.kept} kept${result.message ? ' — ' + result.message : ''}`);
  summary.push({name, ms, firstBubbleMs: result.firstBubble, calls: calls.length, translated: result.translated, kept: result.kept, finished: Date.now() - runStarted});
  // Gentle mode, for a PC that is in use: the model leaves video memory after every page, and the
  // next page waits.
  if (unload) await fetch('http://127.0.0.1:11434/api/generate', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({model, keep_alive: 0})}).catch(() => {});
  if (pause && name !== pages[pages.length - 1]) await new Promise(resolve => setTimeout(resolve, pause * 1000));
}
// The first page is the one on screen: alone, as in the extension; the rest are read ahead.
if (pages.length) await translatePage(pages[nextIndex++]);
await Promise.all(Array.from({length: Math.max(1, concurrency)}, worker));
const wall = Date.now() - runStarted;
console.log(`${pages.length} pages in ${(wall / 1000).toFixed(1)} s (${(pages.length / wall * 60000).toFixed(1)} per minute), ` +
  `first page done after ${(summary.find(p => p.name === pages[0]).finished / 1000).toFixed(1)} s, ${concurrency} at a time.`);
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await browser.close();
