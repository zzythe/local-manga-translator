# Full-resolution crops for inspection: original above, translated below.
#   python tools/quality/crop.py E35P02 x y w h [out.png] [--dir=out]
import sys
from PIL import Image
args = [a for a in sys.argv[1:] if not a.startswith('--')]
d = next((a[6:] for a in sys.argv[1:] if a.startswith('--dir=')), 'out')
name, x, y, w, h = args[0], *map(int, args[1:5])
base = 'tools/quality/'
o = Image.open(base + 'pages/' + name + '.jpg').convert('RGB').crop((x, y, x + w, y + h))
t = Image.open(base + d + '/' + name + '.png').convert('RGB').crop((x, y, x + w, y + h))
s = 2 if max(w, h) <= 500 else 1
both = Image.new('RGB', (w * s, h * 2 * s + 6), 'red')
both.paste(o.resize((w * s, h * s), Image.NEAREST), (0, 0)); both.paste(t.resize((w * s, h * s), Image.NEAREST), (0, h * s + 6))
both.save(args[5] if len(args) > 5 else 'C:/Windows/TEMP/claude/q/crop.png')
