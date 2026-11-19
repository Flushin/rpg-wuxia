"""Bosque de Bambu Sombrio (nível 30): moitas de bambu, brotos e folhas caídas gerados por script, com a MESMA câmera
e luz dos personagens (reaproveita render_town.py, como render_ruins.py).

Uso: python tools/sprites/render_bambu.py   (Blender como módulo; veja README.md)
Saída: public/sprites/bambu.png/.json (atlas do Phaser 'props-bambu', pivot = centro do chão do objeto).
Escala: 1 unidade = 1 tile. As moitas ocupam o tile 'bamboo' (bloqueia); brotos e folhas são enfeites soltos.
"""
import math, os, random, sys, tempfile
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rsp
import render_props as rpp
import render_town as rt
from render_town import cyl, sphere

HERE = os.path.dirname(os.path.abspath(__file__))

# bambu escuro (o bosque é "sombrio"); assassinos em preto e serpentes em verde-jade claro se destacam
CANE = (70, 112, 60)
CANE_D = (46, 78, 44)
NODE = (36, 58, 34)
LEAF = (52, 96, 52)
LEAF_D = (34, 66, 40)
LEAF_Y = (120, 132, 64)


def rot(o, rx=0.0, ry=0.0, rz=0.0):
    o.rotation_euler = (rx, ry, rz)
    return o


def cane(x, y, h, r, lean_x, lean_y, col, rng):
    """Uma vara de bambu inclinada, com nós escuros e um tufo de folhas no alto."""
    seg = 0.42
    n = max(2, int(h / seg))
    for k in range(n):
        z = k * seg
        cx, cy = x + lean_x * z, y + lean_y * z
        rot(cyl(cx, cy, z, r, seg - 0.03, col, verts=8), rx=-lean_y, ry=lean_x)
        rot(cyl(cx, cy, z + seg - 0.04, r * 1.18, 0.05, NODE, verts=8), rx=-lean_y, ry=lean_x)
    # folhas finas e compridas em leque: muitas no alto, algumas no meio da vara
    for k in range(14):
        zf = h - rng.uniform(0.0, 0.7) if k < 10 else h * rng.uniform(0.45, 0.75)
        bx, by = x + lean_x * zf, y + lean_y * zf
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0.14, 0.3)
        c = LEAF if k % 2 else LEAF_D
        s = sphere(bx + math.cos(a) * d, by + math.sin(a) * d, zf, 0.14, c, sz=0.2)
        s.scale = (2.6, 0.38, 0.12)
        s.rotation_euler = (0, rng.uniform(0.2, 0.6), a)


def clump(seed, count, hmin, hmax):
    rng = random.Random(seed)
    for k in range(count):
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0.0, 0.32)
        h = rng.uniform(hmin, hmax)
        lx, ly = math.cos(a) * rng.uniform(0.02, 0.09), math.sin(a) * rng.uniform(0.02, 0.09)
        cane(math.cos(a) * d, math.sin(a) * d, h, rng.uniform(0.045, 0.06), lx, ly,
             CANE if k % 3 else CANE_D, rng)
    # folhas no chão em volta da moita
    for k in range(4):
        a = rng.uniform(0, 2 * math.pi)
        s = sphere(math.cos(a) * 0.38, math.sin(a) * 0.38, 0.02, 0.14, LEAF_D, sz=0.2)
        s.scale = (1.6, 0.8, 0.2)


def p_bambu_a():
    clump(11, 7, 2.6, 3.4)


def p_bambu_b():
    clump(23, 5, 2.0, 2.8)


def p_bambu_c():
    clump(37, 9, 2.8, 3.6)


def p_brotos():
    """Brotos de bambu (não bloqueia)."""
    rng = random.Random(5)
    for k in range(4):
        a = k * 1.6
        x, y = math.cos(a) * 0.18, math.sin(a) * 0.18
        cyl(x, y, 0, 0.05, rng.uniform(0.18, 0.34), (150, 140, 80), verts=8, r2=0.01)


def p_folhas():
    """Folhas secas caídas (não bloqueia)."""
    rng = random.Random(9)
    for k in range(7):
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(0, 0.3)
        s = sphere(math.cos(a) * d, math.sin(a) * d, 0.01, 0.09, LEAF_Y if k % 2 else LEAF_D, sz=0.15)
        s.scale = (1.8, 0.6, 0.15)
        s.rotation_euler = (0, 0, rng.uniform(0, math.pi))


SET = {
    # nome: (função, pegada [w, h] em tiles)
    'bambu_a': (p_bambu_a, (1, 1)),
    'bambu_b': (p_bambu_b, (1, 1)),
    'bambu_c': (p_bambu_c, (1, 1)),
    'brotos': (p_brotos, (1, 1)),
    'folhas': (p_folhas, (1, 1)),
}


def main():
    only = set(sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else None
    rs = 2
    tmp = tempfile.mkdtemp()
    shots = []
    for name, (fn, (fw, fh)) in SET.items():
        if only and name not in only:
            continue
        rt._mats.clear()
        frame, anchor = rt.frame_for(fw, fh, 4.0)
        c = {'frame': frame, 'anchor': anchor, 'px_per_unit': rt.PPU, 'render_scale': rs, 'samples': 10,
             'ambient': 0.9, 'sun': 3.0, 'build': fn, 'model_scale': 1.0}
        sc, _, _ = rsp.setup_scene(c)
        fp = os.path.join(tmp, name + '.png')
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        shots.append((name, fp, anchor))
        print('ok', name, flush=True)
    out = {'name': 'bambu', 'out': os.path.join(HERE, '../../public/sprites'), 'colors': 256}
    rpp.pack(out, shots, rs)


if __name__ == '__main__':
    main()
