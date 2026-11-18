"""Renderiza um modelo 3D (glb) em sprites isométricos de 8 direções.

Uso: veja tools/sprites/README.md (Blender como módulo Python: `pip install bpy`).
    SPRITE_CFG=tools/sprites/tormenta.json python tools/sprites/render_sprites.py

Câmera: ortográfica, isométrica 2:1 (igual aos tiles 64x32 do jogo).
Direções: 0=S (para baixo na tela), 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW.
Saída: <out>/<nome>.png + <nome>.json (atlas do Phaser) e <out_json>/<nome>.json (animações, âncora).
"""
import json, math, os, sys, tempfile
import bpy
from mathutils import Vector

ISO_ELEV = math.atan(0.5)  # 26.565° -> losango 2:1


def load_cfg():
    p = os.environ.get('SPRITE_CFG')
    if not p and '--' in sys.argv:
        p = sys.argv[sys.argv.index('--') + 1]
    with open(p) as f:
        cfg = json.load(f)
    base = os.path.dirname(os.path.abspath(p))
    for k in ('model', 'out', 'out_json', 'dir'):
        if k in cfg and not os.path.isabs(cfg[k]):
            cfg[k] = os.path.normpath(os.path.join(base, cfg[k]))
    return cfg


def setup_scene(cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if cfg.get('model'):
        bpy.ops.import_scene.gltf(filepath=cfg['model'])
    if cfg.get('build'):
        cfg['build']()  # objetos gerados por script (cidade: casas, lanternas...)
    sc = bpy.context.scene
    keep = cfg.get('keep')
    for o in list(bpy.data.objects):
        hide = o.name in cfg.get('hide', []) or (o.type == 'MESH' and keep is not None and o.name not in keep)
        if o.type == 'EMPTY' and not o.children:
            hide = True
        o.hide_render = hide
    for name, rgb in cfg.get('recolor', {}).items():
        rgb = [(v / 255.0) ** 2.2 for v in rgb]  # cores do JSON em sRGB 0-255
        m = bpy.data.materials.get(name)
        if m and m.use_nodes:
            bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf:
                for l in list(bsdf.inputs['Base Color'].links):
                    m.node_tree.links.remove(l)
                bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    if cfg.get('texture'):
        retexture(cfg['texture'])
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    for a in cfg.get('attach', []):
        attach(a, arm)
    # raiz que gira para as 8 direções
    root = bpy.data.objects.new('SpriteRoot', None)
    sc.collection.objects.link(root)
    for o in bpy.data.objects:
        if o.parent is None and o is not root:
            o.parent = root
    root.scale = (cfg.get('model_scale', 1.0),) * 3

    # câmera ortográfica isométrica
    cam_data = bpy.data.cameras.new('Cam'); cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('Cam', cam_data); sc.collection.objects.link(cam)
    sc.camera = cam
    az = math.radians(45)
    d = 50
    cdir = Vector((math.sin(az) * math.cos(ISO_ELEV), -math.cos(az) * math.cos(ISO_ELEV), math.sin(ISO_ELEV)))
    cam.location = cdir * d
    cam.rotation_euler = (math.pi / 2 - ISO_ELEV, 0, az)
    w, h = cfg['frame']
    ppu = cfg['px_per_unit'] * cfg.get('render_scale', 2)
    rw, rh = w * cfg.get('render_scale', 2), h * cfg.get('render_scale', 2)
    cam_data.ortho_scale = max(rw, rh) / ppu
    # âncora (pés) em (ax, ay) do quadro: desloca a câmera
    ax, ay = cfg['anchor']
    cam_data.shift_x = (0.5 - ax / w) * (rw / max(rw, rh))
    cam_data.shift_y = (ay / h - 0.5) * (rh / max(rw, rh))
    cam_data.clip_end = 200

    sc.render.resolution_x, sc.render.resolution_y = rw, rh
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.engine = 'BLENDER_EEVEE'
    try:
        sc.eevee.taa_render_samples = cfg.get("samples", 8)
    except Exception:
        pass
    # Cycles na CPU é bem mais rápido que o Eevee sem placa de vídeo (e igual em qualidade aqui)
    if cfg.get('engine', 'CYCLES') == 'CYCLES':
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = cfg.get('samples', 32)
        sc.cycles.use_denoising = cfg.get('denoise', True)
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
        sc.cycles.max_bounces = 2
    sc.view_settings.view_transform = 'Standard'

    # luz fixa em relação à câmera (não gira com o modelo): sol de cima-esquerda + ambiente
    world = bpy.data.worlds.new('W'); sc.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (1, 1, 1, 1)
    bg.inputs['Strength'].default_value = cfg.get('ambient', 0.9)
    sun_d = bpy.data.lights.new('Sun', 'SUN'); sun_d.energy = cfg.get('sun', 3.0); sun_d.angle = math.radians(10)
    sun = bpy.data.objects.new('Sun', sun_d); sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(40), 0, az - math.radians(60))
    return sc, arm, root


def retexture(t):
    """Recolore blocos da paleta (texturas estilo KayKit: grade de blocos em degradê).
    t = {"image": nome, "grid": [colunas, linhas], "cells": {"col,row": [r,g,b] 0-255}}; mantém o degradê do bloco."""
    import numpy as np
    img = bpy.data.images[t['image']]
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)  # origem embaixo
    gx, gy = t.get('grid', [8, 4]); cw, ch = w // gx, h // gy
    for key, rgb in t['cells'].items():
        c, r = map(int, key.split(','))
        y0 = h - (r + 1) * ch
        blk = px[y0:y0 + ch, c * cw:(c + 1) * cw, :3]
        lum = blk.mean(axis=2, keepdims=True)
        ref = np.percentile(lum, 70) or 1
        tgt = (np.array(rgb, dtype=np.float32) / 255.0) ** 2.2  # sRGB -> linear aprox.
        px[y0:y0 + ch, c * cw:(c + 1) * cw, :3] = np.clip(tgt * (lum / ref), 0, 1)
    img.pixels[:] = px.ravel()
    img.update()
    img.pack()


def srgb(rgb):
    return tuple((v / 255.0) ** 2.2 for v in rgb) + (1,)


def make_fan(a):
    """Leque de qi plissado (gerado aqui; nenhum pacote CC0 tem um): varetas + papel em zigue-zague."""
    import bmesh
    r0, r1 = a.get('inner', 0.05), a.get('radius', 0.4)
    n = a.get('pleats', 12); span = math.radians(a.get('angle', 150)); depth = a.get('pleat', 0.025)
    me = bpy.data.meshes.new('Fan'); bm = bmesh.new()
    paper, rib = bpy.data.materials.new('FanPaper'), bpy.data.materials.new('FanRib')
    for m, c in ((paper, a.get('color', [200, 230, 250])), (rib, a.get('rib', [90, 110, 140]))):
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = srgb(c)
    me.materials.append(paper); me.materials.append(rib)
    ring = []
    for i in range(n * 2 + 1):  # 2 vértices por prega (dobra para fora / para dentro)
        t = -span / 2 + span * i / (n * 2)
        z = depth if i % 2 else 0.0
        ring.append((bm.verts.new((math.sin(t) * r0, math.cos(t) * r0, z * 0.2)),
                     bm.verts.new((math.sin(t) * r1, math.cos(t) * r1, z))))
    for i in range(len(ring) - 1):
        f = bm.faces.new((ring[i][0], ring[i][1], ring[i + 1][1], ring[i + 1][0])); f.material_index = 0
    # varetas (lâminas finas nas dobras de fora) e cabo
    w = 0.012
    for i in range(0, len(ring), 2):
        t = -span / 2 + span * i / (n * 2)
        dx, dy = math.cos(t) * w, -math.sin(t) * w
        v = [bm.verts.new((sx * r * math.sin(t) + k * dx, r * math.cos(t) + k * dy, -0.006))
             for r, k in ((0, -1), (r1 * 0.98, -1), (r1 * 0.98, 1), (0, 1)) for sx in (1,)]
        f = bm.faces.new(v); f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons:
        poly.use_smooth = False
    o = bpy.data.objects.new('Fan', me)
    o.modifiers.new('Solid', 'SOLIDIFY').thickness = 0.006
    return o


def _mat(name, rgb):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = srgb(rgb)
    bsdf.inputs['Roughness'].default_value = 0.9
    return m


def make_hat(a):
    """Chapéu de palha cônico (douli): cone baixo e largo + aba levemente caída. Eixo vertical = Y do osso."""
    import bmesh
    r, hgt, n = a.get('radius', 0.6), a.get('height', 0.3), 24
    me = bpy.data.meshes.new('Hat'); bm = bmesh.new()
    me.materials.append(_mat('HatStraw', a.get('color', [196, 164, 98])))
    me.materials.append(_mat('HatBand', a.get('band', [110, 80, 45])))
    tip = bm.verts.new((0, hgt, 0))
    ring = [bm.verts.new((math.cos(2 * math.pi * i / n) * r, -0.04, math.sin(2 * math.pi * i / n) * r)) for i in range(n)]
    mid = [bm.verts.new((math.cos(2 * math.pi * i / n) * r * 0.55, hgt * 0.45, math.sin(2 * math.pi * i / n) * r * 0.55)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((tip, mid[j], mid[i])).material_index = 0
        f = bm.faces.new((mid[i], mid[j], ring[j], ring[i])); f.material_index = 0
    band = [bm.verts.new((math.cos(2 * math.pi * i / n) * r * 0.58, hgt * 0.38, math.sin(2 * math.pi * i / n) * r * 0.58)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((band[i], band[j], mid[j], mid[i])).material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Hat', me)
    o.modifiers.new('Solid', 'SOLIDIFY').thickness = 0.02
    return o


def make_mask(a):
    """Lenço cobrindo boca e nariz: faixa curva na frente do rosto + ponta triangular caindo no peito.
    Eixo vertical = Y do osso; frente = +Z (ajuste com rot se o modelo olhar para outro lado)."""
    import bmesh
    r, hgt, n = a.get('radius', 0.45), a.get('height', 0.22), 16
    span = math.radians(a.get('angle', 230))
    me = bpy.data.meshes.new('Mask'); bm = bmesh.new()
    me.materials.append(_mat('MaskCloth', a.get('color', [90, 78, 66])))
    lo, hi = [], []
    for i in range(n + 1):
        t = -span / 2 + span * i / n
        x, z = math.sin(t), math.cos(t)
        lo.append(bm.verts.new((x * r * 0.97, 0, z * r * 0.97)))
        hi.append(bm.verts.new((x * r, hgt, z * r)))
    for i in range(n):
        bm.faces.new((lo[i], lo[i + 1], hi[i + 1], hi[i]))
    # ponta do lenço na frente, caindo abaixo do queixo
    k = n // 2
    p = bm.verts.new((0, -a.get('tail', 0.22), r * 1.02))
    bm.faces.new((lo[k - 3], lo[k + 3], p)) if n >= 6 else None
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new('Mask', me)
    o.modifiers.new('Solid', 'SOLIDIFY').thickness = 0.03
    return o


def _cyl(bm, r0, r1, y0, y1, n=10, cap=True, mi=0):
    """Tronco de cone ao longo de Y (de y0 a y1), raios r0 -> r1."""
    a = [bm.verts.new((math.cos(2 * math.pi * i / n) * r0, y0, math.sin(2 * math.pi * i / n) * r0)) for i in range(n)]
    b = [bm.verts.new((math.cos(2 * math.pi * i / n) * r1, y1, math.sin(2 * math.pi * i / n) * r1)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i])).material_index = mi
    if cap:
        bm.faces.new(b[::-1]).material_index = mi
        bm.faces.new(a).material_index = mi


def make_staff(a):
    """Bastão de duas mãos (bo): haste de madeira com faixas e ponteiras de metal. Eixo = Y do osso; empunhadura perto de y=0."""
    import bmesh
    L, r = a.get('length', 1.5), a.get('radius', 0.032)
    g = a.get('grip', 0.45)  # distância da empunhadura até a ponta de baixo
    me = bpy.data.meshes.new('Staff'); bm = bmesh.new()
    me.materials.append(_mat('StaffWood', a.get('color', [120, 78, 42])))
    me.materials.append(_mat('StaffBand', a.get('band', [60, 40, 28])))
    me.materials.append(_mat('StaffCap', a.get('cap', [170, 150, 90])))
    _cyl(bm, r, r, -g, L - g, 10, True, 0)
    for y in (-g * 0.8, L * 0.5 - g, L - g - 0.12):  # faixas de pano
        _cyl(bm, r * 1.45, r * 1.45, y, y + 0.07, 10, True, 1)
    for y0, y1 in ((-g - 0.02, -g + 0.13), (L - g - 0.13, L - g + 0.02)):  # ponteiras
        _cyl(bm, r * 1.55, r * 1.55, y0, y1, 10, True, 2)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return bpy.data.objects.new('Staff', me)


def make_needles(a):
    """Agulhas finas de arremesso (count, em leque curto) presas entre os dedos. Eixo = Y do osso."""
    import bmesh
    n, L, r = a.get('count', 3), a.get('length', 0.3), a.get('radius', 0.007)
    me = bpy.data.meshes.new('Needles'); bm = bmesh.new()
    me.materials.append(_mat('NeedleSteel', a.get('color', [205, 215, 205])))
    me.materials.append(_mat('NeedleTip', a.get('tip', [90, 170, 70])))
    for i in range(n):
        t = (i - (n - 1) / 2) * math.radians(a.get('spread', 14))
        for y0, y1, r0, r1, mi in ((-0.04, L * 0.7, r, r, 0), (L * 0.7, L, r, r * 0.2, 1)):
            vs = []
            for k in range(2):
                for ang in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
                    y, rr = (y0, r0) if k == 0 else (y1, r1)
                    x, z = math.cos(ang) * rr, math.sin(ang) * rr
                    vs.append(bm.verts.new((x * math.cos(t) + y * math.sin(t), y * math.cos(t) - x * math.sin(t), z)))
            for q in range(4):
                bm.faces.new((vs[q], vs[(q + 1) % 4], vs[4 + (q + 1) % 4], vs[4 + q])).material_index = mi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return bpy.data.objects.new('Needles', me)


def attach(a, arm):
    """Objeto extra preso a um osso (ex.: leque na mão). a = {kind, bone, offset, rot (graus), scale, ...}.
    kind: fan (leque), hat (chapéu de palha), mask (lenço no rosto), staff (bastão), needles (agulhas)."""
    o = {'fan': make_fan, 'hat': make_hat, 'mask': make_mask, 'staff': make_staff, 'needles': make_needles}[a['kind']](a)
    bpy.context.scene.collection.objects.link(o)
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = a['bone']
    # parent_type BONE prende na ponta do osso; volta para a cabeça do osso + ajuste
    o.location = Vector(a.get('offset', [0, 0, 0])) - Vector((0, arm.data.bones[a['bone']].length, 0))
    o.rotation_euler = [math.radians(v) for v in a.get('rot', [0, 0, 0])]
    o.scale = (a.get('scale', 1.0),) * 3


def facing_rot(k):
    # direção 0 = de frente para a câmera; o glTF importado olha para -Y
    return math.radians(-45 + k * 45) - math.radians(-90)


def render(cfg):
    sc, arm, root = setup_scene(cfg)
    rs = cfg.get('render_scale', 2)
    w, h = cfg['frame']
    tmp = tempfile.mkdtemp()
    if arm.animation_data is None:
        arm.animation_data_create()
    rows, meta_anims = [], {}
    for anim_name, a in cfg['anims'].items():
        act = bpy.data.actions[a['action']]
        arm.animation_data.action = act
        if hasattr(arm.animation_data, 'action_slot') and act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        if 'range' in a:
            f0, f1 = f0 + a['range'][0] * (f1 - f0), f0 + a['range'][1] * (f1 - f0)
        n = a['frames']
        loop = a.get('loop', True)
        meta_anims[anim_name] = {'row': len(rows), 'frames': n, 'fps': a.get('fps', 10), 'loop': loop}
        for k in cfg.get('dir_list', range(8)):
            root.rotation_euler = (0, 0, facing_rot(k))
            files = []
            for i in range(n):
                t = i / n if loop else (i / (n - 1) if n > 1 else 0)
                fr = f0 + t * (f1 - f0)
                sc.frame_set(int(fr), subframe=fr - int(fr))
                fp = os.path.join(tmp, f'{anim_name}_{k}_{i}.png')
                sc.render.filepath = fp
                bpy.ops.render.render(write_still=True)
                files.append(fp)
            rows.append(files)
        print('ok', anim_name, flush=True)
    return rows, meta_anims, rs


def assemble(cfg, rows, meta_anims, rs):
    """Recorta o vazio de cada quadro e empacota num atlas do Phaser (JSON hash, quadros "trimmed").
    O Phaser recoloca cada quadro no tamanho original, então a âncora (pés) não muda."""
    from PIL import Image
    w, h = cfg['frame']
    fw, fh = w * rs, h * rs
    names = [a for a in meta_anims]
    pieces = []
    dirs = list(cfg.get('dir_list', range(8)))
    for anim in names:
        a = meta_anims[anim]
        for n, d in enumerate(dirs):
            for i, fp in enumerate(rows[a['row'] + n]):
                im = Image.open(fp).convert('RGBA')
                if cfg.get('outline'):
                    im = add_outline(im, tuple(cfg['outline']))
                bb = im.getchannel('A').point(lambda v: 255 if v > 4 else 0).getbbox() or (0, 0, 1, 1)
                pieces.append((f'{anim}_{d}_{i}', im.crop(bb), bb))
    sheet, frames = pack(pieces, (fw, fh))
    os.makedirs(cfg['out'], exist_ok=True)
    name = cfg['name']
    save_png(sheet, os.path.join(cfg['out'], name + '.png'), cfg.get('colors', 256))
    atlas = {'frames': frames, 'meta': {'image': name + '.png', 'size': {'w': sheet.width, 'h': sheet.height}, 'scale': '1'}}
    with open(os.path.join(cfg['out'], name + '.json'), 'w') as f:
        json.dump(atlas, f, separators=(',', ':'))
    for a in meta_anims.values():
        a.pop('row', None)
    # altura (px no jogo) do topo do quadro parado acima dos pés: posição do nome e da barra de vida
    ay = cfg['anchor'][1] * rs
    idle = [b for n, p, b in pieces if n.startswith(cfg.get('portrait', 'idle') + '_')]
    top = round((ay - min(b[1] for b in idle)) / rs) if idle else h
    meta = {'frameWidth': fw, 'frameHeight': fh, 'scale': 1 / rs, 'top': top,
            'anchor': [cfg['anchor'][0] / w, cfg['anchor'][1] / h], 'dirs': 8, 'anims': meta_anims}
    if dirs != list(range(8)):
        meta['dirList'] = dirs  # só estas direções foram renderizadas (NPC parado olha sempre para 0)
    jdir = cfg.get('out_json', cfg['out'])
    os.makedirs(jdir, exist_ok=True)
    with open(os.path.join(jdir, name + '.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    if cfg.get('portrait_png'):
        # um quadro parado, de frente, para a interface (mochila)
        im = next(p for n, p, b in pieces if n == cfg['portrait'] + '_0_0')
        im.save(os.path.join(cfg['out'], name + '_retrato.png'), optimize=True)
    print('folha', sheet.size, '->', os.path.join(cfg['out'], name + '.png'))


def save_png(im, path, colors=256):
    """Paleta de 256 cores: ~6x menor e quase igual no tamanho do jogo (0 = sem paleta)."""
    from PIL import Image
    if colors:
        im = im.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    im.save(path, optimize=True)


def pack(pieces, src_size, width=2048):
    """Empacotamento simples por prateleiras (do mais alto para o mais baixo). Máx. 4096 px."""
    from PIL import Image
    order = sorted(pieces, key=lambda p: -p[1].height)
    x = y = shelf = 0
    pos = {}
    for n, im, bb in order:
        if x + im.width > width:
            x, y, shelf = 0, y + shelf + 1, 0
        pos[n] = (x, y)
        x += im.width + 1
        shelf = max(shelf, im.height)
    H = y + shelf
    if H > 4096:
        raise SystemExit(f'atlas alto demais ({H}px): reduza quadros ou aumente a largura')
    sheet = Image.new('RGBA', (width, H), (0, 0, 0, 0))
    frames = {}
    fw, fh = src_size
    for n, im, bb in pieces:
        x, y = pos[n]
        sheet.paste(im, (x, y))
        frames[n] = {'frame': {'x': x, 'y': y, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': True,
                     'spriteSourceSize': {'x': bb[0], 'y': bb[1], 'w': im.width, 'h': im.height},
                     'sourceSize': {'w': fw, 'h': fh}}
    return sheet, frames


def add_outline(im, rgba):
    from PIL import ImageFilter
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    grown = a.filter(ImageFilter.MaxFilter(3))
    from PIL import Image
    line = Image.new('RGBA', im.size, rgba)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    out.paste(line, mask=grown)
    out.alpha_composite(im)
    return out


if __name__ == '__main__':
    c = load_cfg()
    r, m, s = render(c)
    assemble(c, r, m, s)
