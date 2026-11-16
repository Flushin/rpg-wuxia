"""Cidade (marco 6): casas wuxia, portão, lanternas, estandartes e enfeites gerados por script
(nenhum pacote CC0 tem arquitetura chinesa), renderizados com a MESMA câmera e luz dos personagens.
Cerejeiras = árvore do Nature Kit da Kenney com as folhas recoloridas.

Uso: python tools/sprites/render_town.py   (Blender como módulo; veja README.md)
Saída: public/sprites/cidade.png/.json (atlas do Phaser com pivot = centro do chão do objeto).
Escala: 1 unidade = 1 tile. Eixos: +x = tile i (direita-baixo na tela), -y = tile j (esquerda-baixo).
Casas são desenhadas no jogo em fatias verticais (src/render/mapView.ts) para o personagem
passar na frente e atrás delas sem erro de profundidade.
"""
import math, os, sys, tempfile
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rsp
import render_props as rpp

HERE = os.path.dirname(os.path.abspath(__file__))
PPU = 64 / math.sqrt(2)          # px por unidade (tile 64x32)
ZPX = PPU * math.cos(math.atan(0.5))  # px por unidade de altura na tela

# paleta
PLASTER = (236, 228, 210)
STONE = (168, 164, 156)
STONE_D = (128, 124, 118)
RED = (168, 42, 36)
WOOD = (92, 58, 40)
WOOD_D = (58, 38, 30)
SLATE = (66, 74, 88)
GOLD = (214, 172, 64)

_mats = {}


def mat(rgb, rough=0.8, emit=0.0):
    key = (rgb, rough, emit)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new('m%d' % len(_mats))
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rsp.srgb(rgb)
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = rsp.srgb(rgb)
        b.inputs['Emission Strength'].default_value = emit
    _mats[key] = m
    return m


def box(x, y, z, sx, sy, sz, rgb, rough=0.8, emit=0.0, rot=0.0):
    """Caixa com a base em z (não o centro)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + sz / 2))
    o = bpy.context.object
    o.scale = (sx, sy, sz)
    o.rotation_euler = (0, 0, rot)
    o.data.materials.append(mat(rgb, rough, emit))
    return o


def cyl(x, y, z, r, h, rgb, verts=12, rough=0.7, emit=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(x, y, z + h / 2))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=(x, y, z + h / 2))
    o = bpy.context.object
    o.data.materials.append(mat(rgb, rough, emit))
    return o


def sphere(x, y, z, r, rgb, sz=1.0, emit=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=r, location=(x, y, z))
    o = bpy.context.object
    o.scale = (1, 1, sz)
    o.data.materials.append(mat(rgb, 0.6, emit))
    bpy.ops.object.shade_smooth()
    return o


def roof(cx, cy, a, b, z0, hr, rgb, over=0.38, lift=0.24, n=56, ridge=True):
    """Telhado de quatro águas côncavo, com as pontas dos beirais levantadas (estilo chinês).
    a, b = meia largura em x e y das paredes; over = beiral."""
    import bmesh
    A, B = a + over, b + over
    m = min(A, B)
    bm = bmesh.new()
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            x = -A + 2 * A * i / n
            y = -B + 2 * B * j / n
            s = max(0.0, min((B - abs(y)) / m, (A - abs(x)) / m))
            z = hr * s ** 1.7
            c = (abs(x) / A) ** 6 * (abs(y) / B) ** 6
            z += lift * math.sqrt(c) * (1 - s) ** 2
            row.append(bm.verts.new((cx + x, cy + y, z0 + z)))
        grid.append(row)
    for j in range(n):
        for i in range(n):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    me = bpy.data.meshes.new('Roof')
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('Roof', me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat(rgb, 0.55))
    sol = o.modifiers.new('S', 'SOLIDIFY')
    sol.thickness = 0.07
    sol.offset = -1
    for p in me.polygons:
        p.use_smooth = True
    if ridge:
        # cumeeira com as pontas levantadas
        L = max(A, B) - m + 0.12
        top = z0 + hr
        dark = tuple(int(v * 0.7) for v in rgb)
        if A >= B:
            box(cx, cy, top - 0.03, 2 * L, 0.12, 0.1, dark)
            for sx in (-1, 1):
                e = box(cx + sx * (L + 0.02), cy, top - 0.02, 0.14, 0.1, 0.24, dark)
                e.rotation_euler = (0, sx * 0.5, 0)
        else:
            box(cx, cy, top - 0.03, 0.12, 2 * L, 0.1, dark)
            for sy in (-1, 1):
                e = box(cx, cy + sy * (L + 0.02), top - 0.02, 0.1, 0.14, 0.24, dark)
                e.rotation_euler = (-sy * 0.5, 0, 0)
    return o


def lantern(x, y, z, r=0.11, rgb=(220, 50, 40)):
    sphere(x, y, z, r, rgb, sz=1.25, emit=0.6)
    cyl(x, y, z + r * 1.2, r * 0.45, 0.04, GOLD)
    cyl(x, y, z - r * 1.3, r * 0.45, 0.04, GOLD)


def house(w, h, roof_rgb=SLATE, wall_h=1.35, hr=0.95, door='y', extras=None, wall_rgb=PLASTER):
    """Casa com base de pedra, paredes de reboco, colunas vermelhas e telhado curvo.
    Pegada w x h tiles centrada na origem. Portas/janelas nas faces visíveis (+x e -y)."""
    a, b = w / 2 - 0.45, h / 2 - 0.45
    box(0, 0, 0, w - 0.25, h - 0.25, 0.2, STONE)
    box(0, 0, 0.2, 2 * a, 2 * b, wall_h, wall_rgb)
    box(0, 0, 0.2 + wall_h - 0.16, 2 * a + 0.04, 2 * b + 0.04, 0.16, RED)  # viga
    # colunas nos cantos e no meio das faces
    for px in (-a, 0, a):
        for py in (-b, 0, b):
            if px == 0 and py == 0:
                continue
            if (px == 0 and w < 3.5) or (py == 0 and h < 3.5):
                continue
            cyl(px, py, 0.2, 0.08, wall_h, RED)
    # porta (face -y) e janelas
    if door == 'y':
        box(0, -b - 0.02, 0.2, 0.62, 0.06, 0.92, WOOD_D)
        box(0, -b - 0.05, 0.2 + 0.92, 0.74, 0.06, 0.08, RED)
        for sx in (-1, 1):
            window(sx * a * 0.6, -b - 0.02, 0.62, 'y')
        for t in ((-b * 0.45,), (b * 0.45,)) if h >= 3.5 else ((0,),):
            window(a + 0.02, t[0], 0.62, 'x')
    else:
        box(a + 0.02, 0, 0.2, 0.06, 0.62, 0.92, WOOD_D)
        box(a + 0.05, 0, 0.2 + 0.92, 0.06, 0.74, 0.08, RED)
        for sy in (-1, 1):
            window(a + 0.02, sy * b * 0.6, 0.62, 'x')
        for t in ((-a * 0.45,), (a * 0.45,)) if w >= 3.5 else ((0,),):
            window(t[0], -b - 0.02, 0.62, 'y')
    roof(0, 0, a, b, 0.2 + wall_h - 0.02, hr, roof_rgb)
    for fn in extras or []:
        fn(a, b, wall_h)


def window(x, y, z, face):
    sx, sy = (0.06, 0.5) if face == 'x' else (0.5, 0.06)
    box(x, y, z, sx, sy, 0.42, WOOD_D)
    # treliça
    for k in (-1, 0, 1):
        if face == 'x':
            box(x + 0.02, y + k * 0.12, z, 0.03, 0.03, 0.42, (190, 150, 100))
        else:
            box(x + k * 0.12, y - 0.02, z, 0.03, 0.03, 0.42, (190, 150, 100))
    if face == 'x':
        box(x + 0.02, y, z + 0.2, 0.03, 0.5, 0.03, (190, 150, 100))
    else:
        box(x, y - 0.02, z + 0.2, 0.5, 0.03, 0.03, (190, 150, 100))


# ---- enfeites das casas ----
def eave_lanterns(a, b, wh):
    for sx in (-1, 1):
        cyl(sx * a * 0.55, -b - 0.3, 0.2 + wh - 0.05, 0.01, 0.12, WOOD_D)
        lantern(sx * a * 0.55, -b - 0.3, 0.2 + wh - 0.22)


def shop_sign(rgb):
    def f(a, b, wh):
        box(0, -b - 0.06, 0.2 + wh - 0.42, 0.9, 0.05, 0.24, WOOD_D)
        box(0, -b - 0.09, 0.2 + wh - 0.39, 0.78, 0.03, 0.18, rgb)
    return f


def potion_display(a, b, wh):
    # bancada com jarros na frente da loja
    box(a * 0.1, -b - 0.55, 0, 1.2, 0.36, 0.42, WOOD)
    for k, c in enumerate([(200, 60, 60), (70, 110, 200), (200, 60, 60), (70, 110, 200)]):
        cyl(a * 0.1 - 0.45 + k * 0.3, -b - 0.55, 0.42, 0.07, 0.16, c, rough=0.3)
        cyl(a * 0.1 - 0.45 + k * 0.3, -b - 0.55, 0.58, 0.03, 0.05, (230, 220, 200))


def forge(a, b, wh):
    # chaminé, bigorna e forja com brasas
    box(-a * 0.5, b * 0.3, 0.2, 0.42, 0.42, wh + 1.25, STONE_D)
    box(a + 0.55, -b * 0.2, 0, 0.6, 0.6, 0.45, STONE_D)
    box(a + 0.55, -b * 0.2, 0.45, 0.42, 0.42, 0.04, (255, 120, 40), emit=3.0)
    box(a * 0.35, -b - 0.65, 0, 0.18, 0.14, 0.28, WOOD_D)
    box(a * 0.35, -b - 0.65, 0.28, 0.42, 0.18, 0.12, (60, 60, 66), rough=0.35)
    barrel(-a * 0.55, -b - 0.55)


def barrel(x, y):
    cyl(x, y, 0, 0.2, 0.46, WOOD, verts=14, r2=0.2)
    for z in (0.08, 0.36):
        cyl(x, y, z, 0.205, 0.04, (70, 70, 74), verts=14)


# ---- objetos soltos ----
def p_lantern_post():
    cyl(0, 0, 0, 0.05, 1.4, WOOD_D)
    box(0.18, 0, 1.36, 0.42, 0.05, 0.05, WOOD_D)
    cyl(0.32, 0, 1.15, 0.008, 0.2, WOOD_D)
    lantern(0.32, 0, 1.06, 0.13)


def p_stone_lantern():
    box(0, 0, 0, 0.42, 0.42, 0.12, STONE_D)
    cyl(0, 0, 0.12, 0.1, 0.5, STONE, verts=8)
    box(0, 0, 0.62, 0.38, 0.38, 0.28, STONE)
    box(0, 0, 0.7, 0.2, 0.4, 0.12, (255, 210, 120), emit=2.5)
    roof(0, 0, 0.15, 0.15, 0.9, 0.18, STONE_D, over=0.1, lift=0.06, n=16, ridge=False)


def p_barrel():
    barrel(0, 0)


def p_crates():
    box(0, 0, 0, 0.42, 0.42, 0.38, (170, 128, 82))
    box(0.06, 0.02, 0.38, 0.32, 0.32, 0.3, (150, 110, 70), rot=0.4)
    box(-0.32, -0.28, 0, 0.3, 0.3, 0.28, (160, 120, 76), rot=-0.3)


def p_pot_plant():
    cyl(0, 0, 0, 0.18, 0.26, (150, 80, 50), r2=0.24)
    sphere(0, 0, 0.42, 0.24, (70, 130, 70), sz=0.8)


def p_well():
    cyl(0, 0, 0, 0.5, 0.42, STONE, verts=20)
    cyl(0, 0, 0.42, 0.42, 0.02, (50, 90, 130), verts=20, rough=0.1)
    for sx in (-1, 1):
        cyl(sx * 0.45, 0, 0.4, 0.05, 0.85, WOOD_D)
    roof(0, 0, 0.42, 0.32, 1.22, 0.28, (150, 50, 40), over=0.15, lift=0.08, n=20, ridge=False)
    cyl(0, 0, 0.75, 0.04, 0.12, WOOD)


def p_incense():
    """Grande incensário de bronze no centro da praça."""
    box(0, 0, 0, 1.3, 1.3, 0.16, STONE)
    box(0, 0, 0.16, 1.0, 1.0, 0.14, STONE_D)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(sx * 0.22, sy * 0.22, 0.3, 0.05, 0.25, (110, 90, 50), rough=0.4)
    cyl(0, 0, 0.5, 0.42, 0.45, (150, 115, 55), verts=20, rough=0.35, r2=0.48)
    cyl(0, 0, 0.95, 0.46, 0.06, (120, 92, 44), verts=20, rough=0.35)
    for sx in (-1, 1):
        box(sx * 0.42, 0, 0.95, 0.06, 0.24, 0.22, (120, 92, 44))
    roof(0, 0, 0.32, 0.32, 1.15, 0.38, (120, 92, 44), over=0.06, lift=0.05, n=20, ridge=False)
    sphere(0, 0, 1.6, 0.07, GOLD)
    for k in range(3):  # varetas de incenso
        cyl(-0.12 + k * 0.12, 0.05, 1.0, 0.012, 0.35, (150, 60, 40))
        sphere(-0.12 + k * 0.12, 0.05, 1.36, 0.02, (255, 140, 60), emit=4)


def p_banner(rgb):
    def f():
        box(0, 0, 0, 0.36, 0.36, 0.12, STONE_D)
        cyl(0, 0, 0.12, 0.04, 2.3, WOOD_D)
        box(0.24, 0, 2.3, 0.56, 0.05, 0.05, WOOD_D)
        box(0.3, 0, 0.95, 0.42, 0.03, 1.32, rgb, rough=0.9)
        box(0.3, -0.02, 1.6, 0.26, 0.02, 0.26, GOLD)  # emblema
        sphere(0, 0, 2.45, 0.06, GOLD)
    return f


def p_gate_post():
    """Coluna do portão (pailou): base de pedra + coluna vermelha."""
    box(0, 0, 0, 0.5, 0.5, 0.3, STONE_D)
    cyl(0, 0, 0.3, 0.13, 2.25, RED, verts=14)
    cyl(0, 0, 2.5, 0.16, 0.08, GOLD, verts=14)


def p_gate_top():
    """Parte de cima do portão (colunas a 3 tiles uma da outra em y); fica sempre por cima do personagem."""
    L = 1.5
    box(0, 0, 2.2, 0.22, 2 * L + 0.2, 0.18, RED)
    box(0, 0, 2.55, 0.22, 2 * L - 0.1, 0.14, RED)
    box(0.12, 0, 2.28, 0.03, 1.0, 0.36, (40, 40, 48))  # placa
    box(0.14, 0, 2.36, 0.02, 0.7, 0.2, GOLD)
    roof(0, 0, 0.12, L, 2.68, 0.38, SLATE, over=0.3, lift=0.26, n=40)


def p_cart():
    """Carroça do mercador ambulante."""
    box(0, 0, 0.32, 1.3, 0.8, 0.12, WOOD)
    box(0, -0.4, 0.44, 1.3, 0.05, 0.22, WOOD)
    box(0.65, 0, 0.44, 0.05, 0.8, 0.22, WOOD)
    for sx in (-1, 1):
        o = cyl(sx * 0.32, -0.46, 0.0, 0.3, 0.08, WOOD_D, verts=16)
        o.rotation_euler = (math.pi / 2, 0, 0)
        o.location.z = 0.3
    box(0.9, 0.18, 0.3, 0.7, 0.05, 0.05, WOOD_D)
    box(0.9, -0.18, 0.3, 0.7, 0.05, 0.05, WOOD_D)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(sx * 0.6, sy * 0.36, 0.44, 0.03, 0.85, WOOD_D)
    roof(0, 0, 0.6, 0.36, 1.27, 0.22, (190, 140, 70), over=0.12, lift=0.08, n=20, ridge=False)
    for k, c in enumerate([(200, 170, 120), (120, 80, 140), (90, 140, 120)]):
        box(-0.35 + k * 0.33, 0.05, 0.44, 0.26, 0.4, 0.22 + 0.06 * k, c)


SET = {
    # nome: (função, pegada [w, h] em tiles[, escala])
    'casa_3x3': (lambda: house(3, 3), (3, 3)),
    'casa_3x3b': (lambda: house(3, 3, roof_rgb=(80, 64, 60), door='x', extras=[eave_lanterns]), (3, 3)),
    'casa_4x3': (lambda: house(4, 3, extras=[eave_lanterns]), (4, 3)),
    'casa_3x4': (lambda: house(3, 4, roof_rgb=(70, 84, 76), door='x'), (3, 4)),
    'loja_pocoes': (lambda: house(4, 3, roof_rgb=(52, 112, 86), extras=[eave_lanterns, shop_sign((180, 40, 40)), potion_display]), (4, 3)),
    'ferraria': (lambda: house(4, 3, roof_rgb=(74, 60, 54), wall_rgb=(200, 186, 160), door='y', extras=[shop_sign((60, 60, 70)), forge]), (4, 3)),
    'lanterna': (p_lantern_post, (1, 1)),
    'lanterna_pedra': (p_stone_lantern, (1, 1)),
    'barril': (p_barrel, (1, 1)),
    'caixotes': (p_crates, (1, 1)),
    'vaso': (p_pot_plant, (1, 1)),
    'poco': (p_well, (1, 1)),
    'incensario': (p_incense, (2, 2), 1.5),
    'estandarte_tormenta': (p_banner((168, 34, 38)), (1, 1)),
    'estandarte_geada': (p_banner((110, 175, 225)), (1, 1)),
    'estandarte_tita': (p_banner((196, 128, 40)), (1, 1)),
    'estandarte_vibora': (p_banner((52, 128, 70)), (1, 1)),
    'portao_coluna': (p_gate_post, (1, 1)),
    'portao_topo': (p_gate_top, (1, 4)),
    'carroca': (p_cart, (1, 1)),
}
# cerejeiras e árvores do Nature Kit (folhas recoloridas)
TREES = {
    'cerejeira': ('tree_default', {'leafsGreen': [238, 168, 190]}, 2.0),
    'cerejeira2': ('tree_oak', {'leafsGreen': [228, 150, 176]}, 2.0),
}


def frame_for(fw, fh, height=3.6):
    w = int((fw + fh) * 32 + 48)
    h = int((fw + fh) * 16 + height * ZPX + 48)
    return [w, h], [w / 2, h - (fw + fh) * 8 - 24]


def main():
    only = set(sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else None
    rs = 2
    tmp = tempfile.mkdtemp()
    shots = []
    for name, (fn, (fw, fh), *rest) in SET.items():
        if only and name not in only:
            continue
        _mats.clear()
        frame, anchor = frame_for(fw, fh)
        c = {'frame': frame, 'anchor': anchor, 'px_per_unit': PPU, 'render_scale': rs, 'samples': 10,
             'ambient': 0.9, 'sun': 3.0, 'build': fn, 'model_scale': rest[0] if rest else 1.0}
        sc, _, _ = rsp.setup_scene(c)
        fp = os.path.join(tmp, name + '.png')
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        shots.append((name, fp, anchor))
        print('ok', name, flush=True)
    for name, (model, recolor, scale) in TREES.items():
        if only and name not in only:
            continue
        frame, anchor = [160, 192], [80, 152]
        c = {'model': os.path.join(HERE, '.cache/kenney-nature', model + '.glb'), 'frame': frame, 'anchor': anchor,
             'px_per_unit': PPU, 'render_scale': rs, 'model_scale': scale, 'samples': 6, 'ambient': 0.9, 'sun': 3.0,
             'recolor': {'woodBark': [112, 78, 54], **recolor}}
        sc, _, _ = rsp.setup_scene(c)
        fp = os.path.join(tmp, name + '.png')
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        shots.append((name, fp, anchor))
        print('ok', name, flush=True)
    out = {'name': os.environ.get('TOWN_NAME', 'cidade'), 'out': os.path.join(HERE, '../../public/sprites'), 'colors': 256}
    rpp.pack(out, shots, rs)


if __name__ == '__main__':
    main()
