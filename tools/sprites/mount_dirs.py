"""Tira de 8 direções das montarias para o giro 360° da aba Montarias (src/ui/spinView.ts), recortada do 1º quadro
parado de cada direção da folha (public/sprites/<id>.png/.json). Saída: public/sprites/<id>_montaria_dirs.png e
src/data/sprites/<id>_montaria_dirs.json {dirs, w, h}. Rodar depois de re-renderizar uma montaria:
python3 tools/sprites/mount_dirs.py"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
mounts = json.load(open(os.path.join(ROOT, 'src/data/mounts.json')))
for mid in mounts:
    js = os.path.join(ROOT, 'public/sprites', mid + '.json')
    if not os.path.exists(js):
        continue
    j = json.load(open(js))
    fr = j['frames'] if isinstance(j['frames'], dict) else {f['filename']: f for f in j['frames']}
    atlas = Image.open(os.path.join(ROOT, 'public/sprites', mid + '.png')).convert('RGBA')
    ims = []
    for d in range(8):
        f = fr[f'idle_{d}_0']
        r, s, src = f['frame'], f['spriteSourceSize'], f['sourceSize']
        im = Image.new('RGBA', (src['w'], src['h']))
        im.paste(atlas.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), (s['x'], s['y']))
        ims.append(im)
    boxes = [im.getbbox() for im in ims]
    bb = (min(b[0] for b in boxes) - 2, min(b[1] for b in boxes) - 2, max(b[2] for b in boxes) + 2, max(b[3] for b in boxes) + 2)
    fw, fh = bb[2] - bb[0], bb[3] - bb[1]
    strip = Image.new('RGBA', (fw * 8, fh))
    for i, im in enumerate(ims):
        strip.paste(im.crop(bb), (i * fw, 0))
    strip.quantize(256).save(os.path.join(ROOT, 'public/sprites', mid + '_montaria_dirs.png'), optimize=True)
    with open(os.path.join(ROOT, 'src/data/sprites', mid + '_montaria_dirs.json'), 'w') as f:
        json.dump({'dirs': 8, 'w': fw, 'h': fh}, f, indent=1)
    print(mid, strip.size)
