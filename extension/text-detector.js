// The local text detector: an RT-DETR model (ogkalu/comic-text-and-bubble-detector, Apache-2.0)
// that boxes speech bubbles, the text in them and text on the artwork. Shared by the extension's
// offscreen document (onnxruntime-web) and the quality harness (onnxruntime-node).
export const DETECTOR_SIZE = 640;
const LABELS = ['bubble', 'text_bubble', 'text_free'];

// rgba: the page crop stretched to 640×640, as RGBA bytes. width, height: the crop's real size.
// Returns [{label, score, x, y, width, height}] in the crop's pixels.
export async function detectText(ort, session, rgba, width, height) {
  const n = DETECTOR_SIZE * DETECTOR_SIZE, input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = rgba[i * 4] / 255; input[n + i] = rgba[i * 4 + 1] / 255; input[2 * n + i] = rgba[i * 4 + 2] / 255;
  }
  const out = await session.run({
    images: new ort.Tensor('float32', input, [1, 3, DETECTOR_SIZE, DETECTOR_SIZE]),
    orig_target_sizes: new ort.Tensor('int64', BigInt64Array.from([BigInt(Math.round(width)), BigInt(Math.round(height))]), [1, 2])
  });
  const found = [];
  for (let i = 0; i < out.scores.dims[1]; i++) {
    const score = out.scores.data[i];
    if (score < 0.2) continue;
    const [x0, y0, x1, y1] = out.boxes.data.slice(i * 4, i * 4 + 4);
    found.push({label: LABELS[Number(out.labels.data[i])] || 'other', score, x: x0, y: y0, width: x1 - x0, height: y1 - y0});
  }
  return found;
}
