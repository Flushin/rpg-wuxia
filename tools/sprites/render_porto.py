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


# ---- antiquário (Antiquário Lao): fachada, banca de relíquias, leões de pedra e jarros antigos ----
BRONZE = (150, 112, 60)
VERDIGRIS = (78, 140, 118)
CELADON = (150, 190, 160)
CLOTH = (36, 70, 72)


def antique_front(a, b, wh):
    """Toldo de pano verde-escuro sobre a porta, placas verticais vermelhas com letras douradas e lanternas âmbar."""
    o = box(0, -b - 0.45, 0.2 + wh - 0.12, 1.5, 0.8, 0.04, CLOTH)
    o.rotation_euler = (-0.2, 0, 0)
    for sx in (-1, 1):
        cyl(sx * 0.72, -b - 0.8, 0, 0.035, 0.2 + wh - 0.2, WOODW_D)
        cyl(sx * 0.72, -b - 0.8, 0.2 + wh - 0.42, 0.008, 0.12, WOODW_D)
        lantern(sx * 0.72, -b - 0.8, 0.2 + wh - 0.52, 0.1, AMBER)
        box(sx * 0.5, -b - 0.04, 0.32, 0.18, 0.04, 0.9, rt.RED)
        for k in range(3):
            box(sx * 0.5, -b - 0.07, 0.48 + k * 0.26, 0.1, 0.02, 0.1, rt.GOLD)


def antique_shop():
    porto_house(4, 4, extras=[rt.shop_sign(rt.GOLD), antique_front])


def ding(x, y, z, s=1.0):
    """Caldeirão de bronze de três pés (ding), com pátina verde."""
    import math
    for k in range(3):
        t = k * 2.094
        cyl(x + 0.13 * s * math.cos(t), y + 0.13 * s * math.sin(t), z, 0.025 * s, 0.14 * s, BRONZE)
    cyl(x, y, z + 0.12 * s, 0.17 * s, 0.18 * s, VERDIGRIS, verts=16, rough=0.4, r2=0.2 * s)
    for sx in (-1, 1):
        box(x + sx * 0.17 * s, y, z + 0.3 * s, 0.03 * s, 0.1 * s, 0.1 * s, BRONZE)


def vase(x, y, z, r, h, rgb):
    cyl(x, y, z, r * 0.6, h * 0.15, rgb, verts=16, rough=0.25, r2=r)
    cyl(x, y, z + h * 0.15, r, h * 0.45, rgb, verts=16, rough=0.25, r2=r * 0.55)
    cyl(x, y, z + h * 0.6, r * 0.3, h * 0.3, rgb, verts=16, rough=0.25, r2=r * 0.45)


def relic_stall():
    """Banca de relíquias (2x1): mesa baixa com pano azul, ding de bronze, disco de jade, pergaminhos,
    vaso celadon, estatueta dourada e uma lanterna âmbar num poste curto."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(sx * 0.75, sy * 0.25, 0, 0.04, 0.45, WOODW_D)
    box(0, 0, 0.45, 1.75, 0.7, 0.06, WOODW)
    box(0, -0.02, 0.51, 1.6, 0.66, 0.02, (40, 50, 110))
    box(0, -0.36, 0.3, 1.6, 0.02, 0.22, (40, 50, 110))  # aba do pano
    ding(-0.55, 0.05, 0.53)
    cyl(-0.05, 0.1, 0.53, 0.16, 0.02, (110, 70, 40))  # suporte do disco
    o = cyl(-0.05, 0.1, 0.62, 0.15, 0.04, (90, 190, 140), verts=20, rough=0.2)
    o.rotation_euler = (1.4, 0, 0)
    for k in range(2):  # pergaminhos
        o = cyl(0, 0, 0, 0.05, 0.5, (226, 210, 170))
        o.rotation_euler = (0, 1.5708, 0.2)
        o.location = (0.12, -0.18 + k * 0.14, 0.58 + k * 0.02)
    vase(0.45, 0.15, 0.53, 0.1, 0.36, CELADON)
    cyl(0.72, -0.1, 0.53, 0.06, 0.05, rt.GOLD, rough=0.3)
    cyl(0.72, -0.1, 0.58, 0.04, 0.12, rt.GOLD, rough=0.3)
    sphere(0.72, -0.1, 0.74, 0.05, rt.GOLD)
    cyl(0.85, 0.3, 0, 0.03, 1.15, WOODW_D)
    box(0.75, 0.3, 1.13, 0.24, 0.03, 0.03, WOODW_D)
    lantern(0.66, 0.3, 0.98, 0.1, AMBER)


def stone_lion():
    """Leão guardião de pedra (shishi) sentado num pedestal, olhando para a rua (-y)."""
    S, SD = (176, 170, 160), rt.STONE_D
    box(0, 0, 0, 0.56, 0.56, 0.32, SD)
    box(0, 0, 0.32, 0.48, 0.48, 0.05, S)
    sphere(0, 0.08, 0.55, 0.2, S, sz=1.1)  # corpo sentado
    for sx in (-1, 1):
        cyl(sx * 0.1, -0.1, 0.37, 0.05, 0.32, S)  # patas da frente
        sphere(sx * 0.1, -0.13, 0.39, 0.06, S, sz=0.6)
    for k in range(8):  # juba em cachos
        import math
        t = k * 0.785
        sphere(0.17 * math.cos(t), -0.02 + 0.06 * math.sin(t), 0.86 + 0.15 * math.sin(t), 0.08, SD)
    sphere(0, -0.08, 0.86, 0.14, S)  # cabeça
    sphere(0, -0.2, 0.82, 0.07, S, sz=0.8)  # focinho
    for sx in (-1, 1):
        sphere(sx * 0.06, -0.2, 0.92, 0.025, (30, 30, 34))
    box(0, -0.2, 0.75, 0.1, 0.03, 0.02, (120, 40, 36))  # boca
    sphere(0.17, -0.12, 0.42, 0.07, SD)  # bola sob a pata


def old_jars():
    """Três jarros antigos (celadon, marrom e azul) de tamanhos diferentes."""
    vase(-0.12, 0.15, 0, 0.27, 0.95, (120, 80, 50))
    vase(0.22, 0.0, 0, 0.2, 0.7, CELADON)
    vase(-0.12, -0.25, 0, 0.15, 0.5, (60, 90, 150))


SET = {
    'porto_casa_4x3': (lambda: porto_house(4, 3), (4, 3), 3.6),
    'porto_casa_3x4': (lambda: porto_house(3, 4, door='x', roof_rgb=ROOF_T), (3, 4), 3.6),
    'porto_casa_3x3': (lambda: porto_house(3, 3, roof_rgb=ROOF_T), (3, 3), 3.6),
    'porto_casa_5x4': (lambda: porto_house(5, 4, wall_h=1.6), (5, 4), 3.9),
    'porto_estabulo': (stable, (6, 4), 3.6),
    'porto_forja': (lambda: porto_house(5, 4, extras=[rt.shop_sign((60, 60, 70)), rt.forge]), (5, 4), 3.6),
    'porto_joalheria': (lambda: porto_house(4, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((110, 70, 170))]), (4, 4), 3.6),
    'porto_casa_cha': (tea_house, (5, 4), 4.4),
    'porto_antiquario': (antique_shop, (4, 4), 3.6),
    'banca_reliquias': (relic_stall, (2, 1), 1.6),
    'leao_pedra': (stone_lion, (1, 1), 1.3),
    'jarros_antigos': (old_jars, (1, 1), 1.0),
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
