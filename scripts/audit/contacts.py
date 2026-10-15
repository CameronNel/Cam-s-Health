"""Build labelled contact sheets from only the images referenced by a case ledger."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ledger = Path(sys.argv[1]).resolve()
dest = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else ledger.parent / 'contacts'
dest.mkdir(parents=True, exist_ok=True)
data = json.loads(ledger.read_text())
items = []
seen = set()
for case in data.get('cases', []):
    for name in case.get('screenshots', []):
        path = (ledger.parent / name).resolve()
        if path in seen:
            continue
        seen.add(path)
        items.append({'file': str(path), 'id': case['id'], 'profile': case['profile'], 'mode': case['mode'], 'source': case.get('sourceHash', '')})
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
pages = []
for start in range(0, len(items), 16):
    sheet = Image.new('RGB', (856, 1920), '#101018')
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(items[start:start + 16]):
        x, y = (index % 4) * 214, (index // 4) * 480
        thumb = dest / ('thumb-' + str(start + index + 1).zfill(4) + '.jpg')
        if not thumb.exists() or thumb.stat().st_mtime < Path(item['file']).stat().st_mtime:
            with Image.open(item['file']) as original:
                picture = original.convert('RGB')
                picture.thumbnail((200, 436))
                picture.save(thumb, quality=90)
        with Image.open(thumb) as picture:
            sheet.paste(picture, (x, y))
        draw.text((x, y + 437), item['id'][:29], fill='#eee9fa', font=font)
        draw.text((x, y + 451), item['profile'] + ' ' + item['mode'], fill='#c2b4d4', font=font)
        draw.text((x, y + 465), item['source'][:8] + ' ' + Path(item['file']).stem.split('--')[-1], fill='#a49ab5', font=font)
    target = dest / ('page-' + str(start // 16 + 1).zfill(2) + '.jpg')
    sheet.save(target, quality=94)
    pages.append(str(target))
(dest / 'index.json').write_text(json.dumps({'ledger': str(ledger), 'items': items, 'pages': pages}, indent=2))
print(json.dumps({'images': len(items), 'contactPages': len(pages), 'directory': str(dest)}))
