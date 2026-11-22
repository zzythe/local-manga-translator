// node --test test/translator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const t = require('../local-manga-translator.user.js');

// ---------- synthetic page helpers ----------
function page(width, height, rgb) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return {data, width, height};
}
function set(img, x, y, rgb) { if (x >= 0 && y >= 0 && x < img.width && y < img.height) img.data.set([...rgb, 255], (y * img.width + x) * 4); }
function ellipse(img, cx, cy, rx, ry, fill, outline) {
  for (let y = cy - ry - 3; y <= cy + ry + 3; y++) for (let x = cx - rx - 3; x <= cx + rx + 3; x++) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d <= 1) set(img, x, y, typeof fill === 'function' ? fill(x, y) : fill);
    else if (outline && d <= 1.12) set(img, x, y, outline);
  }
}
// Letter-like glyphs: a box outline with a bar, roughly 12×16 px each.
function glyphs(img, x0, y0, columns, rows, colour = [20, 20, 20]) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
    const gx = x0 + c * 16, gy = y0 + r * 22;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 12; x++) {
      if (x < 2 || x > 9 || y < 2 || y > 13 || (y > 6 && y < 9)) set(img, gx + x, gy + y, colour);
    }
  }
}

test('finds lettering inside a white bubble but not marks on skin-coloured artwork', () => {
  const img = page(600, 400, [120, 120, 120]);
  ellipse(img, 160, 200, 130, 100, [255, 255, 255], [0, 0, 0]);
  glyphs(img, 100, 165, 7, 3);
  // A pale, saturated skin area with dark marks inside it: must not be taken for a bubble.
  ellipse(img, 450, 200, 120, 110, [240, 200, 175], [60, 30, 20]);
  glyphs(img, 400, 165, 6, 3, [90, 40, 30]);
  const blocks = t.findBubbleText(img.data, img.width, img.height);
  assert.equal(blocks.length, 1);
  const [b] = blocks;
  assert.ok(b.x < 105 && b.x + b.width > 205 && b.y < 170 && b.y + b.height > 225, JSON.stringify(b));
  assert.ok(b.layout.width >= b.width);
  assert.equal(b.glyphCount, 21);
});

test('finds lettering in a pale tinted bubble on a yellowed scan', () => {
  const img = page(500, 400, [200, 196, 180]);
  ellipse(img, 250, 200, 140, 100, [236, 232, 214], [30, 30, 30]);
  glyphs(img, 190, 170, 7, 3, [40, 38, 35]);
  const blocks = t.findBubbleText(img.data, img.width, img.height);
  assert.equal(blocks.length, 1);
});

// ---------- erasing ----------
function crop(img, box) {
  const data = new Uint8ClampedArray(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) data.set(img.data.subarray(((box.y + y) * img.width + box.x) * 4, ((box.y + y) * img.width + box.x + box.width) * 4), y * box.width * 4);
  return {data, width: box.width, height: box.height};
}
const lumAt = (img, i) => (img.data[i * 4] * 77 + img.data[i * 4 + 1] * 150 + img.data[i * 4 + 2] * 29) >> 8;

test('opaque bubble is flat-filled with its measured colour', () => {
  const img = page(500, 400, [120, 120, 120]);
  ellipse(img, 250, 200, 160, 110, [250, 244, 230], [0, 0, 0]);
  glyphs(img, 190, 170, 7, 3);
  const [block] = t.findBubbleText(img.data, img.width, img.height);
  const plan = block.erase;
  assert.equal(plan.solid, true);
  assert.deepEqual(plan.fill.map(Math.round), [250, 244, 230]);
  assert.equal(plan.color, '#141414');
  const part = crop(img, plan);
  t.applyErase(part, plan);
  for (let i = 0; i < part.width * part.height; i++) if (plan.mask[i]) assert.ok(lumAt(part, i) > 235);
});

test('semi-transparent bubble over artwork is inpainted, not flat-filled', () => {
  const img = page(500, 400, [120, 120, 120]);
  // Translucent white over diagonal artwork stripes: the art shows through faintly.
  const fill = (x, y) => { const art = ((x + y) >> 3) % 2 ? 90 : 160; const v = Math.round(art * 0.25 + 255 * 0.75); return [v, v, v]; };
  ellipse(img, 250, 200, 160, 110, fill, [0, 0, 0]);
  glyphs(img, 190, 170, 7, 3);
  const [block] = t.findBubbleText(img.data, img.width, img.height);
  assert.ok(block, 'translucent bubble found');
  const plan = block.erase;
  assert.equal(plan.solid, false);
  const part = crop(img, plan);
  t.applyErase(part, plan);
  let dark = 0;
  for (let i = 0; i < part.width * part.height; i++) if (plan.mask[i] && lumAt(part, i) < 150) dark++;
  assert.equal(dark, 0, 'no lettering left behind');
});

test('loose text on smooth skin is cleaned; text tangled in busy artwork is left alone', () => {
  const skin = page(140, 70, [235, 190, 165]);
  glyphs(skin, 30, 25, 5, 1, [40, 20, 20]);
  const plan = t.planLooseErase(skin, {x: 28, y: 23, width: 80, height: 20});
  assert.ok(plan, 'smooth skin is cleanable');
  assert.equal(plan.solid, true);
  t.applyErase(skin, plan);
  for (let i = 0; i < skin.width * skin.height; i++) if (plan.mask[i]) assert.ok(lumAt(skin, i) > 150);
  const busy = page(140, 70, [0, 0, 0]);
  for (let y = 0; y < 70; y++) for (let x = 0; x < 140; x++) set(busy, x, y, (x * 7 + y * 13) % 5 < 2 ? [20, 20, 20] : [200, 120, 90]);
  glyphs(busy, 30, 25, 5, 1, [255, 255, 255]);
  assert.equal(t.planLooseErase(busy, {x: 28, y: 23, width: 80, height: 20}), null);
});

test('loose cleaning keeps a mark the model box clipped but not artwork lines crossing the crop', () => {
  const img = page(200, 80, [240, 200, 175]);
  glyphs(img, 40, 30, 6, 1, [50, 20, 30]);                    // glyphs at x 40..131
  for (let x = 0; x < 200; x++) for (let k = 0; k < 2; k++) set(img, x, 5 + k, [20, 20, 20]); // hair line, far above
  // The model's box misses the first glyph.
  const plan = t.planLooseErase(img, {x: 56, y: 28, width: 78, height: 20});
  assert.ok(plan);
  assert.ok(plan.mask[36 * 200 + 41], 'clipped first glyph is cleaned');
  assert.ok(!plan.mask[5 * 200 + 100], 'artwork line is kept');
});

// ---------- model output handling ----------
test('regionsFrom accepts 0–1000 boxes and 0–1 fractions', () => {
  const tile = {x: 0, y: 1000, width: 800, height: 1200, start: 1100, end: 2000};
  const [a] = t.regionsFrom({items: [{text: 'あ', box: [100, 250, 300, 500]}]}, tile);
  assert.deepEqual([a.x, a.y, a.width, a.height], [80, 1300, 160, 300]);
  assert.equal(a.original, 'あ');
  const [b] = t.regionsFrom({items: [{text: 'あ', box: [0.1, 0.25, 0.3, 0.5]}]}, tile);
  assert.deepEqual([b.x, b.y, b.width, b.height], [80, 1300, 160, 300]);
  // Centre outside this tile's own range: belongs to the neighbouring tile.
  assert.equal(t.regionsFrom({items: [{text: 'x', box: [0, 0, 100, 50]}]}, tile).length, 0);
  assert.throws(() => t.regionsFrom({regions: []}, tile));
});

test('looseRegions keeps text outside bubbles and drops repeats of bubble text', () => {
  const bubble = {x: 100, y: 100, width: 80, height: 60, original: '我一直在等你',
    erases: [{x: 95, y: 95, width: 90, height: 70}]};
  const regions = [
    {x: 98, y: 98, width: 84, height: 64, original: '我一直在等你'},   // the bubble itself
    {x: 120, y: 175, width: 70, height: 40, original: '我一直在等你！'}, // rough box beside it, same words
    {x: 300, y: 120, width: 40, height: 80, original: '碎碎念'},       // muttering next to a head
    {x: 600, y: 600, width: 50, height: 30, original: '我一直在等你'},   // the same words far away
    {x: 400, y: 400, width: 30, height: 30, original: '…！'}           // punctuation only
  ];
  const loose = t.looseRegions(regions, [bubble]).map(r => r.x);
  assert.deepEqual(loose, [300, 600]);
});

test('cleanReading drops non-text readings and fixes vertical ellipses', () => {
  const zh = t.languageInfo('Chinese'), ko = t.languageInfo('Korean');
  assert.equal(t.cleanReading('No text', 10, zh), '');
  assert.equal(t.cleanReading('Hello there', 10, zh), '', 'Latin reading for a Chinese page is artwork');
  assert.equal(t.cleanReading('我…', 2, zh), '我…');
  assert.equal(t.cleanReading('你好：', 3, zh), '你好…');
  assert.equal(t.cleanReading('我'.repeat(40), 4, zh), '', 'far more text than glyphs');
  assert.equal(t.cleanReading('こんにちは', 5, ko), '');
  assert.equal(t.cleanReading('안녕', 2, ko), '안녕');
});

test('shapeSpan gives the narrowest row of a band and nothing outside the shape', () => {
  const shape = {y: 10, left: [50, 40, 30, 30, 40, -1, 50], right: [70, 80, 90, 90, 80, -1, 70]};
  const span = t.shapeSpan(shape, 2);
  assert.deepEqual(span(6, 7), {left: 20, right: 40});        // rows 2..4
  assert.deepEqual(span(7.5, 8), {left: 25, right: 35});      // rows 5 (no inside) and 6
  assert.equal(span(2, 4), null, 'above the bubble');
  assert.equal(span(8, 20), null, 'below the bubble');
});

test('a bubble block carries a shape that is narrower at the top than the middle', () => {
  const img = page(600, 400, [120, 120, 120]);
  ellipse(img, 300, 200, 150, 110, [255, 255, 255], [0, 0, 0]);
  glyphs(img, 240, 170, 7, 3);
  const [b] = t.findBubbleText(img.data, img.width, img.height);
  assert.ok(b.shape, 'shape measured');
  const span = t.shapeSpan(b.shape, 1);
  const middle = span(195, 205), high = span(110, 120);
  assert.ok(middle && high, JSON.stringify({middle, high}));
  assert.ok(middle.right - middle.left > (high.right - high.left) + 40, JSON.stringify({middle, high}));
  assert.ok(middle.left >= 150 && middle.right <= 451, 'stays inside the outline');
});

test('isUntranslated understands each target script', () => {
  assert.ok(t.isUntranslated('こんにちは', 'こんにちは', 'English'));
  assert.ok(!t.isUntranslated('こんにちは', 'Hello', 'English'));
  assert.ok(!t.isUntranslated('こんにちは', '¡Hola!', 'Spanish (Spain)'));
  assert.ok(!t.isUntranslated('こんにちは', 'Olá!', 'Portuguese (Brazil)'));
  assert.ok(t.isUntranslated('こんにちは', 'こんにちは, olá', 'Portuguese'));
  assert.ok(!t.isUntranslated('こんにちは', '안녕하세요', 'Korean'));
  assert.ok(t.isUntranslated('こんにちは', 'こんにちは', 'Korean'));
  assert.ok(t.isUntranslated('先生', '先生', 'Korean'));
  assert.ok(!t.isUntranslated('안녕', 'Hi', 'English'));
  assert.ok(t.isUntranslated('안녕하세요', '안녕하세요', 'Japanese'));
  assert.ok(t.isUntranslated('すごい', 'すごい', 'Chinese (Simplified)'));
  assert.ok(!t.isUntranslated('OK', 'OK', 'Spanish'), 'short Latin words may stay the same');
  assert.ok(t.isUntranslated('', '', 'English'));
});

test('languageInfo maps regional variants', () => {
  assert.equal(t.languageInfo('Portuguese (Brazil)').code, 'pt-BR');
  assert.equal(t.languageInfo('Portuguese (Portugal)').code, 'pt-PT');
  assert.equal(t.languageInfo('Spanish (Spain)').code, 'es-ES');
  assert.equal(t.languageInfo('Spanish (Latin America)').code, 'es-419');
  assert.equal(t.languageInfo('Korean').script, 'hangul');
  assert.equal(t.languageInfo('Chinese (Traditional)').code, 'zh-Hant');
});

test('parseJSONLoose handles fences and flags refusals as blocked', () => {
  assert.deepEqual(t.parseJSONLoose('```json\n{"regions": []}\n```'), {regions: []});
  assert.deepEqual(t.parseJSONLoose('Sure! {"a": 1} hope that helps'), {a: 1});
  assert.throws(() => t.parseJSONLoose("I'm sorry, I can't help with this image."), e => e.code === 'BLOCKED');
});

test('prompts ask for faithful, uncensored output with compact schemas', () => {
  const s = {source: 'Chinese', target: 'Korean'};
  const detect = t.detectionJob(s, {mime: 'image/jpeg', data: ''});
  assert.match(detect.system, /without censoring/);
  assert.deepEqual(detect.schema.properties.items.items.required.sort(), ['box', 'text']);
  assert.ok(t.sheetJob(s, {mime: 'image/jpeg', data: ''}, 2).schema.properties.items.items.properties.n);
  assert.match(t.translationJob(s, [], [], false).system, /mutter mutter/);
  assert.match(t.translationJob(s, [], [], false).system, /반말/);
  const payload = t.chatPayload('m', detect);
  assert.equal(payload.stream, false);
  assert.equal(payload.messages.at(-1).images.length, 1);
});

test('wrapText never starts a line with closing punctuation', () => {
  const measure = s => [...s].length * 10;
  const lines = t.wrapText(measure, 'あいうえおかきくけ。こさしすせ', 90);
  assert.ok(lines.every(line => !/^[。、]/.test(line)), JSON.stringify(lines));
});

test('tiles cover a tall strip with overlaps and disjoint ownership', () => {
  const list = t.tiles(800, 5000);
  assert.equal(list[0].start, 0);
  assert.equal(list.at(-1).end, 5000);
  for (let i = 1; i < list.length; i++) assert.equal(list[i].start, list[i - 1].end);
});
