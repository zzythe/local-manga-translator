// Runs the local helper models for every tab: in Chrome in an offscreen document (detector.html),
// in Firefox in the background page. Each model is downloaded once, checked and kept in the cache.
//   detector: finds speech bubbles and the text in them (RT-DETR, Apache-2.0, 44 MB)
//   inpainter: repaints the artwork under erased sound effects (MI-GAN, MIT, 28 MB)
import * as ort from './ort/ort.wasm.min.mjs';
import {detectText, inpaintImage} from './text-detector.js';

const MODELS = {
  detector: {
    url: 'https://huggingface.co/ogkalu/comic-text-and-bubble-detector/resolve/16e8a622f91fabc6b5b65c96d32d1183f8843546/detector_int8.onnx',
    sha256: 'b5022ad46416b6fe4f88b0cc082cfd2ff5b1cfc624088c2f19879485493f5913'
  },
  inpainter: {
    url: 'https://huggingface.co/andraniksargsyan/migan/resolve/406830d0fa60666da0071c342ad2fbc8f30c5c64/migan_pipeline_v2.onnx',
    sha256: '6f1f3530a1a2324b19752018ce756088b07973cda8d7d890034ace5c8a48c40b'
  }
};

ort.env.wasm.wasmPaths = new URL('./ort/', import.meta.url).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2))) : 1;

const state = Object.fromEntries(Object.keys(MODELS).map(name => [name, {session: null, loading: null, failed: 0}]));
let runs = 0, repaints = 0;

async function modelBytes({url, sha256}) {
  const cache = await caches.open('mlt-models');
  const cached = await cache.match(url);
  if (cached) return new Uint8Array(await cached.arrayBuffer());
  const response = await fetch(url, {credentials: 'omit'});
  if (!response.ok) throw new Error(`Download failed (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== sha256) throw new Error('A downloaded model is damaged.');
  await cache.put(url, new Response(bytes));
  return bytes;
}

// Loads a model once; after a failure, tries again a minute later at the earliest.
function load(name) {
  const m = state[name];
  if (m.session) return Promise.resolve(m.session);
  if (!m.loading && Date.now() - m.failed > 60000) {
    m.loading = modelBytes(MODELS[name]).then(bytes => ort.InferenceSession.create(bytes, {executionProviders: ['wasm']}))
      .then(s => (m.session = s), error => { m.failed = Date.now(); throw error; })
      .finally(() => { m.loading = null; });
  }
  return m.loading || Promise.reject(new Error('The model failed to load a moment ago.'));
}

// The session if it is ready; otherwise starts loading it and returns null.
function ready(name) {
  if (!state[name].session) load(name).catch(() => {});
  return state[name].session;
}

async function pixels(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
}

const toBase64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

// {type: 'detect', image (640×640 data URL), width, height} → {found}, or {found: null} while the
//   model is still loading;
// {type: 'inpaint', image (PNG data URL), mask (base64, a byte per pixel), width, height} →
//   {pixels (base64 RGBA)}, or {pixels: null} while loading;
// {type: 'prepare'} → {ready}; {type: 'stats'} → {ready, runs, repaints, threads}.
export async function handle(message) {
  if (message.type === 'prepare') {
    return Promise.all(Object.keys(MODELS).map(load)).then(() => ({ready: true}), error => ({ready: false, error: String(error.message || error)}));
  }
  if (message.type === 'stats') return {ready: Object.values(state).every(m => m.session), runs, repaints, threads: ort.env.wasm.numThreads};
  if (message.type === 'detect') {
    const session = ready('detector');
    if (!session) return {found: null};
    runs++;
    return {found: await detectText(ort, session, await pixels(message.image), message.width, message.height)};
  }
  if (message.type === 'inpaint') {
    const session = ready('inpainter');
    if (!session) return {pixels: null};
    repaints++;
    const filled = await inpaintImage(ort, session, await pixels(message.image), fromBase64(message.mask), message.width, message.height);
    return {pixels: toBase64(filled)};
  }
  return null;
}

if (location.pathname.endsWith('/detector.html')) {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.target !== 'detector') return false;
    handle(message).then(reply, error => reply({error: String(error?.message || error)}));
    return true;
  });
}
