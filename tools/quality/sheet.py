# Contact sheet of every lettered and skipped item on a page, at full resolution: for each, the
# original crop beside the translated one, with what was read and lettered. For the checklist.
#   python tools/quality/sheet.py E35P02 [--dir=out]   ->  <dir>/<page>-items.jpg
import json, sys
from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith('--')]
d = next((a[6:] for a in sys.argv[1:] if a.startswith('--dir=')), 'out')
base = 'tools/quality/'
name = args[0]
log = json.load(open(f'{base}{d}/{name}.json', encoding='utf8'))
orig = Image.open(f'{base}pages/{name}.jpg').convert('RGB')
done = Image.open(f'{base}{d}/{name}.png').convert('RGB')
try:
    font = ImageFont.truetype('C:/Windows/Fonts/YuGothM.ttc', 14)
except OSError:
    font = ImageFont.load_default()

items = [dict(r, state='lettered') for r in log['readings']] + [dict(s, state='SKIPPED: ' + s['reason']) for s in log['skipped'] if s.get('box')]
tiles = []
for k, r in enumerate(items):
    x, y, w, h = r['box']
    pad = max(24, int(max(w, h) * 0.35))
    box = (max(0, x - pad), max(0, y - pad), min(orig.width, x + w + pad), min(orig.height, y + h + pad))
    a, b = orig.crop(box), done.crop(box)
    label = f"{k + 1}. [{r.get('kind', '?')}] {r['original']}  ->  {r.get('translation', '')}  ({r['state']}"
    label += f", {r['size']}px" if r.get('size') else ''
    label += f", {r['font'].strip(chr(34))}" if r.get('font') else ''
    label += ')'
    tile = Image.new('RGB', (a.width * 2 + 10, a.height + 24), 'white')
    tile.paste(a, (0, 24)); tile.paste(b, (a.width + 10, 24))
    ImageDraw.Draw(tile).text((2, 2), label, fill='black', font=font)
    tiles.append(tile)

if tiles:
    width = max(max(t.width for t in tiles), 600)
    sheet = Image.new('RGB', (width, sum(t.height + 8 for t in tiles)), (200, 200, 200))
    y = 0
    for t in tiles:
        sheet.paste(t, (0, y)); y += t.height + 8
    sheet.save(f'{base}{d}/{name}-items.jpg', quality=88)
    print(f'{d}/{name}-items.jpg', sheet.size)
