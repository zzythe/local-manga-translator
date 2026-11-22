# Makes the bundled dialogue font, MLT Lettering, from Shantell Sans (SIL Open Font License 1.1):
# the ExtraBold, non-informal, no-bounce instance, cut down to the scripts the translator letters
# (Latin with Vietnamese, Cyrillic, punctuation) and condensed to 88 % width, closer to manga
# lettering and about as wide as the text fitting expects.
#   python tools/lettering-font.py <ShantellSans[BNCE,INFM,SPAC,wght].ttf> [--width=0.88] [--out=file]
# The variable font is in https://github.com/google/fonts/tree/main/ofl/shantellsans (OFL.txt there).
# Writes src/fonts/MLTLettering-ExtraBold.ttf; src/fonts/MLTLettering-OFL.txt is its licence.
import os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset
from fontTools.ttLib.tables import otBase, otTables

args = [a for a in sys.argv[1:] if not a.startswith('--')]
width = float(next((a[8:] for a in sys.argv[1:] if a.startswith('--width=')), 0.88))
if len(args) != 1:
    sys.exit('usage: python tools/lettering-font.py <ShantellSans variable font> [--width=0.88] [--out=file]')
out = next((a[6:] for a in sys.argv[1:] if a.startswith('--out=')), None) or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'fonts', 'MLTLettering-ExtraBold.ttf')

font = instancer.instantiateVariableFont(TTFont(args[0]), {'wght': 800, 'INFM': 0, 'BNCE': 0, 'SPAC': 0})

ranges = [(0x20, 0x7E), (0xA0, 0x24F), (0x259, 0x259), (0x2B0, 0x2FF), (0x300, 0x36F), (0x400, 0x52F),
          (0x1E00, 0x1EFF), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F), (0x2190, 0x21FF),
          (0x25A0, 0x25FF), (0x2600, 0x26FF)]
options = subset.Options()
options.layout_features = ['ccmp', 'locl', 'mark', 'mkmk', 'kern', 'liga', 'case']
options.name_IDs = ['*']
options.notdef_outline = True
options.drop_tables += ['STAT', 'vhea', 'vmtx']
sub = subset.Subsetter(options)
sub.populate(unicodes=[u for a, b in ranges for u in range(a, b + 1)])
sub.subset(font)

# Condense: every horizontal measure (outlines, advances, kerning, mark positions) times width.
glyf, hmtx = font['glyf'], font['hmtx']
for name in font.getGlyphOrder():
    g = glyf[name]
    if g.isComposite():
        for c in g.components:
            c.x = round(c.x * width)
    elif g.numberOfContours > 0:
        g.coordinates.scale((width, 1))
        g.coordinates.toInt()
    g.recalcBounds(glyf)
    advance, _ = hmtx[name]
    hmtx[name] = (round(advance * width), getattr(g, 'xMin', 0))

def condense(obj, seen):
    if id(obj) in seen:
        return
    seen.add(id(obj))
    if isinstance(obj, otBase.ValueRecord):
        for field in ('XPlacement', 'XAdvance'):
            if hasattr(obj, field):
                setattr(obj, field, round(getattr(obj, field) * width))
        return
    if isinstance(obj, otTables.Anchor):
        obj.XCoordinate = round(obj.XCoordinate * width)
        return
    if isinstance(obj, (list, tuple)):
        for item in obj:
            condense(item, seen)
    elif isinstance(obj, otBase.BaseTable):
        for value in vars(obj).values():
            condense(value, seen)
condense(font['GPOS'].table, set())
font['OS/2'].recalcAvgCharWidth(font)
font['OS/2'].usWidthClass = 3  # condensed

# A modified version under its own name (OFL 1.1, section 3 asks no more of Shantell Sans, which
# has no Reserved Font Name, but the name says it is not the original).
family, style = 'MLT Lettering', 'ExtraBold'
names = font['name']
names.names = [n for n in names.names if n.nameID not in (1, 2, 3, 4, 6, 16, 17, 21, 22, 25)]
for nid, text in {1: family, 2: 'Regular', 3: f'{family} {style}; condensed from Shantell Sans 1.011',
                  4: f'{family} {style}', 6: 'MLTLettering-ExtraBold', 16: family, 17: style}.items():
    names.setName(text, nid, 3, 1, 0x409)
font['OS/2'].usWeightClass = 800
font.recalcTimestamp = False  # the same file each time it is made
font.save(out)
print(f'{os.path.normpath(out)}: {os.path.getsize(out)} bytes, {len(font.getGlyphOrder())} glyphs, width {width}')
