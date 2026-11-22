// node --test test/translator.test.cjs
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

// ---------- fixes from the quality pass (tools/quality/) ----------
// A deterministic pseudo-random source, so textured test art is the same on every run.
function rng(seed) { return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }

test('JPEG ringing round bubble lettering is erased too, not left as a ghost', () => {
  const img = page(500, 400, [120, 120, 120]);
  ellipse(img, 250, 200, 160, 110, [255, 255, 255], [0, 0, 0]);
  glyphs(img, 190, 170, 7, 3);
  // Mosquito noise: faint grey speckles up to 3 px from the strokes, as JPEG leaves them.
  const random = rng(7), ink = (x, y) => img.data[(y * img.width + x) * 4] === 20;
  for (let y = 166; y < 240; y++) for (let x = 186; x < 304; x++) {
    const p = (y * img.width + x) * 4;
    if (img.data[p] !== 255 || random() >= 0.3) continue;
    let near = false;
    for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) if (ink(x + dx, y + dy)) { near = true; break; }
    if (near) img.data.set([228, 228, 228], p);
  }
  const [block] = t.findBubbleText(img.data, img.width, img.height);
  const plan = block.erase, part = crop(img, plan);
  t.applyErase(part, plan);
  let left = 0;
  for (let y = 166; y < 240; y++) for (let x = 186; x < 304; x++) {
    const i = (y - plan.y) * part.width + (x - plan.x);
    const v = plan.mask[i] ? lumAt(part, i) : lumAt(img, y * img.width + x);
    if (v < 240) left++;
  }
  assert.ok(left < 10, `${left} ghost pixels left round the lettering`);
});

test('two speech clusters on one stretch of paper get separate blocks that do not overlap', () => {
  // Bubbles open onto the white gutter, so the paper is one region: each cluster must still be
  // its own block, laid out in its own part of the paper.
  const img = page(700, 300, [255, 255, 255]);
  glyphs(img, 60, 100, 6, 3);
  glyphs(img, 480, 120, 6, 3);
  const blocks = t.findBubbleText(img.data, img.width, img.height);
  assert.equal(blocks.length, 2, JSON.stringify(blocks.map(b => [b.x, b.y, b.width, b.height])));
  const [a, b] = blocks.sort((p, q) => p.x - q.x);
  assert.ok(a.layout.x + a.layout.width <= b.layout.x, 'layouts are disjoint');
});

test('findPanels finds panels separated by white gutters', () => {
  const img = page(600, 500, [255, 255, 255]);
  const random = rng(3);
  for (const [x0, y0, w, h] of [[20, 20, 560, 220], [20, 260, 270, 220], [310, 260, 270, 220]]) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const edge = x < x0 + 3 || y < y0 + 3 || x >= x0 + w - 3 || y >= y0 + h - 3;
      set(img, x, y, edge ? [0, 0, 0] : [Math.round(100 + random() * 100), 120, 140]);
    }
  }
  const panels = t.findPanels(img.data, img.width, img.height);
  assert.equal(panels.length, 3, JSON.stringify(panels));
  for (const p of panels) assert.ok(p.width < 580 && p.height < 240, JSON.stringify(p));
});

test('a grey bubble crossed by light streaks is found around a model box', () => {
  const img = page(400, 300, [60, 60, 70]);
  ellipse(img, 200, 150, 120, 80, [175, 175, 178], [20, 20, 20]);
  // Translucent bubbles show the art's light streaks through them.
  for (let y = 70; y < 230; y++) for (let x = 80; x < 320; x++) {
    if ((x + y) % 40 < 3 && ((x - 200) / 120) ** 2 + ((y - 150) / 80) ** 2 < 1) set(img, x, y, [215, 215, 218]);
  }
  glyphs(img, 150, 120, 6, 3, [15, 15, 15]);
  const found = t.findBubbleAround(img, {x: 148, y: 118, width: 98, height: 62}, []);
  assert.ok(found.length >= 1, 'grey bubble found');
  const b = found[0];
  assert.ok(b.x <= 152 && b.x + b.width >= 240 && b.y <= 122 && b.y + b.height >= 175, JSON.stringify([b.x, b.y, b.width, b.height]));
});

test('light lettering in a solid dark bubble is found inverted and lettered light', () => {
  const img = page(400, 300, [200, 200, 200]);
  ellipse(img, 200, 150, 120, 80, [10, 10, 10], [255, 255, 255]);
  glyphs(img, 150, 120, 6, 3, [245, 245, 245]);
  const found = t.findBubbleAround(img, {x: 148, y: 118, width: 98, height: 62}, []);
  assert.ok(found.length >= 1);
  assert.equal(found[0].inverted, true);
  assert.ok(parseInt(found[0].erase.color.slice(1, 3), 16) > 200, found[0].erase.color);
});

test('painted SFX on busy artwork is picked out by its colour and cleaned', () => {
  const random = rng(11);
  const img = page(220, 120, [0, 0, 0]);
  // Painterly greens and browns, no dominant colour.
  for (let y = 0; y < 120; y++) for (let x = 0; x < 220; x++) {
    const k = ((x >> 3) + (y >> 3) * 3 + Math.floor(random() * 2)) % 4;
    set(img, x, y, [[40, 90, 70], [80, 120, 90], [110, 90, 60], [30, 60, 50]][k]);
  }
  glyphs(img, 60, 45, 6, 1, [235, 160, 60]);
  const plan = t.planLooseErase(img, {x: 58, y: 43, width: 98, height: 20});
  assert.ok(plan, 'orange lettering on busy art is cleanable');
  let hit = 0, total = 0, extra = 0;
  for (let y = 0; y < 120; y++) for (let x = 0; x < 220; x++) {
    const i = y * 220 + x, p = i * 4, orange = img.data[p] === 235 && img.data[p + 1] === 160;
    if (orange) { total++; if (plan.mask[i]) hit++; } else if (plan.mask[i] && (y < 35 || y > 75)) extra++;
  }
  assert.equal(hit, total, 'every stroke pixel is cleaned');
  assert.equal(extra, 0, 'artwork away from the text is untouched');
  assert.equal(plan.outline, null);
});

test('loose lettering gets an outline only when the original had one', () => {
  const plain = page(160, 70, [150, 150, 150]);
  glyphs(plain, 30, 25, 5, 1, [20, 20, 20]);
  assert.equal(t.planLooseErase(plain, {x: 28, y: 23, width: 80, height: 20}).outline, null);
  // Letters spaced a little wider, with a white rim two pixels wide.
  const letters = page(160, 70, [150, 150, 150]), rimmed = page(160, 70, [150, 150, 150]);
  const spaced = img => { for (let k = 0; k < 4; k++) glyphs(img, 30 + k * 22, 25, 1, 1, [20, 20, 20]); };
  spaced(letters);
  for (let y = 0; y < 70; y++) for (let x = 0; x < 160; x++) {
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < 160 && yy < 70 && letters.data[(yy * 160 + xx) * 4] === 20) { near = true; break; }
    }
    if (near) set(rimmed, x, y, [255, 255, 255]);
  }
  spaced(rimmed);
  const plan = t.planLooseErase(rimmed, {x: 28, y: 23, width: 80, height: 20});
  assert.ok(plan && plan.outline, 'outline found');
  assert.ok(parseInt(plan.outline.slice(1, 3), 16) > 200, plan.outline);
});

test('sparkles in another colour beside an SFX are not erased with it', () => {
  const img = page(200, 100, [40, 90, 80]);
  glyphs(img, 60, 40, 5, 1, [240, 190, 60]);
  // White sparkles just left of and above the lettering.
  const sparkles = [[45, 35], [52, 62], [70, 28]];
  for (const [cx, cy] of sparkles) for (let d = -3; d <= 3; d++) { set(img, cx + d, cy, [255, 255, 255]); set(img, cx, cy + d, [255, 255, 255]); }
  const plan = t.planLooseErase(img, {x: 58, y: 38, width: 82, height: 20});
  assert.ok(plan);
  for (const [cx, cy] of sparkles) assert.ok(!plan.mask[cy * 200 + cx], `sparkle at ${cx},${cy} kept`);
  assert.ok(plan.mask[48 * 200 + 61], 'lettering cleaned');
});

test('the blurred dots of an ellipsis after an SFX are erased, a sparkle of the art is not', () => {
  const img = page(200, 100, [50, 35, 45]);
  glyphs(img, 60, 40, 5, 1, [200, 225, 235]);
  // Dots part-way from the background to the letters' colour, as a blurred dot is.
  const dots = [[143, 50], [150, 50], [157, 50]], sparkle = [100, 32];
  for (const [cx, cy] of dots) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(img, cx + x, cy + y, [155, 168, 178]);
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(img, sparkle[0] + x, sparkle[1] + y, [230, 210, 90]);
  const plan = t.planLooseErase(img, {x: 58, y: 38, width: 104, height: 20});
  assert.ok(plan);
  for (const [cx, cy] of dots) assert.ok(plan.mask[cy * 200 + cx], `dot at ${cx},${cy} erased`);
  assert.ok(!plan.mask[sparkle[1] * 200 + sparkle[0]], 'sparkle kept');
});

test('an artwork outline touching the first letter is cut off where it leaves the line of text', () => {
  const img = page(260, 160, [70, 60, 90]);
  glyphs(img, 70, 70, 8, 1, [225, 240, 250]);
  // A thin light curve (a bottle's outline) rising from the first glyph far above the line.
  for (let y = 10; y < 72; y++) { const x = 72 - Math.round((72 - y) * 0.3); set(img, x, y, [225, 240, 250]); set(img, x + 1, y, [225, 240, 250]); }
  const plan = t.planLooseErase(img, {x: 68, y: 66, width: 130, height: 24});
  assert.ok(plan);
  assert.ok(plan.mask[78 * 260 + 71], 'first glyph cleaned');
  assert.ok(!plan.mask[20 * 260 + 57], 'the outline far above the text is kept');
});

test('inpainting rebuilds texture, not a flat smear', () => {
  const random = rng(5);
  const w = 120, h = 80, img = page(w, h, [0, 0, 0]);
  for (let i = 0; i < w * h; i++) { const v = 120 + Math.round((random() - 0.5) * 40); img.data.set([v, v, v, 255], i * 4); }
  const mask = new Uint8Array(w * h);
  for (let y = 30; y < 50; y++) for (let x = 40; x < 80; x++) mask[y * w + x] = 1;
  t.inpaint(img.data, w, h, mask);
  const inside = [];
  for (let y = 32; y < 48; y++) for (let x = 42; x < 78; x++) inside.push(img.data[(y * w + x) * 4]);
  const mean = inside.reduce((a, v) => a + v, 0) / inside.length;
  const std = Math.sqrt(inside.reduce((a, v) => a + (v - mean) ** 2, 0) / inside.length);
  assert.ok(Math.abs(mean - 120) < 6, `mean ${mean}`);
  assert.ok(std > 5, `grain kept (std ${std.toFixed(1)}; the art has about 11.5)`);
});

test('strokeStyle measures stroke weight and slant', () => {
  const w = 300, h = 200;
  const draw = (angle, thickness) => {
    const m = new Uint8Array(w * h), c = Math.cos(angle), s = Math.sin(angle);
    // Five letter-sized boxes of strokes along a line through the middle at the given angle.
    for (let k = 0; k < 5; k++) for (let u = 0; u < 30; u++) for (let v = 0; v < 30; v++) {
      if (!(u < thickness || u >= 30 - thickness || v < thickness || v >= 30 - thickness)) continue;
      const a = k * 36 - 90 + u - 15, b = v - 15;
      for (const [dx, dy] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) {
        const x = Math.round(150 + (a + dx) * c - (b + dy) * s), y = Math.round(100 + (a + dx) * s + (b + dy) * c);
        if (x >= 0 && y >= 0 && x < w && y < h) m[y * w + x] = 1;
      }
    }
    return t.strokeStyle(m, w, h);
  };
  const level = draw(0, 3), tilted = draw(-0.4, 3), heavy = draw(0, 8);
  assert.ok(Math.abs(level.angle) < 0.05, `level ${level.angle}`);
  assert.ok(Math.abs(tilted.angle + 0.4) < 0.08, `tilted ${tilted.angle}`);
  assert.ok(Math.abs(level.thickness - 3.5) <= 1.2, `thickness ${level.thickness}`);
  assert.ok(heavy.weight > level.weight * 1.8, `${heavy.weight} vs ${level.weight}`);
  assert.ok(Math.abs(level.breadth - 31) <= 3, `breadth ${level.breadth}`);
});

test('known Japanese sound effects become English SFX, misread kana included', () => {
  assert.equal(t.knownSFX('ざぶん'), 'SPLASH');
  assert.equal(t.knownSFX('ザブーン！'), 'SPLASH');
  assert.equal(t.knownSFX('さぶん'), 'SPLASH', 'a lost dakuten');
  assert.equal(t.knownSFX('どはどは'), 'GLUG GLUG', 'a lost dakuten in a repeated sound');
  assert.equal(t.knownSFX('どばどば'), 'GLUG GLUG');
  assert.equal(t.knownSFX('はらはら'), 'FLUTTER', 'a real word is not taken for another');
  assert.equal(t.knownSFX('シユウウ…'), 'FSSSH', 'big ユ for small ュ, drawn-out vowel');
  assert.equal(t.knownSFX('ぽたぽた'), 'DRIP DRIP');
  assert.equal(t.knownSFX('どばどば'), 'GLUG GLUG');
  assert.equal(t.knownSFX('ズン'), 'THUD');
  assert.equal(t.knownSFX('ありがとう'), '');
  assert.equal(t.knownSFX('BOOM'), '');
});

test('a strip of panel art between the border and a bubble is not lettering, a letter near the edge is', () => {
  // A bubble running into a panel's top-left corner: the page's white gutter and the bubble
  // join, with a thin strip of the panel's dark art left between them.
  const img = page(400, 300, [255, 255, 255]);
  for (let y = 40; y < 280; y++) for (let x = 40; x < 380; x++) {
    const bubble = (x >= 52 && x < 300 && y < 150) || (x < 52 && y >= 75 && y < 150);
    if (!bubble) set(img, x, y, [60, 80, 100]);
  }
  glyphs(img, 110, 75, 7, 2);
  const panels = [{x: 40, y: 40, width: 340, height: 240}];
  const blocks = t.findBubbleText(img.data, img.width, img.height, {panels});
  assert.equal(blocks.length, 1);
  assert.ok(blocks[0].x >= 100, `block starts at the lettering, not the strip (x ${blocks[0].x})`);
  // A letter right against the panel's edge is still lettering.
  const edge = page(400, 300, [255, 255, 255]);
  for (let y = 40; y < 280; y++) for (let x = 40; x < 380; x++) if (!(x >= 220 && y >= 80 && y < 160)) set(edge, x, y, [60, 80, 100]);
  glyphs(edge, 271, 105, 7, 1);
  const [b] = t.findBubbleText(edge.data, edge.width, edge.height, {panels});
  assert.ok(b && b.x + b.width >= 378, `last glyph by the edge kept (${b && [b.x, b.width]})`);
});

test('chained bubbles whose paper joins become one block per bubble', () => {
  const img = page(500, 300, [90, 60, 90]);
  ellipse(img, 170, 100, 130, 45, [210, 215, 225]);
  ellipse(img, 330, 165, 70, 40, [210, 215, 225]);
  glyphs(img, 80, 90, 10, 1);   // the first bubble's line
  glyphs(img, 310, 140, 3, 1);  // the second bubble's, off to the right and lower
  const blocks = t.findBubbleText(img.data, img.width, img.height, {paper: 180, tint: [210, 215, 225]});
  assert.equal(blocks.length, 2, JSON.stringify(blocks.map(b => [b.x, b.y, b.width, b.height])));
  // Lines of one bubble, centred under each other, stay together.
  const one = page(400, 300, [90, 60, 90]);
  ellipse(one, 200, 150, 150, 80, [210, 215, 225]);
  glyphs(one, 120, 110, 10, 1);
  glyphs(one, 168, 140, 4, 1);
  assert.equal(t.findBubbleText(one.data, one.width, one.height, {paper: 180, tint: [210, 215, 225]}).length, 1);
});

test('white lettering in a black rim on busy artwork is found by its outline', () => {
  const random = rng(17);
  const img = page(240, 140, [0, 0, 0]);
  // Busy art, with white splashes of its own (not outlined) beside the text.
  for (let y = 0; y < 140; y++) for (let x = 0; x < 240; x++) {
    const k = ((x >> 2) + (y >> 3) * 5 + Math.floor(random() * 3)) % 5;
    set(img, x, y, [[120, 60, 110], [80, 90, 140], [160, 120, 150], [100, 140, 170], [70, 50, 80]][k]);
  }
  for (let y = 20; y < 120; y++) for (let x = 10; x < 30; x++) if (random() < 0.5) set(img, x, y, [250, 250, 250]);
  const letters = page(240, 140, [0, 0, 0]);
  for (let k = 0; k < 4; k++) glyphs(letters, 70 + k * 24, 60, 1, 1, [255, 255, 255]);
  for (let y = 0; y < 140; y++) for (let x = 0; x < 240; x++) {
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < 240 && yy < 140 && letters.data[(yy * 240 + xx) * 4] === 255) { near = true; break; }
    }
    if (near) set(img, x, y, [25, 25, 28]);
  }
  for (let k = 0; k < 4; k++) glyphs(img, 70 + k * 24, 60, 1, 1, [245, 245, 248]);
  const plan = t.planLooseErase(img, {x: 66, y: 56, width: 94, height: 24});
  assert.ok(plan, 'outlined lettering is cleanable');
  assert.ok(parseInt(plan.color.slice(1, 3), 16) > 220 && plan.outline && parseInt(plan.outline.slice(1, 3), 16) < 60, `${plan.color} / ${plan.outline}`);
  assert.ok(plan.mask[61 * 240 + 71], 'letter cleaned');
  let splash = 0;
  for (let y = 20; y < 120; y++) for (let x = 10; x < 30; x++) if (plan.mask[y * 240 + x]) splash++;
  assert.equal(splash, 0, 'the white splashes are left alone');
});

test('bubbles chained side by side are split where one line runs from one into the other', () => {
  // Left bubble: one line. Right bubble: three centred lines, its first on the same row as the
  // left bubble's line.
  const img = page(560, 260, [90, 60, 90]);
  ellipse(img, 150, 70, 130, 40, [210, 215, 225]);
  ellipse(img, 400, 110, 120, 85, [210, 215, 225]);
  glyphs(img, 40, 60, 11, 1);       // x 40..216
  glyphs(img, 336, 60, 7, 1);       // x 336..444, the right bubble's first line
  glyphs(img, 336, 90, 7, 1);
  glyphs(img, 352, 120, 5, 1);
  const blocks = t.findBubbleText(img.data, img.width, img.height, {paper: 180, tint: [210, 215, 225]});
  assert.equal(blocks.length, 2, JSON.stringify(blocks.map(b => [b.x, b.y, b.width, b.height])));
  // One bubble with a space in its first line and the next lines centred under the whole line
  // stays one block.
  const one = page(560, 260, [90, 60, 90]);
  ellipse(one, 280, 120, 220, 90, [210, 215, 225]);
  glyphs(one, 120, 70, 5, 1);
  glyphs(one, 216, 70, 10, 1);      // a word gap at 196..216
  glyphs(one, 176, 100, 9, 1);
  glyphs(one, 208, 130, 5, 1);
  assert.equal(t.findBubbleText(one.data, one.width, one.height, {paper: 180, tint: [210, 215, 225]}).length, 1);
});

test('a long mark under the text (a window bar through a translucent bubble) does not join the block', () => {
  const img = page(400, 300, [90, 110, 100]);
  ellipse(img, 200, 110, 120, 70, [225, 235, 220]);
  for (let y = 90; y < 280; y++) for (let x = 0; x < 400; x++) if (y > 160 && ((x - 200) / 120) ** 2 + ((y - 110) / 70) ** 2 > 1) set(img, x, y, [235, 240, 225]);
  glyphs(img, 140, 80, 7, 2);
  for (let y = 132; y < 200; y++) for (let x = 196; x < 204; x++) set(img, x, y, [70, 80, 70]);
  const blocks = t.findBubbleText(img.data, img.width, img.height, {paper: 200, tint: [225, 235, 220]});
  assert.ok(blocks.length >= 1);
  const b = blocks.find(k => k.x < 160 && k.x + k.width > 230);
  assert.ok(b && b.y + b.height < 140, JSON.stringify(blocks.map(k => [k.x, k.y, k.width, k.height])));
});

test('cleanReading joins lines the model kept apart', () => {
  assert.equal(t.cleanReading('ごめん\nもうすぐリアが\n切れそう', 40, t.languageInfo('Japanese')), 'ごめんもうすぐリアが切れそう');
  assert.equal(t.cleanReading('Hello\nthere', 40, t.languageInfo('English')), 'Hello there');
});

test('specks and a bubble tail under chained side-by-side bubbles do not stop the split', () => {
  const img = page(560, 260, [90, 60, 90]);
  ellipse(img, 150, 70, 130, 40, [210, 215, 225]);
  ellipse(img, 400, 110, 120, 85, [210, 215, 225]);
  glyphs(img, 40, 60, 11, 1);
  glyphs(img, 336, 60, 7, 1);
  glyphs(img, 336, 90, 7, 1);
  glyphs(img, 352, 120, 5, 1);
  // A one-pixel speck left of the second line, and two small tail marks under the lettering.
  for (let x = 300; x < 306; x++) set(img, x, 96, [40, 30, 40]);
  for (let y = 160; y < 164; y++) for (let x = 380; x < 386; x++) set(img, x, y, [40, 30, 40]);
  for (let y = 163; y < 167; y++) for (let x = 387; x < 393; x++) set(img, x, y, [40, 30, 40]);
  const blocks = t.findBubbleText(img.data, img.width, img.height, {paper: 180, tint: [210, 215, 225]});
  assert.equal(blocks.length, 2, JSON.stringify(blocks.map(b => [b.x, b.y, b.width, b.height])));
});

test('a reading does not start with the end of a neighbouring bubble line', () => {
  const ja = {script: 'cjk'};
  assert.equal(t.cleanReading("!'くっ！そんなに", 8, ja), 'くっ！そんなに');
  assert.equal(t.cleanReading('…これで', 3, ja), '…これで', 'a leading ellipsis is lettering');
});

test('chained bubbles stacked with one end lining up by chance are still split', () => {
  // Four lines centred on one middle, then two lines centred well to the left of it after a
  // wider gap; the last line of the first bubble and the first of the second end together.
  const img = page(500, 300, [90, 110, 150]);
  ellipse(img, 234, 90, 150, 75, [250, 250, 250]);
  ellipse(img, 210, 175, 110, 45, [250, 250, 250]);
  glyphs(img, 180, 50, 7, 1);       // x 180..288, centre 234
  glyphs(img, 188, 72, 6, 1);       // x 188..280, centre 234
  glyphs(img, 164, 94, 9, 1);       // x 164..304, centre 234
  glyphs(img, 188, 116, 6, 1);      // x 188..280, centre 234
  glyphs(img, 156, 148, 8, 1);      // x 156..280: ends with the line above, centre 218
  glyphs(img, 172, 170, 6, 1);      // x 172..264, centre 218
  const blocks = t.findBubbleText(img.data, img.width, img.height);
  assert.equal(blocks.length, 2, JSON.stringify(blocks.map(b => [b.x, b.y, b.width, b.height])));
});

test('a letter at the edge of a borderless bubble, touching the dark art through its anti-aliasing, is kept', () => {
  const img = page(400, 300, [55, 50, 60]);
  ellipse(img, 200, 150, 150, 60, [250, 250, 250]);
  glyphs(img, 238, 142, 7, 1);   // the last glyph is x 334..346, the bubble's edge about x 348
  for (let y = 143; y < 146; y++) for (let x = 346; x < 352; x++) set(img, x, y, [125, 120, 130]);
  const blocks = t.findBubbleText(img.data, img.width, img.height);
  assert.equal(blocks.length, 1);
  assert.ok(blocks[0].x + blocks[0].width >= 345, `last glyph kept (${blocks[0].x}+${blocks[0].width})`);
  const plan = blocks[0].erase, part = crop(img, plan);
  t.applyErase(part, plan);
  for (const [x, y] of [[335, 150], [344, 150], [340, 143]]) assert.ok(lumAt(part, (y - plan.y) * plan.width + x - plan.x) > 220, `glyph erased at ${x},${y}`);
});

test('a splash of art near the lettering colour, half inside the text box, is not erased with it', () => {
  const img = page(240, 120, [40, 90, 80]);
  glyphs(img, 100, 50, 5, 1, [221, 170, 61]);
  // A paler yellow splash left of the lettering, overlapping the box's left part, plus a faint
  // glow below the line that is not lettering.
  ellipse(img, 76, 58, 14, 12, [190, 183, 119]);
  ellipse(img, 120, 79, 24, 4, [95, 135, 110]);
  const plan = t.planLooseErase(img, {x: 80, y: 46, width: 100, height: 24});
  assert.ok(plan);
  assert.ok(plan.mask[58 * 240 + 101], 'lettering cleaned');
  assert.ok(!plan.mask[58 * 240 + 70] && !plan.mask[58 * 240 + 84], 'the splash is kept');
  assert.ok(!plan.mask[80 * 240 + 120], 'the glow is kept');
  const [r, g] = [parseInt(plan.color.slice(1, 3), 16), parseInt(plan.color.slice(3, 5), 16)];
  assert.ok(r - g > 30, `lettering colour is the orange, not the splash (${plan.color})`);
});

test('cleanTranslation: one line, no full stop after a sound effect, no dangling comma', () => {
  assert.equal(t.cleanTranslation('My aura\n’s weak', 'オーラ', false), 'My aura’s weak');
  assert.equal(t.cleanTranslation('SPLASH.', 'ざぶん', true), 'SPLASH');
  assert.equal(t.cleanTranslation('Wait...', 'まって…', true), 'Wait...');
  assert.equal(t.cleanTranslation('Be quiet,', 'おとなしく して', false), 'Be quiet');
  assert.equal(t.cleanTranslation('If we hurry,', '急げば、', false), 'If we hurry,', 'the original runs on');
});
