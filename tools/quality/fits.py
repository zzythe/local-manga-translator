# Checks the lettering of every item against the original: centred where the original sat, and
# as large as the room allows. For the Fits column of the checklist.
#   python tools/quality/fits.py [--dir=out] [page ...]
#
# For each lettered item (from <dir>/<page>.json):
#   off   how far the middle of the English is from the middle of the original lettering, as a
#         share of the original's width and height (each at least two lines of the English)
#   size  the English size against the most it was allowed (about the original lettering's size)
#   fill  the height of the English block against the original's
#   stagger  how far apart the middles of its lines are
# Fits is ✗ when the English is off-centre by more than 25 %, or smaller than 75 % of its allowed
# size while filling less than 70 % of the original's height (it could have wrapped to more,
# larger lines). ~ for more than 15 % off-centre, under 85 % of the allowed size, or lines
# staggered by more than half the size.
import os, json, sys

base = os.path.dirname(os.path.abspath(__file__))
d = next((a[6:] for a in sys.argv[1:] if a.startswith('--dir=')), 'out')
pages = [a for a in sys.argv[1:] if not a.startswith('--')] or sorted(
    f[:-4] for f in os.listdir(os.path.join(base, 'pages')) if f.endswith('.jpg'))

def verdict(r):
    if not r.get('lettered'):
        return '-', ''  # slanted sound effects are lettered along the original's axis
    x, y, w, h = r['box']
    lx, ly, lw, lh = r['lettered']
    size = r['size']
    offx = abs((lx + lw / 2) - (x + w / 2)) / max(w, 2 * size)
    offy = abs((ly + lh / 2) - (y + h / 2)) / max(h, 2 * size)
    room = r.get('room') or size
    used = size / room
    fill = lh / h
    off = max(offx, offy)
    if off > 0.25 or (used < 0.75 and fill < 0.7):
        mark = '✗'
    elif off > 0.15 or used < 0.85 or r.get('stagger', 0) > size / 2:
        mark = '~'
    else:
        mark = '✓'
    stagger = f'  stagger {r["stagger"]}' if r.get('stagger') else ''
    return mark, f'off {off:.0%}  size {size}/{room}  fill {fill:.0%}  {len(r["lines"])} lines{stagger}'

totals = {}
for page in pages:
    path = os.path.join(base, d, page + '.json')
    if not os.path.exists(path):
        continue
    log = json.load(open(path, encoding='utf8'))
    print(f'## {page}')
    for k, r in enumerate(log['readings']):
        mark, why = verdict(r)
        totals[mark] = totals.get(mark, 0) + 1
        print(f'{k + 1:>3} {mark} {why:<45} {" / ".join(r["lines"])}')
print('totals', totals)
