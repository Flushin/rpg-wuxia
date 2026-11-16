"""Ruínas de Terracota e portais (marco 6): colunas quebradas, entulho, cacos, braseiros e o portal
de pedra (lua) gerados por script, com a MESMA câmera e luz dos personagens (reaproveita render_town.py).

Uso: python tools/sprites/render_ruins.py   (Blender como módulo; veja README.md)
Saída: public/sprites/ruinas.png/.json (atlas do Phaser com pivot = centro do chão do objeto).
Escala: 1 unidade = 1 tile.
"""
import math, os, sys, tempfile
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rsp
import render_props as rpp
import render_town as rt
from render_town import box, cyl, sphere, roof

HERE = os.path.dirname(os.path.abspath(__file__))

STONE = (150, 150, 146)
STONE_D = (108, 110, 112)
# Cenário em pedra fria (cinza-azulada): nada da cor de argila dos guerreiros, para os inimigos se destacarem.
LACQ = (126, 132, 140)    # fuste das colunas (pedra azulada)
LACQ_D = (92, 98, 108)
MOSS = (92, 116, 62)
BRONZE = (120, 104, 62)
GLOW = (176, 120, 255)


def rot(o, rx=0.0, ry=0.0, rz=0.0):
    o.rotation_euler = (rx, ry, rz)
    return o


def column(h, broken=False, moss=0.0, lean=0.0):
    """Coluna de laca vermelha sobre base de pedra; quebrada = topo irregular, sem capitel."""
    box(0, 0, 0, 0.62, 0.62, 0.16, STONE_D)
    box(0, 0, 0.16, 0.5, 0.5, 0.12, STONE)
    c = cyl(0, 0, 0.28, 0.17, h, LACQ, verts=14)
    rot(c, ry=lean)
    if broken:
        # pedaços tortos no topo e cacos no chão
        rot(cyl(0.02, 0, 0.28 + h - 0.02, 0.16, 0.14, LACQ_D, verts=7), rx=0.35, ry=0.2)
        rot(box(0.38, -0.1, 0, 0.2, 0.14, 0.1, LACQ_D), rz=0.6)
        rot(box(-0.3, 0.3, 0, 0.16, 0.12, 0.08, STONE_D), rz=-0.4)
    else:
        box(0, 0, 0.28 + h, 0.44, 0.44, 0.1, STONE)
        rot(box(0, 0, 0.38 + h, 0.6, 0.22, 0.16, LACQ_D), rz=math.pi / 4)
        roof(0, 0, 0.12, 0.12, 0.54 + h, 0.12, STONE_D, over=0.12, lift=0.06, n=12, ridge=False)
    if moss:
        sphere(0.22, 0.18, 0.18, 0.18 * moss, MOSS, sz=0.5)
        sphere(-0.2, 0.24, 0.14, 0.12 * moss, MOSS, sz=0.5)


def p_col_a():
    column(1.9)


def p_col_b():
    column(1.05, broken=True, moss=1.0)


def p_col_c():
    column(0.55, broken=True, moss=0.8)


def p_col_d():
    column(1.5, broken=True)


def p_rubble():
    """Monte de entulho (bloqueia)."""
    for k, (x, y, s, c) in enumerate([(0, 0, 0.5, STONE), (0.22, -0.18, 0.34, STONE_D), (-0.24, 0.16, 0.3, STONE),
                                      (0.08, 0.26, 0.24, LACQ_D), (-0.1, -0.24, 0.26, STONE_D)]):
        rot(box(x, y, 0, s, s * 0.8, s * 0.6, c), rz=0.5 * k, ry=0.15 * (k % 2))
    sphere(0.2, 0.2, 0.06, 0.14, MOSS, sz=0.5)


def p_shards():
    """Cacos de cerâmica e um vaso quebrado (não bloqueia)."""
    POT, POT_D = (96, 118, 130), (70, 88, 100)  # cerâmica azul-acinzentada (não confunde com os guerreiros)
    cyl(0, 0, 0, 0.13, 0.2, POT, verts=10, r2=0.16)
    for k in range(5):
        a = k * 1.3
        rot(box(math.cos(a) * 0.28, math.sin(a) * 0.22, 0, 0.1, 0.07, 0.02, POT_D if k % 2 else POT), rz=a)


def p_stones():
    for k, (x, y, s) in enumerate([(0, 0, 0.16), (0.2, 0.1, 0.1), (-0.18, 0.12, 0.08)]):
        rot(box(x, y, 0, s, s * 0.8, s * 0.5, STONE if k % 2 else STONE_D), rz=k)


def p_weeds():
    for k in range(6):
        a = k * 1.05
        rot(cyl(math.cos(a) * 0.05, math.sin(a) * 0.05, 0, 0.012, 0.22 + 0.06 * (k % 3), (130, 128, 70), verts=4),
            rx=math.cos(a) * 0.4, ry=math.sin(a) * 0.4)


def p_brazier():
    """Braseiro de bronze aceso (arena do General)."""
    box(0, 0, 0, 0.5, 0.5, 0.12, STONE_D)
    for sx in (-1, 1):
        for sy in (-1, 1):
            rot(cyl(sx * 0.12, sy * 0.12, 0.12, 0.025, 0.42, BRONZE, verts=6), rx=sy * 0.2, ry=-sx * 0.2)
    cyl(0, 0, 0.5, 0.26, 0.16, BRONZE, verts=16, r2=0.32)
    sphere(0, 0, 0.7, 0.18, (255, 150, 60), sz=1.3, emit=6)
    sphere(0, 0, 0.84, 0.1, (255, 220, 120), sz=1.4, emit=8)


def p_portal():
    """Portal (porta-lua): anel de pedra com um véu de luz roxa. Fica de pé ao longo do eixo y (borda do mapa)."""
    R, th = 1.25, 0.24
    box(0, 0, 0, 0.7, 3.0, 0.14, STONE_D)
    bpy.ops.mesh.primitive_torus_add(major_segments=16, minor_segments=5, major_radius=R, minor_radius=0.2,
                                     location=(0, 0, 1.5), rotation=(0, math.pi / 2, 0))
    o = bpy.context.object
    o.scale = (1.5, 1, 1)  # anel mais grosso no sentido do muro
    o.data.materials.append(rt.mat(STONE, 0.9))
    # véu de luz
    bpy.ops.mesh.primitive_circle_add(vertices=40, radius=R - 0.1, fill_type="NGON", location=(0, 0, 1.5))
    o = bpy.context.object
    o.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    o.data.materials.append(rt.mat(GLOW, 0.3, 1.6))
    sphere(0, 0, 1.5, 0.2, (240, 220, 255), sz=1.0, emit=4)
    for sy in (-1, 1):
        box(0, sy * 1.35, 0, 0.5, 0.4, 0.5, STONE_D)
        sphere(0, sy * 1.35, 0.6, 0.1, GLOW, emit=5)


SET = {
    # nome: (função, pegada [w, h] em tiles[, escala])
    'coluna_a': (p_col_a, (1, 1)),
    'coluna_b': (p_col_b, (1, 1)),
    'coluna_c': (p_col_c, (1, 1)),
    'coluna_d': (p_col_d, (1, 1)),
    'entulho': (p_rubble, (1, 1)),
    'cacos': (p_shards, (1, 1)),
    'pedras': (p_stones, (1, 1)),
    'mato_seco': (p_weeds, (1, 1)),
    'braseiro': (p_brazier, (1, 1)),
    'portal': (p_portal, (1, 3)),
}


def main():
    only = set(sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else None
    rs = 2
    tmp = tempfile.mkdtemp()
    shots = []
    for name, (fn, (fw, fh), *rest) in SET.items():
        if only and name not in only:
            continue
        rt._mats.clear()
        frame, anchor = rt.frame_for(fw, fh, 3.0)
        c = {'frame': frame, 'anchor': anchor, 'px_per_unit': rt.PPU, 'render_scale': rs, 'samples': 10,
             'ambient': 0.9, 'sun': 3.0, 'build': fn, 'model_scale': rest[0] if rest else 1.0}
        sc, _, _ = rsp.setup_scene(c)
        fp = os.path.join(tmp, name + '.png')
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        shots.append((name, fp, anchor))
        print('ok', name, flush=True)
    out = {'name': 'ruinas', 'out': os.path.join(HERE, '../../public/sprites'), 'colors': 256}
    rpp.pack(out, shots, rs)


if __name__ == '__main__':
    main()
