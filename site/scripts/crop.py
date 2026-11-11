"""Exports the site's webp crops from capture.mts output, for each appearance.

    python3 site/scripts/crop.py            # reads /tmp/margin-shots/raw/{dark,light}

Rects are in raw 2x pixels (2880x1800). Dark files keep their plain names; light ones get -light.
Every crop stops short of the bottom-right corner, where dev builds show tldraw's license notice.
"""
import os
import sys
from PIL import Image, ImageColor, ImageDraw, ImageOps

RAW = os.environ.get('SHOTS_DIR', '/tmp/margin-shots/raw')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'shots')

# name: (raw, x, y, w, h, output widths)
CROPS = {
    'sidebar': ('study', 0, 104, 440, 650, [560]),
    'add-verses': ('add-verses', 890, 330, 1100, 440, [1052]),
    'palette': ('palette', 890, 330, 1100, 800, [1052]),
    'annotations': ('study', 900, 200, 1700, 1024, [1400]),
    'focus': ('focus-verse', 440, 104, 2180, 1570, [1800]),
    'hero-mobile': ('study', 900, 200, 1700, 1024, [1000]),
    'lookup': ('lookup', 496, 828, 2328, 844, [2328]),
    'hero-study': ('study', 0, 0, 2620, 1800, [1200, 2400]),
    'hero-overview': ('overview', 0, 0, 2620, 1800, [1200, 2400]),
    'hero-focus-verse': ('focus-verse', 0, 0, 2620, 1800, [1200, 2400]),
}

for appearance in sys.argv[1:] or ['dark', 'light']:
    suffix = '' if appearance == 'dark' else '-' + appearance
    for name, (raw, x, y, w, h, widths) in CROPS.items():
        image = Image.open(os.path.join(RAW, appearance, raw + '.png')).convert('RGB').crop((x, y, x + w, y + h))
        for width in widths:
            size = (width, round(h * width / w))
            out = image.resize(size, Image.LANCZOS) if size != image.size else image
            tag = f'-{width}' if len(widths) > 1 else ''
            path = os.path.join(OUT, f'{name}{suffix}{tag}.webp')
            out.save(path, 'WEBP', quality=84, method=6)
            print(path, size)

# Social previews use the same current study, fitted so every handwritten note stays in frame.
if 'dark' in (sys.argv[1:] or ['dark', 'light']):
    study = Image.open(os.path.join(RAW, 'dark', 'study.png')).convert('RGB')
    _, x, y, w, h, _ = CROPS['hero-study']
    study = study.crop((x, y, x + w, y + h))
    draw = ImageDraw.Draw(study)
    for index, color in enumerate(['#ff5f57', '#febc2e', '#28c840']):
        left = 36 + index * 40
        ring = tuple(round(channel * 0.82) for channel in ImageColor.getrgb(color))
        draw.ellipse((left, 36, left + 23, 59), fill=ring)
        draw.ellipse((left + 1, 37, left + 22, 58), fill=color)
    study = ImageOps.contain(study, (1140, 570), Image.LANCZOS)
    social = Image.new('RGB', (1200, 630), '#141115')
    social.paste(study, ((1200 - study.width) // 2, (630 - study.height) // 2))
    for name in ['opengraph-image', 'twitter-image']:
        social.save(os.path.join(os.path.dirname(__file__), '..', 'app', name + '.png'))
