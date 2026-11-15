"""Renderiza objetos parados do cenário (árvores, pedras, pisos) com a MESMA câmera
isométrica e a mesma luz dos personagens, e junta tudo numa folha (atlas do Phaser).

Uso: SPRITE_CFG=tools/sprites/floresta.json python tools/sprites/render_props.py
Escala: 1 unidade do modelo = 1 tile (64x32) -> 64/sqrt(2) px por unidade.
Cada quadro guarda o "pivot" (ponto do chão no centro do tile) para o Phaser.
"""
import json, math, os, sys, tempfile
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rsp

PPU_TILE = 64 / math.sqrt(2)


def main():
    cfg = rsp.load_cfg()
    rs = cfg.get('render_scale', 2)
    tmp = tempfile.mkdtemp()
    shots = []
    for name, p in cfg['props'].items():
        w, h = p.get('frame', [160, 192])
        c = {'model': os.path.join(cfg['dir'], p.get('file', name + '.glb')),
             'frame': [w, h], 'anchor': [w / 2, h - 40], 'px_per_unit': PPU_TILE, 'render_scale': rs,
             'model_scale': p.get('scale', 1.0), 'samples': cfg.get('samples', 8),
             'ambient': cfg.get('ambient', 0.9), 'sun': cfg.get('sun', 3.0),
             'recolor': {**cfg.get('recolor', {}), **p.get('recolor', {})}}
        sc, arm, root = rsp.setup_scene(c)
        root.rotation_euler = (0, 0, math.radians(p.get('rot', 0)))
        fp = os.path.join(tmp, name + '.png')
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        shots.append((name, fp, c['anchor']))
        print('ok', name, flush=True)
    pack(cfg, shots, rs)


def pack(cfg, shots, rs):
    from PIL import Image
    ims = []
    for name, fp, (ax, ay) in shots:
        im = Image.open(fp).convert('RGBA')
        bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        crop = im.crop(bb)
        px, py = ax * rs - bb[0], ay * rs - bb[1]
        ims.append((name, crop, px, py))
    # empacotamento simples por prateleiras
    ims.sort(key=lambda t: -t[1].height)
    W = 1024; x = y = shelf = 0; pos = {}
    for name, im, px, py in ims:
        if x + im.width > W:
            x, y, shelf = 0, y + shelf + 2, 0
        pos[name] = (x, y); x += im.width + 2; shelf = max(shelf, im.height)
    H = y + shelf
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    frames = {}
    for name, im, px, py in ims:
        x, y = pos[name]
        sheet.paste(im, (x, y))
        frames[name] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': False,
                        'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height},
                        'sourceSize': {'w': im.width, 'h': im.height},
                        'pivot': {'x': round(px / im.width, 4), 'y': round(py / im.height, 4)}}
    os.makedirs(cfg['out'], exist_ok=True)
    rsp.save_png(sheet, os.path.join(cfg['out'], cfg['name'] + '.png'), cfg.get('colors', 256))
    jdir = cfg.get('out_json', cfg['out']); os.makedirs(jdir, exist_ok=True)
    with open(os.path.join(jdir, cfg['name'] + '.json'), 'w') as f:
        json.dump({'frames': frames, 'meta': {'image': cfg['name'] + '.png', 'size': {'w': W, 'h': H}, 'scale': str(1 / rs)}}, f, indent=1)
    print('folha', sheet.size)


if __name__ == '__main__':
    main()
