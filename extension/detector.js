// Runs the local text detector for every tab: in Chrome in an offscreen document (detector.html),
// in Firefox in the background page. The model is downloaded once, checked and kept in the cache.
import * as ort from './ort/ort.wasm.min.mjs';
import {detectText} from './text-detector.js';

const MODEL = {
  url: 'https://huggingface.co/ogkalu/comic-text-and-bubble-detector/resolve/16e8a622f91fabc6b5b65c96d32d1183f8843546/detector_int8.onnx',
  sha256: 'b5022ad46416b6fe4f88b0cc082cfd2ff5b1cfc624088c2f19879485493f5913'
};

ort.env.wasm.wasmPaths = new URL('./ort/', import.meta.url).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2))) : 1;

let session = null, loading = null, failed = 0, runs = 0;

async function modelBytes() {
  const cache = await caches.open('mlt-models');
  const cached = await cache.match(MODEL.url);
  if (cached) return new Uint8Array(await cached.arrayBuffer());
  const response = await fetch(MODEL.url, {credentials: 'omit'});
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== MODEL.sha256) throw new Error('The downloaded detector model is damaged.');
  await cache.put(MODEL.url, new Response(bytes));
  return bytes;
}

// Loads the model once; after a failure, tries again a minute later at the earliest.
function load() {
  if (session) return Promise.resolve(session);
  if (!loading && Date.now() - failed > 60000) {
    loading = modelBytes().then(bytes => ort.InferenceSession.create(bytes, {executionProviders: ['wasm']}))
      .then(s => (session = s), error => { failed = Date.now(); throw error; })
      .finally(() => { loading = null; });
  }
  return loading || Promise.reject(new Error('The detector failed to load a moment ago.'));
}

async function pixels(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}

// {type: 'detect', image (640×640 data URL), width, height} → {found} or {found: null} while the
// model is still loading; {type: 'prepare'} → {ready}; {type: 'stats'} → {ready, runs, threads}.
export async function handle(message) {
  if (message.type === 'prepare') return load().then(() => ({ready: true}), error => ({ready: false, error: String(error.message || error)}));
  if (message.type === 'stats') return {ready: !!session, runs, threads: ort.env.wasm.numThreads};
  if (message.type !== 'detect') return null;
  if (!session) { load().catch(() => {}); return {found: null, loading: true}; }
  runs++;
  return {found: await detectText(ort, session, await pixels(message.image), message.width, message.height)};
}

if (location.pathname.endsWith('/detector.html')) {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.target !== 'detector') return false;
    handle(message).then(reply, error => reply({error: String(error?.message || error)}));
    return true;
  });
}
