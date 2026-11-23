"""Porto Noturno (22/11/2026, nível 50): casas de madeira escura com telhado vermelho e lanternas, lojas dos bairros
(estábulo, forja-mestre, joalheria, casa de chá, antiquário, banco), barracas do mercado noturno, postes de lanterna,
pontes dos canais, estacas do cais, juncos (barcos chineses de velas com ripas) e trechos curtos de muralha.
Tudo gerado por script com as peças de render_town.py e render_cidadela.py (mesma câmera, luz e escala), num atlas
próprio. Sem modelos de fora: nenhuma licença nova.

Uso: python tools/sprites/render_porto.py [-- nome ...]   (Blender como módulo; veja README.md)
Saída: public/sprites/porto.png/.json (no jogo: atlas 'props-porto'; objetos do mapa com a propriedade atlas).
Escala: 1 unidade = 1 tile. Eixos: +x = tile i (direita-baixo na tela), -y = tile j (esquerda-baixo).
"""
import os, sys, tempfile
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rsp
import render_props as rpp
import render_town as rt
import render_cidadela as rc
from render_town import box, cyl, sphere, roof, lantern

HERE = os.path.dirname(os.path.abspath(__file__))

# paleta: madeira escura envernizada, telhas vermelho-escuras, lanternas vermelhas e âmbar, velas cor de ferrugem
WOODW = (104, 72, 50)
WOODW_D = (70, 48, 34)
ROOF_R = (128, 44, 36)
ROOF_T = (46, 82, 92)
SAIL = (176, 84, 48)
SAIL_D = (132, 60, 36)
HULL = (84, 54, 36)
LANT = (236, 70, 40)
AMBER = (246, 170, 60)


def porto_house(w, h, door='y', roof_rgb=ROOF_R, extras=None, wall_h=1.35):
    rt.house(w, h, roof_rgb=roof_rgb, wall_h=wall_h, door=door, wall_rgb=WOODW,
             extras=[rt.eave_lanterns] + (extras or []))


def lantern_post():
    """Poste de madeira com braço e lanterna vermelha pendurada (ruas e cais do Porto)."""
    box(0, 0, 0, 0.3, 0.3, 0.12, rt.STONE_D)
    cyl(0, 0, 0.12, 0.05, 1.7, WOODW_D)
    box(0.2, 0, 1.74, 0.5, 0.05, 0.05, WOODW_D)
    cyl(0.4, 0, 1.52, 0.008, 0.22, WOODW_D)
    lantern(0.4, 0, 1.4, 0.13, LANT)


def stall_night(rgb):
    """Barraca do mercado noturno (2x2): balcão, mercadorias, toldo de pano e duas lanternas."""
    def f():
        box(0, -0.3, 0, 1.5, 0.55, 0.6, rt.WOOD)
        box(0, -0.3, 0.6, 1.6, 0.65, 0.05, WOODW_D)
        for k, c in enumerate([(220, 160, 60), (200, 70, 50), (120, 170, 90), (230, 220, 200)]):
            box(-0.54 + k * 0.36, -0.3, 0.65, 0.26, 0.3, 0.1 + 0.05 * (k % 2), c)
        rt.p_crates()
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl(sx * 0.75, sy * 0.7, 0, 0.04, 1.4 + (0.2 if sy > 0 else 0), WOODW_D)
        o = box(0, 0, 1.5, 1.7, 1.6, 0.05, rgb)
        o.rotation_euler = (-0.12, 0, 0)
        for sx in (-1, 1):
            cyl(sx * 0.6, -0.9, 1.25, 0.008, 0.16, WOODW_D)
            lantern(sx * 0.6, -0.9, 1.13, 0.1, AMBER)
    return f


def junk(sails=3, scale=1.0):
    """Junco: casco de madeira com proa baixa e popa alta, convés, cabine na popa e velas com ripas horizontais."""
    def f():
        s = scale
        L = 4.4 * s
        box(0, 0, 0, L, 1.2 * s, 0.5 * s, HULL)
        box(L / 2 - 0.3 * s, 0, 0.5 * s, 0.6 * s, 1.2 * s, 0.35 * s, HULL)  # popa alta
        box(-L / 2 + 0.2 * s, 0, 0.35 * s, 0.4 * s, 1.0 * s, 0.25 * s, HULL)
        box(0, 0, 0.5 * s, L - 0.2 * s, 1.1 * s, 0.04 * s, (150, 110, 70))  # convés
        box(L / 2 - 0.85 * s, 0, 0.54 * s, 0.8 * s, 0.8 * s, 0.45 * s, WOODW)
        roof(L / 2 - 0.85 * s, 0, 0.35 * s, 0.35 * s, 0.99 * s, 0.2 * s, ROOF_R, over=0.15, lift=0.08, n=20)
        box(0, -0.61 * s, 0.38 * s, L - 0.4 * s, 0.03, 0.08 * s, (196, 160, 60))  # friso
        for k in range(sails):
            x = (-1.3 + k * 1.1) * s
            hmast = (2.6 - 0.35 * abs(k - 1)) * s
            cyl(x, 0, 0.5 * s, 0.05 * s, hmast, WOODW_D)
            sw, sh = 1.0 * s, (hmast - 0.5 * s)
            sail = box(x + 0.15 * s, 0.02, 0.95 * s, sw, 0.03, sh - 0.4 * s, SAIL if k % 2 == 0 else SAIL_D)
            for r in range(5):
                box(x + 0.15 * s, -0.01, 0.95 * s + (r + 0.5) * (sh - 0.4 * s) / 5, sw + 0.06, 0.05, 0.03, WOODW_D)
            del sail
        cyl(L / 2 - 0.1 * s, -0.35 * s, 1.0 * s, 0.008, 0.2 * s, WOODW_D)
        lantern(L / 2 - 0.1 * s, -0.35 * s, 0.9 * s, 0.1 * s, LANT)
    return f


def bridge(axis):
    """Ponte de madeira (3 tiles ao longo do eixo, 2 de largura): tablado, guarda-corpo vermelho e postes."""
    def f():
        def B(x, y, z, sx, sy, sz, rgb):
            return box(x, y, z, sx, sy, sz, rgb) if axis == 'i' else box(y, x, z, sy, sx, sz, rgb)
        B(0, 0, 0, 3.0, 1.9, 0.08, (126, 92, 62))
        for s in (-1, 1):
            B(0, s * 0.9, 0.08, 3.0, 0.06, 0.06, rt.RED)
            B(0, s * 0.9, 0.42, 3.0, 0.08, 0.06, rt.RED)
            for k in range(4):
                B(-1.45 + k * 0.966, s * 0.9, 0, 0.1, 0.1, 0.5, rt.RED)
            for e in (-1, 1):
                sphere(*(((e * 1.45, s * 0.9) if axis == 'i' else (s * 0.9, e * 1.45))), 0.56, 0.06, rt.GOLD)
    return f


def pier_posts():
    """Estacas do cais com corda e uma lanterna baixa."""
    for sx in (-0.35, 0.35):
        cyl(sx, 0, 0, 0.09, 0.7, WOODW_D)
    box(0, 0, 0.55, 0.8, 0.03, 0.03, (190, 170, 120))
    cyl(0.35, 0, 0.7, 0.008, 0.12, WOODW_D)
    lantern(0.35, 0, 0.62, 0.08, AMBER)


def fence(n, axis):
    """Cerca do cercado do estábulo."""
    def f():
        def B(x, y, z, sx, sy, sz, rgb):
            return box(x, y, z, sx, sy, sz, rgb) if axis == 'i' else box(y, x, z, sy, sx, sz, rgb)
        for k in range(n + 1):
            B(-n / 2 + k, 0, 0, 0.1, 0.1, 0.6, WOODW_D)
        for z in (0.22, 0.46):
            B(0, 0, z, n, 0.06, 0.07, WOODW)
    return f


def stable():
    porto_house(6, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((150, 110, 60))])
    for k in range(3):
        box(-1.8 + k * 1.2, -2.25, 0, 0.5, 0.3, 0.35, (200, 170, 90))  # fardos de feno


def tea_house():
    rc.jade_house(5, 4, roof_rgb=ROOF_R, extras=[rt.shop_sign((52, 120, 80))])


SET = {
    'porto_casa_4x3': (lambda: porto_house(4, 3), (4, 3), 3.6),
    'porto_casa_3x4': (lambda: porto_house(3, 4, door='x', roof_rgb=ROOF_T), (3, 4), 3.6),
    'porto_casa_3x3': (lambda: porto_house(3, 3, roof_rgb=ROOF_T), (3, 3), 3.6),
    'porto_casa_5x4': (lambda: porto_house(5, 4, wall_h=1.6), (5, 4), 3.9),
    'porto_estabulo': (stable, (6, 4), 3.6),
    'porto_forja': (lambda: porto_house(5, 4, extras=[rt.shop_sign((60, 60, 70)), rt.forge]), (5, 4), 3.6),
    'porto_joalheria': (lambda: porto_house(4, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((110, 70, 170))]), (4, 4), 3.6),
    'porto_casa_cha': (tea_house, (5, 4), 4.4),
    'porto_antiquario': (lambda: porto_house(4, 4, extras=[rt.shop_sign((214, 172, 64))]), (4, 4), 3.6),
    'porto_banco': (lambda: rc.jade_house(5, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((214, 172, 64))]), (5, 4), 4.4),
    'barraca_vermelha': (stall_night((170, 40, 36)), (2, 2), 2.4),
    'barraca_ambar': (stall_night((200, 130, 40)), (2, 2), 2.4),
    'lanterna_poste': (lantern_post, (1, 1), 2.2),
    'estacas_cais': (pier_posts, (1, 1), 1.2),
    'ponte_i': (bridge('i'), (3, 2), 1.0),
    'ponte_j': (bridge('j'), (2, 3), 1.0),
    'cerca_i6': (fence(6, 'i'), (6, 1), 1.0),
    'cerca_j6': (fence(6, 'j'), (1, 6), 1.0),
    'junco_a': (junk(3), (5, 2), 3.4),
    'junco_b': (junk(2, 0.8), (4, 2), 2.8),
    'muralha_i1': (lambda: rc.wall(1, 'i'), (1, 1), 2.2),
    'muralha_j1': (lambda: rc.wall(1, 'j'), (1, 1), 2.2),
}


def main():
    only = set(sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else None
    rs = 2
    tmp = tempfile.mkdtemp()
    shots = []
    for name, (fn, (fw, fh), height) in SET.items():
        if only and name not in only:
            continue
        rt._mats.clear()
        frame, anchor = rt.frame_for(fw, fh, height)
        c = {'frame': frame, 'anchor': anchor, 'px_per_unit': rt.PPU, 'render_scale': rs, 'samples': 10,
             'ambient': 0.9, 'sun': 3.0, 'build': fn, 'model_scale': 1.0}
        sc, _, _ = rsp.setup_scene(c)
        fp = os.path.join(tmp, name + '.png')
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        shots.append((name, fp, anchor))
        print('ok', name, flush=True)
    out = {'name': 'porto', 'out': os.path.join(HERE, '../../public/sprites'), 'colors': 256}
    rpp.pack(out, shots, rs)


if __name__ == '__main__':
    main()
