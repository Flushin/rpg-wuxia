"""Cidadela de Jade (21/11/2026): casas de dois andares com telhado de jade, salão principal, pagode, muralha com
torres e portões, e colunas ornamentais (huabiao). Gerados por script com as peças de render_town.py (mesma câmera,
luz e escala da vila), num atlas próprio.

Uso: python tools/sprites/render_cidadela.py [-- nome ...]   (Blender como módulo; veja README.md)
Saída: public/sprites/cidadela.png/.json (no jogo: atlas 'props-cidadela'; objetos do mapa com a propriedade atlas).
Escala: 1 unidade = 1 tile. Eixos: +x = tile i (direita-baixo na tela), -y = tile j (esquerda-baixo).
As faces que aparecem na tela são +x e -y.
"""
import math, os, sys, tempfile
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_sprites as rsp
import render_props as rpp
import render_town as rt
from render_town import box, cyl, sphere, roof, window, lantern

HERE = os.path.dirname(os.path.abspath(__file__))

# paleta: telhas de jade vidradas, mármore claro, laca vermelha e ouro (a vila usa ardósia e reboco simples)
JADE = (46, 140, 108)
JADE_D = (30, 98, 78)
MARBLE = (230, 226, 216)
MARBLE_D = (192, 188, 178)
WALL = (244, 238, 224)
RED = (176, 36, 32)
GOLD = rt.GOLD
WOOD_D = rt.WOOD_D
BRICK = (128, 132, 136)
BRICK_D = (96, 100, 106)


def gold_finial(z, s=1.0):
    cyl(0, 0, z, 0.08 * s, 0.1 * s, GOLD, rough=0.3)
    sphere(0, 0, z + 0.2 * s, 0.11 * s, GOLD)
    cyl(0, 0, z + 0.3 * s, 0.025 * s, 0.25 * s, GOLD, rough=0.3)


def columns(a, b, z, h, step=1.2, r=0.08):
    """Colunas vermelhas nos cantos e ao longo das quatro faces."""
    nx = max(1, round(2 * a / step))
    ny = max(1, round(2 * b / step))
    pts = set()
    for k in range(nx + 1):
        x = -a + 2 * a * k / nx
        pts.add((round(x, 3), -b))
        pts.add((round(x, 3), b))
    for k in range(ny + 1):
        y = -b + 2 * b * k / ny
        pts.add((-a, round(y, 3)))
        pts.add((a, round(y, 3)))
    for x, y in pts:
        cyl(x, y, z, r, h, RED)


def facade(a, b, z, h, door):
    """Porta (face -y ou +x) com moldura dourada e janelas de treliça nas duas faces visíveis."""
    dz = min(0.92, h - 0.3)
    if door == 'y':
        box(0, -b - 0.02, z, 0.7, 0.06, dz, RED)
        box(0, -b - 0.05, z + dz, 0.84, 0.06, 0.08, GOLD)
        for sx in (-1, 1):
            window(sx * a * 0.6, -b - 0.02, z + 0.42, 'y')
        window(a + 0.02, 0, z + 0.42, 'x')
    else:
        box(a + 0.02, 0, z, 0.06, 0.7, dz, RED)
        box(a + 0.05, 0, z + dz, 0.06, 0.84, 0.08, GOLD)
        for sy in (-1, 1):
            window(a + 0.02, sy * b * 0.6, z + 0.42, 'x')
        window(0, -b - 0.02, z + 0.42, 'y')


def jade_house(w, h, door='y', floors=2, wh=1.15, hr=0.8, roof_rgb=JADE, lanterns=True):
    """Casa da Cidadela: plataforma de mármore, paredes claras com colunas vermelhas, faixa dourada e telhado de
    jade. Com floors=2 ganha um beiral no meio (telhado duplo) e um andar de cima mais estreito."""
    a, b = w / 2 - 0.45, h / 2 - 0.45
    box(0, 0, 0, w - 0.1, h - 0.1, 0.18, MARBLE_D)
    box(0, 0, 0.18, w - 0.3, h - 0.3, 0.12, MARBLE)
    z = 0.3
    box(0, 0, z, 2 * a, 2 * b, wh, WALL)
    columns(a, b, z, wh)
    facade(a, b, z, wh, door)
    box(0, 0, z + wh - 0.16, 2 * a + 0.04, 2 * b + 0.04, 0.16, RED)
    box(0, 0, z + wh - 0.2, 2 * a + 0.05, 2 * b + 0.05, 0.04, GOLD)
    z += wh
    if lanterns:
        for sx in (-1, 1):
            cyl(sx * a * 0.55, -b - 0.32, z - 0.05, 0.01, 0.12, WOOD_D)
            lantern(sx * a * 0.55, -b - 0.32, z - 0.22, rgb=(230, 60, 40))
    if floors == 2:
        roof(0, 0, a, b, z - 0.02, 0.3, roof_rgb, over=0.42, lift=0.2, ridge=False)
        a2, b2 = a * 0.76, b * 0.76
        box(0, 0, z, 2 * a2, 2 * b2, 0.3 + 0.75, WALL)
        z2 = z + 0.3
        columns(a2, b2, z2, 0.75, step=1.0, r=0.06)
        for sx in (-1, 1):
            window(sx * a2 * 0.5, -b2 - 0.02, z2 + 0.15, 'y')
        window(a2 + 0.02, 0, z2 + 0.15, 'x')
        box(0, 0, z2 + 0.75 - 0.12, 2 * a2 + 0.04, 2 * b2 + 0.04, 0.12, RED)
        z = z2 + 0.75
        a, b = a2, b2
    roof(0, 0, a, b, z - 0.02, hr, roof_rgb, over=0.4, lift=0.28)
    gold_finial(z - 0.02 + hr - 0.02, 0.8)
    for sx in (-1, 1):  # pontas douradas nos cantos dos beirais
        for sy in (-1, 1):
            sphere(sx * (a + 0.4), sy * (b + 0.4), z + 0.24, 0.05, GOLD)


def hall():
    """Salão principal (6x4): terraço de mármore em dois degraus, colunata vermelha na frente, placa dourada e
    telhado duplo de jade com cumeeira dourada."""
    w, h = 6, 4
    box(0, 0, 0, w - 0.1, h - 0.1, 0.22, MARBLE_D)
    box(0, 0, 0.22, w - 0.4, h - 0.4, 0.22, MARBLE)
    # escadaria na frente (-y) e balaústre
    for k in range(3):
        box(0, -(h / 2 - 0.25) + k * 0.12, 0, 1.6 - k * 0.1, 0.3, 0.15 * (k + 1), MARBLE)
    for sx in (-1, 1):
        box(sx * 1.7, -(h / 2 - 0.3), 0.44, 1.6, 0.06, 0.18, MARBLE_D)
    a, b = w / 2 - 0.65, h / 2 - 0.75
    z = 0.44
    wh = 1.45
    box(0, 0.12, z, 2 * a - 0.3, 2 * b - 0.3, wh, WALL)
    columns(a, b, z, wh, step=0.9, r=0.09)
    # portas de laca vermelha com tachas douradas
    for k in (-1, 0, 1):
        box(k * 0.75, -b + 0.13, z, 0.6, 0.06, 1.1, RED)
        for r in range(3):
            for c in (-1, 1):
                sphere(k * 0.75 + c * 0.14, -b + 0.09, z + 0.3 + r * 0.28, 0.025, GOLD)
    box(0, 0, z + wh - 0.18, 2 * a + 0.06, 2 * b + 0.06, 0.18, RED)
    box(0, 0, z + wh - 0.22, 2 * a + 0.07, 2 * b + 0.07, 0.04, GOLD)
    z += wh
    roof(0, 0, a, b, z - 0.02, 0.36, JADE, over=0.5, lift=0.3, ridge=False)
    a2, b2 = a * 0.8, b * 0.72
    box(0, 0, z, 2 * a2, 2 * b2, 0.36 + 0.7, WALL)
    columns(a2, b2, z + 0.36, 0.7, step=0.8, r=0.07)
    box(0, -b2 - 0.04, z + 0.42, 1.1, 0.05, 0.5, (40, 40, 52))  # placa com moldura dourada
    box(0, -b2 - 0.07, z + 0.48, 0.9, 0.03, 0.38, GOLD)
    box(0, 0, z + 0.36 + 0.7 - 0.12, 2 * a2 + 0.04, 2 * b2 + 0.04, 0.12, RED)
    z += 0.36 + 0.7
    roof(0, 0, a2, b2, z - 0.02, 0.95, JADE, over=0.48, lift=0.36)
    top = z - 0.02 + 0.95
    box(0, 0, top - 0.04, 2 * (a2 - b2) + 0.5, 0.1, 0.06, GOLD)
    for sx in (-1, 1):
        sphere(sx * (a2 - b2 + 0.3), 0, top + 0.1, 0.09, GOLD)
    gold_finial(top, 1.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            sphere(sx * (a2 + 0.48), sy * (b2 + 0.48), z + 0.36, 0.06, GOLD)
            sphere(sx * (a + 0.5), sy * (b + 0.5), z - 1.06 + 0.3, 0.06, GOLD)
    for sx in (-1, 1):
        cyl(sx * a * 0.6, -b - 0.4, z - 1.1, 0.01, 0.14, WOOD_D)
        lantern(sx * a * 0.6, -b - 0.4, z - 1.3, 0.13, (230, 60, 40))


def pagoda():
    """Pagode de cinco andares (3x3), cada um mais estreito, com beirais de jade e ponta dourada."""
    box(0, 0, 0, 2.8, 2.8, 0.2, MARBLE_D)
    box(0, 0, 0.2, 2.5, 2.5, 0.14, MARBLE)
    z = 0.34
    s = 0.95
    for k in range(5):
        wh = 0.78 if k == 0 else 0.55
        box(0, 0, z, 2 * s, 2 * s, wh, WALL if k % 2 == 0 else (236, 226, 204))
        for sx in (-1, 1):
            for sy in (-1, 1):
                cyl(sx * s, sy * s, z, 0.06, wh, RED)
        if k == 0:
            box(0, -s - 0.02, z, 0.5, 0.06, 0.62, RED)
            box(0, -s - 0.05, z + 0.62, 0.6, 0.06, 0.06, GOLD)
            box(s + 0.02, 0, z + 0.2, 0.06, 0.4, 0.36, WOOD_D)
        else:
            window(0, -s - 0.02, z + 0.1, 'y')
            window(s + 0.02, 0, z + 0.1, 'x')
        box(0, 0, z + wh - 0.1, 2 * s + 0.04, 2 * s + 0.04, 0.1, RED)
        z += wh
        roof(0, 0, s, s, z - 0.02, 0.32, JADE, over=0.36, lift=0.22, n=40, ridge=False)
        for sx in (-1, 1):
            for sy in (-1, 1):
                sphere(sx * (s + 0.36), sy * (s + 0.36), z + 0.2, 0.04, GOLD)
        z += 0.08
        s *= 0.84
    cyl(0, 0, z + 0.1, 0.05, 1.1, GOLD, rough=0.3)
    for k in range(4):
        cyl(0, 0, z + 0.3 + k * 0.2, 0.14 - k * 0.025, 0.04, GOLD, rough=0.3)
    sphere(0, 0, z + 1.3, 0.1, GOLD)


def wall(n, axis):
    """Trecho de muralha com n tiles: pedra cinza, base mais escura, contrafortes, passadiço com ameias e uma
    faixa de telhas de jade. axis='i' corre ao longo de x (muralhas norte e sul), 'j' ao longo de y."""
    def B(x, y, z, sx, sy, sz, rgb):
        return box(x, y, z, sx, sy, sz, rgb) if axis == 'i' else box(y, x, z, sy, sx, sz, rgb)
    L, T, H = n - 0.02, 0.8, 1.55
    B(0, 0, 0, L, T + 0.1, 0.3, BRICK_D)
    B(0, 0, 0.3, L, T, H - 0.3, BRICK)
    # contrafortes a cada 2 tiles
    for k in range(n // 2):
        x = -n / 2 + 1 + 2 * k
        for s in (-1, 1):
            B(x, s * (T / 2 + 0.06), 0, 0.3, 0.12, H - 0.1, BRICK_D)
    B(0, 0, H, L, T + 0.08, 0.08, BRICK_D)
    # faixa de telhas de jade sob as ameias (lado de dentro e de fora)
    for s in (-1, 1):
        B(0, s * (T / 2 + 0.03), H - 0.32, L, 0.08, 0.1, JADE_D)
    # ameias nos dois lados
    m = int(n / 0.5)
    for k in range(m):
        x = -n / 2 + 0.25 + k * 0.5
        for s in (-1, 1):
            B(x, s * (T / 2 - 0.05), H + 0.08, 0.28, 0.12, 0.26, BRICK)


def tower():
    """Torre de canto (2x2): baluarte de pedra com ameias e um pavilhão de telhado de jade em cima."""
    H = 2.0
    box(0, 0, 0, 1.92, 1.92, 0.35, BRICK_D)
    box(0, 0, 0.35, 1.8, 1.8, H - 0.35, BRICK)
    box(0, 0, H, 1.92, 1.92, 0.08, BRICK_D)
    for s in (-1, 1):
        box(0, s * 0.93, H - 0.34, 1.86, 0.08, 0.1, JADE_D)
        box(s * 0.93, 0, H - 0.34, 0.08, 1.86, 0.1, JADE_D)
    for k in range(7):
        t = -0.84 + k * 0.28
        for s in (-1, 1):
            box(t, s * 0.84, H + 0.08, 0.16, 0.12, 0.24, BRICK)
            box(s * 0.84, t, H + 0.08, 0.12, 0.16, 0.24, BRICK)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(sx * 0.42, sy * 0.42, H + 0.08, 0.05, 0.62, RED)
    box(0, 0, H + 0.62, 0.92, 0.92, 0.1, RED)
    roof(0, 0, 0.46, 0.46, H + 0.7, 0.55, JADE, over=0.34, lift=0.24, n=32)
    gold_finial(H + 1.22, 0.7)
    cyl(0.3, -0.42, H + 0.52, 0.01, 0.12, WOOD_D)
    lantern(0.3, -0.42, H + 0.38, 0.09, (230, 60, 40))


def gatehouse(axis):
    """Portão da muralha (4x2 ou 2x4): base de pedra com portas de laca vermelha e tachas douradas (nas duas
    faces) e um pavilhão de dois telhados de jade em cima."""
    def B(x, y, z, sx, sy, sz, rgb):
        return box(x, y, z, sx, sy, sz, rgb) if axis == 'i' else box(y, x, z, sy, sx, sz, rgb)
    def S(x, y, z, r, rgb):
        return sphere(x, y, z, r, rgb) if axis == 'i' else sphere(y, x, z, r, rgb)
    def C(x, y, z, r, h, rgb):
        return cyl(x, y, z, r, h, rgb) if axis == 'i' else cyl(y, x, z, r, h, rgb)
    H = 2.0
    B(0, 0, 0, 3.92, 1.92, 0.35, BRICK_D)
    B(0, 0, 0.35, 3.8, 1.8, H - 0.35, BRICK)
    B(0, 0, H, 3.92, 1.92, 0.08, BRICK_D)
    for s in (-1, 1):
        B(0, s * 0.91, 0.3, 1.5, 0.06, 1.35, (60, 56, 56))  # vão
        for k in (-1, 1):
            B(k * 0.35, s * 0.94, 0.3, 0.66, 0.06, 1.28, RED)
            for r in range(4):
                for c in range(3):
                    S(k * 0.35 - 0.2 + c * 0.2, s * 0.98, 0.5 + r * 0.26, 0.025, GOLD)
        B(0, s * 0.95, 1.7, 1.0, 0.04, 0.22, (40, 40, 52))
        B(0, s * 0.97, 1.74, 0.8, 0.03, 0.14, GOLD)
        B(0, s * 0.93, H - 0.34, 3.86, 0.08, 0.1, JADE_D)
    for k in range(14):
        t = -1.82 + k * 0.28
        for s in (-1, 1):
            B(t, s * 0.84, H + 0.08, 0.16, 0.12, 0.24, BRICK)
    # pavilhão
    a, b = 1.3, 0.48
    for k in range(5):
        x = -a + k * a / 2
        for s in (-1, 1):
            C(x, s * b, H + 0.08, 0.06, 0.8, RED)
    B(0, 0, H + 0.08, 2 * a - 0.2, 2 * b - 0.2, 0.8, WALL)
    B(0, 0, H + 0.76, 2 * a + 0.04, 2 * b + 0.04, 0.12, RED)
    z = H + 0.88
    if axis == 'i':
        roof(0, 0, a, b, z - 0.02, 0.26, JADE, over=0.36, lift=0.2, ridge=False)
        box(0, 0, z, 2 * a * 0.7, 2 * b * 0.7, 0.42, WALL)
        roof(0, 0, a * 0.7, b * 0.7, z + 0.4, 0.55, JADE, over=0.34, lift=0.26)
    else:
        roof(0, 0, b, a, z - 0.02, 0.26, JADE, over=0.36, lift=0.2, ridge=False)
        box(0, 0, z, 2 * b * 0.7, 2 * a * 0.7, 0.42, WALL)
        roof(0, 0, b * 0.7, a * 0.7, z + 0.4, 0.55, JADE, over=0.34, lift=0.26)
    gold_finial(z + 0.93, 0.7)
    for k in (-1, 1):
        C(k * 0.9, -b - 0.34, z - 0.12, 0.01, 0.12, WOOD_D)
        if axis == 'i':
            lantern(k * 0.9, -b - 0.34, z - 0.26, 0.1, (230, 60, 40))
        else:
            lantern(b + 0.34, k * 0.9, z - 0.26, 0.1, (230, 60, 40))


def huabiao():
    """Coluna ornamental de mármore (huabiao): base octogonal, fuste branco, prato de nuvem e um leão dourado."""
    cyl(0, 0, 0, 0.34, 0.16, MARBLE_D, verts=8)
    cyl(0, 0, 0.16, 0.26, 0.12, MARBLE, verts=8)
    cyl(0, 0, 0.28, 0.12, 2.1, MARBLE, verts=8)
    for k in range(5):  # faixas do dragão enrolado (em jade)
        o = box(0, 0, 0.5 + k * 0.38, 0.27, 0.06, 0.07, JADE_D)
        o.rotation_euler = (0.35, 0, k * 1.2)
    box(0, 0, 1.92, 0.62, 0.08, 0.16, MARBLE)  # prato de nuvem
    cyl(0, 0, 2.38, 0.2, 0.08, MARBLE, verts=8)
    sphere(0, 0, 2.56, 0.11, GOLD, sz=1.2)


def double_lantern():
    """Poste de pedra com duas lanternas vermelhas penduradas e o topo dourado (ruas da Cidadela)."""
    box(0, 0, 0, 0.36, 0.36, 0.14, MARBLE_D)
    cyl(0, 0, 0.14, 0.06, 1.55, RED)
    box(0, 0, 1.62, 0.7, 0.06, 0.06, WOOD_D)
    for s in (-1, 1):
        cyl(s * 0.3, 0, 1.43, 0.008, 0.2, WOOD_D)
        lantern(s * 0.3, 0, 1.33, 0.12, (230, 60, 40))
    sphere(0, 0, 1.76, 0.06, GOLD)


SET = {
    # nome: (função, pegada [w, h] em tiles, altura máxima em unidades para a moldura)
    'jade_casa_3x3': (lambda: jade_house(3, 3), (3, 3), 4.2),
    'jade_casa_3x3b': (lambda: jade_house(3, 3, door='x', floors=1, wh=1.35, hr=0.95, roof_rgb=JADE_D), (3, 3), 3.6),
    'jade_casa_4x3': (lambda: jade_house(4, 3), (4, 3), 4.2),
    'jade_casa_3x4': (lambda: jade_house(3, 4, door='x', roof_rgb=JADE_D), (3, 4), 4.2),
    'jade_salao': (hall, (6, 4), 5.4),
    'jade_pagode': (pagoda, (3, 3), 7.2),
    'muralha_i11': (lambda: wall(11, 'i'), (11, 1), 2.2),
    'muralha_i4': (lambda: wall(4, 'i'), (4, 1), 2.2),
    'muralha_j11': (lambda: wall(11, 'j'), (1, 11), 2.2),
    'muralha_torre': (tower, (2, 2), 4.0),
    'portao_muralha_i': (lambda: gatehouse('i'), (4, 2), 4.6),
    'portao_muralha_j': (lambda: gatehouse('j'), (2, 4), 4.6),
    'huabiao': (huabiao, (1, 1), 3.0),
    'lanterna_dupla': (double_lantern, (1, 1), 2.2),
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
    out = {'name': os.environ.get('ATLAS_NAME', 'cidadela'), 'out': os.environ.get('ATLAS_OUT', os.path.join(HERE, '../../public/sprites')), 'colors': 256}
    rpp.pack(out, shots, rs)


if __name__ == '__main__':
    main()
