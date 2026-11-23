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


def floor_lantern():
    """Lanterninha de chão junto dos NPCs: suporte baixo de madeira com lanterna de papel âmbar."""
    box(0, 0, 0, 0.26, 0.26, 0.05, WOODW_D)
    cyl(0, 0, 0.05, 0.025, 0.42, WOODW_D)
    box(0.08, 0, 0.45, 0.2, 0.03, 0.03, WOODW_D)
    lantern(0.15, 0, 0.3, 0.09, AMBER)


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


def stable_wall(a, b, wh):
    """Tábua na parede com ferraduras e rédeas penduradas, ao lado da porta."""
    box(-a * 0.55, -b - 0.04, 0.55, 0.9, 0.03, 0.55, WOODW_D)
    for k in range(4):
        o = cyl(-a * 0.55 - 0.3 + k * 0.2, -b - 0.07, 0.9, 0.07, 0.02, (120, 124, 130), verts=10, rough=0.4)
        o.rotation_euler = (1.5708, 0, 0)
    for k in range(2):
        box(-a * 0.55 - 0.15 + k * 0.3, -b - 0.07, 0.6, 0.03, 0.02, 0.28, (90, 50, 30))


def stable():
    porto_house(6, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((150, 110, 60)), stable_wall])
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


# ---- joalheria (Joalheiro Yu): fachada, vitrine de joias e expositor de gemas ----
SILK = (96, 52, 140)
GEMS = [(230, 50, 70), (60, 120, 240), (60, 200, 120), (170, 80, 230), (250, 200, 60)]


def jewel_front(a, b, wh):
    """Cortinas de seda roxa na porta, janelas com joias brilhando e um losango de gema sobre a placa."""
    for sx in (-1, 1):
        box(sx * 0.42, -b - 0.05, 0.2, 0.22, 0.04, 0.95, SILK)
        box(sx * 0.42, -b - 0.07, 1.1, 0.26, 0.04, 0.06, rt.GOLD)
        for k in range(3):
            sphere(sx * a * 0.6 - 0.14 + k * 0.14, -b - 0.06, 0.66, 0.04, GEMS[(k + (sx > 0) * 2) % 5], emit=2.5)
    o = box(0, -b - 0.1, 0.2 + wh - 0.05, 0.22, 0.03, 0.22, (170, 80, 230), emit=2.0)
    o.rotation_euler = (0, 0.785, 0)
    for sx in (-1, 1):
        cyl(sx * a * 0.85, -b - 0.3, 0.2 + wh - 0.05, 0.01, 0.12, rt.WOOD_D)
        lantern(sx * a * 0.85, -b - 0.3, 0.2 + wh - 0.22, 0.11, (200, 110, 230))


def jewel_shop():
    porto_house(4, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((110, 70, 170)), jewel_front])


def jewel_counter():
    """Vitrine de joias (2x1): balcão de madeira escura com tampo de vidro, colares, anéis e gemas brilhando,
    uma balança de joalheiro e uma lâmpada."""
    box(0, 0, 0, 1.8, 0.62, 0.62, WOODW_D)
    box(0, -0.32, 0.12, 1.6, 0.02, 0.38, WOODW)  # frente almofadada
    box(0, 0, 0.62, 1.84, 0.66, 0.04, rt.GOLD, rough=0.3)
    box(0, 0, 0.66, 1.7, 0.56, 0.02, (90, 30, 50))  # veludo
    for k in range(8):
        c = GEMS[k % 5]
        sphere(-0.72 + k * 0.2, -0.08 + 0.14 * (k % 2), 0.71, 0.045, c, emit=3.0)
    for k in range(3):  # anéis de ouro
        o = cyl(-0.6 + k * 0.18, 0.18, 0.7, 0.05, 0.02, rt.GOLD, rough=0.25)
    import math
    for k in range(9):  # colar de pérolas em arco
        t = math.pi * k / 8
        sphere(0.35 + 0.22 * math.cos(t), 0.12 - 0.12 * math.sin(t), 0.7, 0.025, (240, 236, 225))
    o = box(0, 0, 0.68, 1.7, 0.56, 0.22, (190, 220, 235), rough=0.05)  # vidro (material próprio, translúcido)
    g = bpy.data.materials.new('vidro')
    g.use_nodes = True
    g.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.18
    g.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.05
    o.data.materials[0] = g
    # balança e lâmpada sobre o vidro
    cyl(0.62, 0.1, 0.9, 0.02, 0.3, rt.GOLD)
    box(0.62, 0.1, 1.2, 0.36, 0.02, 0.02, rt.GOLD)
    for sx in (-1, 1):
        cyl(0.62 + sx * 0.17, 0.1, 1.08, 0.06, 0.02, rt.GOLD)
    cyl(-0.65, 0.12, 0.9, 0.08, 0.04, WOODW_D)
    cyl(-0.65, 0.12, 0.94, 0.015, 0.3, WOODW_D)
    lantern(-0.65, 0.12, 1.28, 0.1, (255, 220, 140))


def gem_display():
    """Expositor de gemas: pedestal de jade com um grande geodo de ametista brilhando."""
    box(0, 0, 0, 0.5, 0.5, 0.12, rt.STONE_D)
    cyl(0, 0, 0.12, 0.14, 0.45, (60, 140, 110), verts=8, rough=0.3)
    box(0, 0, 0.57, 0.42, 0.42, 0.06, (40, 110, 86), rough=0.3)
    sphere(0, 0, 0.78, 0.2, (90, 70, 80), sz=0.9)  # rocha
    import random
    rnd = random.Random(3)
    for k in range(9):
        o = cyl(rnd.uniform(-0.12, 0.12), rnd.uniform(-0.16, 0.0), 0.72, 0.035, rnd.uniform(0.18, 0.3),
                (170, 80, 230), verts=6, emit=2.2, r2=0.005)
        o.rotation_euler = (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), 0)


# ---- forja (Ferreiro-mestre Gang): fachada, fornalha, bigorna, suporte de armas e tina de têmpera ----
IRON = (70, 72, 78)
STEEL = (170, 176, 186)
EMBER = (255, 110, 30)


def forge_front(a, b, wh):
    """Ferramentas penduradas na parede (tenazes e martelos), janela da fornalha brilhando e toldo de lona escura."""
    o = box(0, -b - 0.4, 0.2 + wh - 0.1, 1.6, 0.7, 0.04, (60, 56, 52))
    o.rotation_euler = (-0.18, 0, 0)
    for sx in (-1, 1):
        cyl(sx * 0.75, -b - 0.72, 0, 0.035, 0.2 + wh - 0.2, WOODW_D)
    for k in range(3):  # martelos e tenazes na parede da direita
        x = a * 0.35 + k * 0.22
        box(x, -b - 0.05, 0.55, 0.04, 0.03, 0.4, WOODW)
        box(x, -b - 0.06, 0.92, 0.14 if k % 2 == 0 else 0.06, 0.05, 0.08, IRON, rough=0.4)
    box(-a * 0.6, -b - 0.03, 0.5, 0.5, 0.03, 0.35, EMBER, emit=3.0)  # boca da fornalha (janela)
    box(-a * 0.6, -b - 0.05, 0.85, 0.6, 0.05, 0.06, rt.STONE_D)


def forge_shop():
    def chimney(a, b, wh):
        box(-a * 0.5, b * 0.3, 0.2, 0.42, 0.42, wh + 1.25, rt.STONE_D)
    porto_house(5, 4, extras=[rt.shop_sign((60, 60, 70)), chimney, forge_front])


def hearth():
    """Fornalha de pedra com brasas acesas, fole de couro e chaminé curta."""
    box(0, 0, 0, 0.8, 0.8, 0.5, rt.STONE_D)
    box(0, 0, 0.5, 0.86, 0.86, 0.06, rt.STONE)
    box(0, 0, 0.56, 0.6, 0.6, 0.04, (50, 30, 26))  # cinzas
    for k in range(12):
        sphere(-0.22 + (k % 6) * 0.09, -0.12 + (k // 6) * 0.16 + 0.04 * (k % 2), 0.6, 0.06,
               (220, 70, 20) if k % 3 else (255, 150, 40), emit=1.4 if k % 3 else 2.2)
    box(0.15, 0.3, 0.56, 0.3, 0.2, 0.9, rt.STONE_D)  # chaminé
    box(-0.55, 0.0, 0.25, 0.28, 0.4, 0.14, (120, 80, 50))  # fole
    cyl(-0.4, 0.0, 0.3, 0.03, 0.2, WOODW_D)


def anvil():
    """Bigorna de ferro num toco, com martelo e uma lâmina em brasa."""
    cyl(0, 0, 0, 0.24, 0.38, WOODW, verts=12)
    box(0, 0, 0.38, 0.24, 0.2, 0.12, IRON, rough=0.35)
    box(0, 0, 0.5, 0.46, 0.22, 0.1, IRON, rough=0.35)
    cyl(0.28, 0, 0.53, 0.07, 0.04, IRON, rough=0.35, r2=0.01).rotation_euler = (0, 1.5708, 0)
    box(-0.05, -0.02, 0.61, 0.34, 0.05, 0.02, (255, 140, 50), emit=3.0)  # lâmina em brasa
    box(0.12, 0.08, 0.63, 0.24, 0.03, 0.03, WOODW)  # cabo do martelo
    box(0.02, 0.08, 0.63, 0.06, 0.08, 0.06, IRON)


def weapon_rack():
    """Suporte de madeira com espadas, lança e um machado."""
    for sx in (-1, 1):
        cyl(sx * 0.32, 0, 0, 0.035, 1.0, WOODW_D)
    box(0, 0, 0.95, 0.75, 0.06, 0.05, WOODW_D)
    box(0, 0, 0.3, 0.75, 0.06, 0.05, WOODW_D)
    for k in range(3):  # espadas
        x = -0.2 + k * 0.14
        box(x, -0.04, 0.32, 0.04, 0.02, 0.6, STEEL, rough=0.25)
        box(x, -0.04, 0.92, 0.12, 0.03, 0.03, rt.GOLD)
        box(x, -0.04, 0.95, 0.03, 0.03, 0.12, WOODW)
    cyl(0.24, -0.04, 0.05, 0.015, 1.25, WOODW)  # lança
    cyl(0.24, -0.04, 1.3, 0.04, 0.14, STEEL, verts=6, r2=0.0)


def quench_tub():
    """Tina de têmpera: barril cortado com água e vapor."""
    cyl(0, 0, 0, 0.3, 0.36, WOODW, verts=14)
    for z in (0.06, 0.28):
        cyl(0, 0, z, 0.305, 0.04, IRON, verts=14)
    cyl(0, 0, 0.3, 0.26, 0.04, (60, 100, 130), verts=14, rough=0.1)
    box(0.05, 0.05, 0.34, 0.03, 0.03, 0.45, IRON).rotation_euler = (0.3, 0.2, 0)  # tenaz


# ---- estábulo (Cavalariço Ma): cavalos no cercado, cocho, feno e sela ----
HAY = (206, 172, 92)


def horse(rot, tint=None):
    """Cavalo parado (modelo do cavalo das montarias, pose do primeiro quadro do Idle), virado rot radianos."""
    def f():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, '.cache/quaternius/Horse.glb'))
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:
            if o.name.startswith('Icosphere'):
                o.hide_render = True
        roots = [o for o in new if o.parent is None]
        arm = next((o for o in new if o.type == 'ARMATURE'), None)
        if arm is not None:
            if arm.animation_data is None:
                arm.animation_data_create()
            act = bpy.data.actions.get('AnimalArmature|Idle')
            if act:
                arm.animation_data.action = act
                if hasattr(arm.animation_data, 'action_slot') and act.slots:
                    arm.animation_data.action_slot = act.slots[0]
                bpy.context.scene.frame_set(int(act.frame_range[0]))
        for r in roots:
            r.scale = (0.38, 0.38, 0.38)
            r.rotation_euler = (0, 0, rot)
        if tint:
            for o in new:
                if o.type == 'MESH':
                    for m in o.data.materials:
                        if m and m.use_nodes:
                            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                            if b and m.name.startswith('Main'):
                                k = {'Main': 1.0, 'Main_Dark': 0.7, 'Main_Light': 1.35}.get(m.name, 1.0)
                                c = tuple(min(255, int(v * k)) for v in tint)
                                for l in list(b.inputs['Base Color'].links):
                                    m.node_tree.links.remove(l)
                                b.inputs['Base Color'].default_value = (*rsp.srgb(c)[:3], 1)
    return f


def trough():
    """Cocho (2x1): caixa de madeira comprida com água de um lado e feno do outro."""
    for sx in (-1, 1):
        box(sx * 0.75, 0, 0, 0.08, 0.4, 0.4, WOODW_D)
    box(0, 0, 0.1, 1.6, 0.46, 0.06, WOODW)
    for sy in (-1, 1):
        box(0, sy * 0.22, 0.1, 1.6, 0.05, 0.32, WOODW)
    box(-0.4, 0, 0.3, 0.75, 0.38, 0.04, (60, 100, 130), rough=0.1)
    box(0.4, 0, 0.3, 0.75, 0.38, 0.1, HAY)


def hay_pile():
    """Fardos de feno empilhados com um forcado encostado."""
    box(0, 0, 0, 0.7, 0.42, 0.32, HAY)
    box(0.05, 0.02, 0.32, 0.6, 0.38, 0.3, (196, 162, 84), rot=0.25)
    for z in (0.1, 0.22):
        box(0, -0.215, z, 0.7, 0.01, 0.025, (150, 110, 60))
    o = cyl(0.42, -0.1, 0, 0.018, 1.0, WOODW)
    o.rotation_euler = (0.25, -0.15, 0)


def hitching_rail():
    """Palanque de amarrar (2x1) com rédea pendurada e um balde."""
    for sx in (-1, 1):
        cyl(sx * 0.7, 0, 0, 0.05, 0.75, WOODW_D)
    box(0, 0, 0.7, 1.55, 0.08, 0.08, WOODW)
    box(-0.2, 0, 0.45, 0.03, 0.03, 0.28, (90, 50, 30))
    cyl(0.4, -0.2, 0, 0.13, 0.22, WOODW, verts=12, r2=0.15)
    cyl(0.4, -0.2, 0.18, 0.12, 0.03, HAY)


def feed_sacks():
    """Sacos de ração de aveia, um aberto com uma concha."""
    for k, (x, y) in enumerate([(-0.15, 0.1), (0.15, 0.12), (0.0, -0.15)]):
        sphere(x, y, 0.2, 0.18, (196, 176, 136), sz=1.3)
    cyl(0.0, -0.15, 0.4, 0.1, 0.03, HAY)
    o = cyl(0.12, -0.2, 0.35, 0.015, 0.3, WOODW)
    o.rotation_euler = (0.6, 0.3, 0)


def saddle_rack():
    """Cavalete com sela de couro e manta vermelha."""
    for sx in (-1, 1):
        cyl(sx * 0.22, 0, 0, 0.03, 0.55, WOODW_D)
    box(0, 0, 0.55, 0.55, 0.12, 0.06, WOODW_D)
    box(0, 0, 0.6, 0.45, 0.4, 0.03, (170, 40, 36))
    sphere(0, 0, 0.66, 0.2, (120, 70, 40), sz=0.45)
    sphere(-0.15, 0, 0.72, 0.06, (120, 70, 40))


# ---- mercado do cais: mercadoria ao lado das barracas dos vendedores ----
def potion_shelf():
    """Estante de poções (Vendedora Hua): três prateleiras com frascos vermelhos, azuis e verdes."""
    for sx in (-1, 1):
        box(sx * 0.38, 0, 0, 0.06, 0.32, 1.2, WOODW_D)
    for k in range(3):
        z = 0.15 + k * 0.38
        box(0, 0, z, 0.82, 0.32, 0.04, WOODW)
        for i in range(4):
            c = [(210, 50, 50), (60, 110, 220), (70, 180, 90), (220, 160, 50)][(i + k) % 4]
            cyl(-0.27 + i * 0.18, 0, z + 0.04, 0.06, 0.16, c, rough=0.25, emit=0.6)
            cyl(-0.27 + i * 0.18, 0, z + 0.2, 0.025, 0.05, (230, 220, 200))
    box(0, 0, 1.2, 0.9, 0.36, 0.05, WOODW_D)


def fish_rack():
    """Varal de peixe seco (Vendedor Bo): armação de bambu com peixes pendurados."""
    for sx in (-1, 1):
        cyl(sx * 0.4, 0, 0, 0.03, 1.15, (150, 130, 70))
    cyl(0, 0, 1.1, 0.025, 0.85, (150, 130, 70)).rotation_euler = (0, 1.5708, 0)
    bpy.context.object.location = (0, 0, 1.1)
    for i in range(5):
        x = -0.3 + i * 0.15
        cyl(x, 0, 0.98, 0.005, 0.12, (90, 70, 50))
        sphere(x, 0, 0.82, 0.06, (170, 140, 100), sz=2.2)
        cyl(x, 0, 0.6, 0.05, 0.08, (150, 120, 90), r2=0.0).rotation_euler = (3.1416, 0, 0)


def tea_jars():
    """Jarros de chá lacrados com etiqueta vermelha e um cesto de folhas."""
    for x, y, r in [(-0.18, 0.12, 0.21), (0.2, 0.14, 0.17), (0.02, -0.2, 0.15)]:
        vase(x, y, 0, r, r * 3.2, (90, 70, 60))
        box(x, y - r * 0.85, r * 1.2, r * 0.6, 0.02, r * 0.8, (190, 40, 36))
    cyl(0.28, -0.22, 0, 0.13, 0.14, (170, 140, 80), r2=0.16)
    sphere(0.28, -0.22, 0.15, 0.12, (70, 120, 60), sz=0.5)


def baskets():
    """Cestos de vime com ervas, frutas e frascos (Vendedora Lan)."""
    for (x, y), fill in zip([(-0.22, 0.14), (0.22, 0.1), (0.0, -0.22)], [(70, 140, 70), (220, 120, 50), (200, 60, 60)]):
        cyl(x, y, 0, 0.21, 0.26, (176, 140, 80), r2=0.25)
        for k in range(5):
            sphere(x - 0.1 + k * 0.05, y + 0.04 * (k % 2), 0.28, 0.07, fill)
    for k in range(3):
        cyl(-0.08 + k * 0.08, -0.22, 0.3, 0.035, 0.14, (60, 110, 220), rough=0.25, emit=0.6)


def spice_sacks():
    """Sacos abertos de especiarias e ervas secas (vermelho, amarelo, verde) com uma concha."""
    for (x, y), c in zip([(-0.2, 0.12), (0.2, 0.12), (0.0, -0.18)], [(190, 60, 30), (220, 170, 40), (90, 130, 60)]):
        cyl(x, y, 0, 0.18, 0.34, (196, 176, 136), r2=0.2)
        cyl(x, y, 0.34, 0.21, 0.04, (186, 166, 126))
        sphere(x, y, 0.34, 0.16, c, sz=0.45)
    o = cyl(0.05, -0.18, 0.4, 0.015, 0.3, WOODW)
    o.rotation_euler = (0.7, 0.2, 0)


# ---- Mestre dos Caminhos (praça): marco de direções, mesa de mapas com bússola luopan e bagagem de viagem ----
PAPER = (226, 208, 166)
INK = (60, 44, 36)


def waymarker():
    """Marco dos caminhos: coluna de pedra com chapéu de telha e placas de madeira apontando para vários rumos."""
    import math
    box(0, 0, 0, 0.4, 0.4, 0.14, rt.STONE_D)
    box(0, 0, 0.14, 0.24, 0.24, 1.3, rt.STONE)
    box(0, 0, 1.44, 0.4, 0.4, 0.05, WOODW_D)
    roof(0, 0, 0.2, 0.2, 1.49, 0.26, ROOF_R, over=0.12, lift=0.06, ridge=False)
    sphere(0, 0, 1.78, 0.05, rt.GOLD, emit=0.5)
    for k, (ang, z) in enumerate([(0.3, 1.2), (2.2, 1.02), (4.0, 0.84), (5.4, 0.66)]):
        dx, dy = math.cos(ang), math.sin(ang)
        o = box(dx * 0.33, dy * 0.33, z, 0.46, 0.03, 0.11, [WOODW, (150, 110, 70)][k % 2])
        o.rotation_euler = (0, 0, ang)
        o = box(dx * 0.33, dy * 0.33, z + 0.035, 0.32, 0.035, 0.035, (200, 50, 40))
        o.rotation_euler = (0, 0, ang)
    box(0, -0.125, 0.5, 0.12, 0.01, 0.5, (200, 50, 40))  # faixa vermelha com caracteres
    for k in range(4):
        box(0, -0.13, 0.58 + k * 0.11, 0.06, 0.01, 0.05, rt.GOLD, emit=0.4)


def map_table():
    """Mesa baixa de mapas (2x1): mapa aberto, bússola luopan dourada, rolos de mapa, pincel e lamparina."""
    box(0, 0, 0.0, 1.6, 0.66, 0.06, WOODW_D)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(sx * 0.72, sy * 0.26, 0.06, 0.08, 0.08, 0.5, WOODW_D)
    box(0, 0, 0.56, 1.7, 0.74, 0.06, WOODW)
    box(-0.25, 0, 0.62, 0.9, 0.58, 0.01, PAPER)  # mapa
    for sx in (-1, 1):
        cyl(-0.25 + sx * 0.45, 0, 0.35, 0.035, 0.6, (150, 110, 70)).rotation_euler = (1.5708, 0, 0)
    import random
    rnd = random.Random(5)
    for k in range(6):  # rios e estradas
        o = box(-0.25 + rnd.uniform(-0.3, 0.3), rnd.uniform(-0.2, 0.2), 0.632, rnd.uniform(0.2, 0.4), 0.012, 0.003,
                [(70, 110, 170), INK, (180, 50, 40)][k % 3])
        o.rotation_euler = (0, 0, rnd.uniform(-1.2, 1.2))
    for k in range(3):  # montanhas
        cyl(-0.45 + k * 0.17, 0.12, 0.632, 0.045, 0.05, (90, 120, 80), verts=3, r2=0.0)
    # luopan
    cyl(0.5, 0.05, 0.62, 0.2, 0.05, (120, 60, 30))
    cyl(0.5, 0.05, 0.67, 0.17, 0.012, rt.GOLD, rough=0.25, emit=0.6)
    cyl(0.5, 0.05, 0.682, 0.08, 0.008, (180, 40, 36))
    box(0.5, 0.05, 0.695, 0.22, 0.012, 0.008, (230, 230, 240), emit=0.8).rotation_euler = (0, 0, 0.6)
    # rolos de mapa
    for k in range(3):
        o = cyl(0.3, -0.18 - k * 0.07, 0.49 + (k == 2) * 0.06, 0.035, 0.34, PAPER)
        o.rotation_euler = (0, 1.5708, 0)
    o = cyl(-0.62, -0.25, 0.52, 0.01, 0.22, INK)  # pincel
    o.rotation_euler = (0, 1.5708, 0.3)
    cyl(0.75, 0.25, 0.62, 0.05, 0.08, INK)  # tinteiro


def travel_gear():
    """Bagagem de viagem: baú de couro com cintas de bronze, trouxa de pano, cajado e sombrinha de papel."""
    box(-0.05, 0.08, 0, 0.5, 0.32, 0.3, (110, 66, 40))
    box(-0.05, 0.08, 0.3, 0.52, 0.34, 0.06, (90, 54, 34))
    for sx in (-1, 1):
        box(-0.05 + sx * 0.16, 0.08, 0, 0.04, 0.35, 0.37, rt.GOLD, rough=0.35)
    sphere(0.22, -0.2, 0.12, 0.14, (60, 90, 140), sz=0.9)  # trouxa
    sphere(0.22, -0.2, 0.25, 0.05, (60, 90, 140))
    o = cyl(0.3, 0.22, 0, 0.02, 1.2, (150, 120, 70))  # cajado
    o.rotation_euler = (0.15, -0.12, 0)
    cyl(-0.3, -0.18, 0, 0.012, 0.8, WOODW_D).rotation_euler = (-0.2, 0.25, 0)
    o = cyl(-0.35, -0.22, 0.6, 0.18, 0.12, (200, 60, 50), r2=0.0, verts=12)  # sombrinha fechada inclinada
    o.rotation_euler = (-0.2, 0.25, 0)


# ---- guardas do portão: estandarte da guarda e braseiro de ferro ----
def banner():
    """Estandarte da guarda: mastro com ponta de lança, flâmula vermelha com borda dourada e base de pedra."""
    box(0, 0, 0, 0.36, 0.36, 0.16, rt.STONE_D)
    cyl(0, 0, 0.16, 0.035, 2.0, WOODW_D)
    cyl(0, 0, 2.16, 0.04, 0.16, STEEL, verts=6, r2=0.0, rough=0.3)
    box(0.02, -0.17, 1.9, 0.03, 0.34, 0.04, WOODW_D)
    box(0.02, -0.17, 1.12, 0.02, 0.32, 0.76, (176, 36, 32))
    box(0.025, -0.17, 1.12, 0.022, 0.34, 0.05, rt.GOLD, rough=0.3)
    for k in range(3):  # caracteres dourados
        box(0.035, -0.17, 1.3 + k * 0.17, 0.01, 0.12, 0.1, rt.GOLD, emit=0.5)
    box(0.02, -0.17, 1.02, 0.02, 0.1, 0.12, (176, 36, 32)).rotation_euler = (0.785, 0, 0)


def brazier():
    """Braseiro de ferro em tripé com brasas acesas (luz suave junto dos guardas)."""
    import math
    for k in range(3):
        a = k * 2 * math.pi / 3
        o = cyl(0.16 * math.cos(a), 0.16 * math.sin(a), 0, 0.022, 0.62, IRON)
        o.rotation_euler = (-0.25 * math.sin(a), 0.25 * math.cos(a), 0)
    cyl(0, 0, 0.56, 0.12, 0.18, IRON, r2=0.24, rough=0.4)
    cyl(0, 0, 0.74, 0.25, 0.03, (50, 50, 54))
    for k in range(7):
        a = k * 0.9
        sphere(0.12 * math.cos(a), 0.12 * math.sin(a), 0.76, 0.07, EMBER, emit=4.0)
    sphere(0, 0, 0.8, 0.09, (255, 170, 60), emit=5.0)


# ---- Mestre do Cais: mesa de registro, âncora com cordas e sino do porto ----
def harbor_desk():
    """Mesa de registro do cais (2x1): livro de cargas aberto, balança de bronze, ábaco, carimbo e rolos de manifesto."""
    box(0, 0, 0, 1.6, 0.6, 0.62, WOODW_D)
    box(0, -0.31, 0.1, 1.5, 0.02, 0.42, WOODW)
    box(0, 0, 0.62, 1.72, 0.7, 0.05, WOODW)
    box(-0.4, 0, 0.67, 0.5, 0.36, 0.03, (120, 40, 36))  # livro
    for sx in (-1, 1):
        box(-0.4 + sx * 0.12, 0, 0.7, 0.22, 0.32, 0.015, PAPER)
    for k in range(4):
        box(-0.52 + (k % 2) * 0.24, -0.08 + (k // 2) * 0.12, 0.716, 0.16, 0.01, 0.002, INK)
    # ábaco
    box(0.18, 0.05, 0.67, 0.4, 0.22, 0.02, WOODW_D)
    for r in range(4):
        cyl(0.18, -0.05 + r * 0.065, 0.7, 0.006, 0.36, (160, 130, 80)).rotation_euler = (0, 1.5708, 0)
        bpy.context.object.location = (0.18, -0.05 + r * 0.065, 0.7)
        for b in range(5):
            sphere(0.05 + b * 0.06 + (r % 2) * 0.03, -0.05 + r * 0.065, 0.7, 0.022, (150, 40, 36), sz=0.7)
    # balança
    cyl(0.62, 0.1, 0.67, 0.07, 0.03, rt.GOLD)
    cyl(0.62, 0.1, 0.7, 0.015, 0.32, rt.GOLD)
    box(0.62, 0.1, 1.02, 0.4, 0.02, 0.02, rt.GOLD)
    for sx in (-1, 1):
        cyl(0.62 + sx * 0.19, 0.1, 0.9, 0.08, 0.02, rt.GOLD, rough=0.3)
        cyl(0.62 + sx * 0.19, 0.1, 0.92, 0.004, 0.1, rt.GOLD)
    for k in range(3):  # manifestos enrolados
        o = cyl(0.62, -0.22 + k * 0.0, 0.69 + k * 0.05, 0.03, 0.28, PAPER)
        o.rotation_euler = (0, 1.5708, 0)
        o.location = (0.62, -0.22, 0.7 + k * 0.05)
    cyl(-0.78, 0.2, 0.67, 0.04, 0.08, (180, 40, 36))  # carimbo


def anchor_ropes():
    """Âncora de ferro encostada num rolo de corda grossa, com uma boia de madeira."""
    import math
    for k in range(4):  # rolo de corda
        cyl(-0.12, 0.1, k * 0.06, 0.26 - k * 0.02, 0.06, (176, 150, 100), verts=16)
    cyl(-0.12, 0.1, 0.24, 0.1, 0.02, (90, 74, 50))
    o = cyl(0.18, -0.05, 0.05, 0.035, 0.85, IRON)  # haste
    o.rotation_euler = (0.25, 0, 0)
    o = bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.035, location=(0.18, -0.02, 0.18))
    t = bpy.context.object
    t.rotation_euler = (1.32, 0, 0)
    t.data.materials.append(rt.mat(IRON))
    box(0.18, 0.12, 0.88, 0.32, 0.05, 0.05, IRON)
    o = bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.02, location=(0.18, 0.18, 1.0))
    bpy.context.object.rotation_euler = (1.32, 0, 0)
    bpy.context.object.data.materials.append(rt.mat(IRON))
    cyl(0.32, -0.3, 0, 0.13, 0.22, (200, 60, 40), verts=12)  # boia
    cyl(0.32, -0.3, 0.09, 0.135, 0.05, (236, 230, 216))


def harbor_bell():
    """Sino do porto: pórtico de madeira com telhadinho e sino de bronze pendurado."""
    for sx in (-1, 1):
        box(sx * 0.3, 0, 0, 0.1, 0.1, 1.5, WOODW_D)
    box(0, 0, 1.45, 0.8, 0.12, 0.08, WOODW_D)
    roof(0, 0, 0.42, 0.12, 1.53, 0.2, ROOF_R, over=0.1, lift=0.05, ridge=False)
    cyl(0, 0, 1.3, 0.01, 0.16, IRON)
    cyl(0, 0, 0.98, 0.17, 0.34, (176, 130, 60), r2=0.1, rough=0.3)
    box(0, 0, 0, 0.8, 0.3, 0.06, rt.STONE_D)


# ---- portal do Trial (arena do banco): pórtico cerimonial imponente com vórtice ----
JADE = (50, 150, 116)
LACQ = (150, 30, 28)
BLOOD = (200, 30, 20)
CRIMSON = (255, 70, 30)


def _ring(x, y, z, R, r, rgb, emit=0.0, sz=1.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=(x, y, z), major_segments=48)
    o = bpy.context.object
    o.rotation_euler = (1.5708, 0, 0)
    o.scale = (1, sz, 1)
    o.data.materials.append(rt.mat(rgb, 0.3, emit))
    return o


def trial_gate():
    """Pórtico do Trial (4x2): plataforma de três degraus, colunas de laca com dragões de jade enrolados, duas vigas
    com placa dourada, telhado duplo de beirais levantados e um vórtice violeta com anéis de runas no vão."""
    import math
    # plataforma em degraus
    for k, (w, d) in enumerate([(4.0, 2.0), (3.7, 1.7), (3.4, 1.4)]):
        box(0, 0, k * 0.1, w, d, 0.1, [rt.STONE_D, rt.STONE, (150, 146, 140)][k])
    for sx in (-1, 1):
        x = sx * 1.4
        box(x, 0, 0.3, 0.62, 0.62, 0.32, rt.STONE_D)  # pedestal
        box(x, 0, 0.62, 0.5, 0.5, 0.08, rt.GOLD, rough=0.35)
        cyl(x, 0, 0.7, 0.2, 3.3, LACQ, rough=0.4)
        for z in (0.75, 2.2, 3.85):
            cyl(x, 0, z, 0.22, 0.07, rt.GOLD, rough=0.3)
        for k in range(46):  # dragão de jade enrolado na coluna
            t = k / 45
            a = t * 3 * 2 * math.pi * sx
            sphere(x + 0.24 * math.cos(a), 0.24 * math.sin(a), 0.85 + t * 2.9, 0.075 - 0.03 * t, JADE, emit=0.15)
        sphere(x + 0.24 * math.cos(3 * 2 * math.pi * sx), 0.24 * math.sin(0), 3.82, 0.1, JADE)
        # lanterna pendurada para fora
        cyl(x + sx * 0.55, -0.05, 3.05, 0.008, 0.45, WOODW_D)
        lantern(x + sx * 0.55, -0.05, 2.85, 0.16, LANT)
    # vigas e placa
    box(0, 0, 3.55, 3.7, 0.36, 0.22, LACQ, rough=0.4)
    box(0, 0, 3.95, 4.1, 0.42, 0.24, WOODW_D)
    for z in (3.55, 3.77):
        box(0, -0.19, z, 3.6, 0.02, 0.025, rt.GOLD, rough=0.3)
    box(0, -0.23, 3.36, 1.0, 0.06, 0.78, rt.GOLD, rough=0.3)
    box(0, -0.27, 3.42, 0.86, 0.03, 0.66, (40, 30, 28))
    for k in range(2):  # dois ideogramas dourados brilhando
        for b in range(3):
            box(-0.18 + k * 0.36, -0.29, 3.5 + b * 0.17, 0.2, 0.01, 0.04, (255, 210, 100), emit=3.0)
        box(-0.18 + k * 0.36, -0.29, 3.5, 0.04, 0.01, 0.42, (255, 210, 100), emit=3.0)
    # telhado duplo
    roof(0, 0, 1.95, 0.32, 4.19, 0.42, ROOF_T, over=0.42, lift=0.32)
    box(0, 0, 4.55, 1.4, 0.3, 0.3, LACQ)
    roof(0, 0, 0.75, 0.2, 4.85, 0.36, ROOF_T, over=0.34, lift=0.28)
    for sx in (-1, 1):
        sphere(sx * 0.55, 0, 5.28, 0.09, rt.GOLD, emit=0.8)
    sphere(0, 0, 5.32, 0.13, (255, 200, 90), emit=3.0)
    # vórtice no vão: abismo escuro no centro, espiral de fogo vermelho-sangue e anéis de runas douradas
    zc = 1.95
    o = cyl(0, 0.06, zc, 1.1, 0.04, (40, 6, 6), emit=0.6, verts=48)
    o.rotation_euler = (1.5708, 0, 0)
    o.location = (0, 0.06, zc)
    o.scale = (1, 1.2, 1)
    for arm in range(5):  # braços finos da espiral, brasa no centro escurecendo em sangue na borda
        for k in range(36):
            t = k / 35
            a = t * 1.7 * math.pi + arm * 2 * math.pi / 5
            r = 0.18 + t * 0.9
            c = (int(255 - 90 * t), int(120 - 105 * t), int(40 - 30 * t))
            sphere(r * math.cos(a), 0.0, zc + 1.2 * r * math.sin(a), 0.018 + 0.03 * t, c, emit=5.0 - 3 * t)
    o = cyl(0, 0.02, zc, 0.5, 0.03, (120, 10, 10), emit=1.5, verts=32)  # olho do abismo
    o.rotation_euler = (1.5708, 0, 0)
    o.location = (0, 0.02, zc)
    o.scale = (1, 1.2, 1)
    sphere(0, 0.03, zc, 0.12, (10, 0, 0))
    _ring(0, -0.02, zc, 1.15, 0.06, rt.GOLD, emit=1.2, sz=1.2)
    _ring(0, -0.04, zc, 1.05, 0.03, CRIMSON, emit=6.0, sz=1.2)
    for k in range(12):  # runas em volta
        a = k * math.pi / 6
        box(1.15 * math.cos(a), -0.08, zc + 1.38 * math.sin(a) - 0.05, 0.1, 0.02, 0.1, (255, 200, 120), emit=4.0)
    # aumenta tudo 25% (pórtico maior que as casas em volta)
    for ob in bpy.context.scene.objects:
        if ob.type == 'MESH':
            ob.location = [v * 1.25 for v in ob.location]
            ob.scale = [v * 1.25 for v in ob.scale]


def big_brazier():
    """Braseiro grande de bronze sobre pedestal de pedra (cantos da arena do Trial); as chamas são partículas no jogo."""
    import math
    box(0, 0, 0, 0.7, 0.7, 0.2, rt.STONE_D)
    box(0, 0, 0.2, 0.5, 0.5, 0.5, rt.STONE)
    box(0, 0, 0.7, 0.62, 0.62, 0.08, rt.STONE_D)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        o = cyl(0.2 * math.cos(a), 0.2 * math.sin(a), 0.78, 0.04, 0.4, (120, 84, 40), rough=0.35)
    cyl(0, 0, 1.08, 0.18, 0.22, (140, 96, 44), r2=0.38, rough=0.35)
    cyl(0, 0, 1.3, 0.4, 0.05, rt.GOLD, rough=0.3)
    for k in range(10):
        a = k * 0.63
        sphere(0.22 * math.cos(a), 0.22 * math.sin(a), 1.3, 0.09, EMBER, emit=5.0)
    sphere(0, 0, 1.36, 0.16, (255, 190, 80), emit=6.0)
    for k in range(4):  # cabeças de dragão nas alças
        a = k * math.pi / 2
        sphere(0.42 * math.cos(a), 0.42 * math.sin(a), 1.22, 0.06, JADE)

# ---- barracas sem vendedor: lanternas e fogos de papel (oeste); seda e leques (leste) ----
def paper_lantern_rack():
    """Armação de bambu com lanternas de papel coloridas penduradas em duas fileiras (acesas)."""
    BAM = (150, 130, 70)
    for sx in (-1, 1):
        cyl(sx * 0.42, 0, 0, 0.03, 1.5, BAM)
    for z in (1.45, 0.95):
        o = cyl(-0.45, 0, z, 0.02, 0.9, BAM)
        o.rotation_euler = (0, 1.5708, 0)
        o.location = (0, 0, z)
    cols = [(230, 50, 40), (246, 170, 60), (240, 90, 140), (120, 200, 90), (90, 150, 240)]
    for row, z in enumerate((1.45, 0.95)):
        for k in range(4):
            x = -0.3 + k * 0.2
            cyl(x, 0, z - 0.1, 0.004, 0.1, INK)
            lantern(x, 0, z - 0.2, 0.075, cols[(k + row * 2) % 5])
            sphere(x, 0, z - 0.2, 0.05, cols[(k + row * 2) % 5], emit=2.5)


def fireworks():
    """Fogos de papel: tubos vermelhos com pavio em cesto, rojões em leque e uma caixa com o ideograma dourado."""
    import math
    cyl(-0.1, 0.1, 0, 0.22, 0.22, (176, 140, 80), r2=0.25)
    for k in range(7):
        a = k * 0.9
        x, y = -0.1 + 0.12 * math.cos(a) * (k > 0), 0.1 + 0.12 * math.sin(a) * (k > 0)
        cyl(x, y, 0.1, 0.045, 0.34 + 0.04 * (k % 3), (200, 36, 30))
        cyl(x, y, 0.44 + 0.04 * (k % 3), 0.046, 0.03, rt.GOLD)
    for k in range(5):  # rojões
        o = cyl(0.25, -0.15, 0.0, 0.012, 0.75, (150, 110, 70))
        o.rotation_euler = (0.25 * (k - 2) * 0.6, 0.2, 0)
    box(0.0, -0.25, 0, 0.36, 0.24, 0.2, (180, 30, 28))
    box(0.0, -0.375, 0.05, 0.12, 0.01, 0.12, rt.GOLD, emit=0.8)


def silk_bolts():
    """Prateleira de rolos de seda coloridos deitados, com uma peça desenrolada caindo na frente."""
    for sx in (-1, 1):
        box(sx * 0.4, 0, 0, 0.06, 0.34, 1.0, WOODW_D)
    cols = [(180, 40, 60), (60, 120, 170), (230, 190, 80), (90, 150, 100), (150, 70, 160), (236, 226, 210)]
    for k, z in enumerate((0.12, 0.46, 0.8)):
        box(0, 0, z - 0.03, 0.82, 0.34, 0.03, WOODW)
        for i in range(2):
            o = cyl(0, -0.07 + i * 0.14, z + 0.07, 0.07, 0.72, cols[(k * 2 + i) % 6], rough=0.35)
            o.rotation_euler = (0, 1.5708, 0)
            o.location = (0, -0.07 + i * 0.14, z + 0.07)
    box(0.1, -0.2, 0.15, 0.3, 0.01, 0.7, (180, 40, 60), rough=0.35)  # pano caindo
    box(0, 0, 1.0, 0.9, 0.38, 0.05, WOODW_D)


def fan_display():
    """Leques de papel abertos num suporte em degraus e uma sombrinha aberta por cima."""
    import math
    box(0, 0.05, 0, 0.6, 0.4, 0.3, WOODW)
    box(0, 0.12, 0.3, 0.6, 0.26, 0.15, WOODW)
    cols = [(220, 60, 50), (240, 220, 180), (80, 130, 200)]
    for k in range(3):
        x = -0.2 + k * 0.2
        z = 0.32 + (k == 1) * 0.15
        for b in range(9):
            a = -1.1 + b * 0.275
            o = box(x + 0.12 * math.sin(a), -0.05 + (k == 1) * 0.07, z + 0.12 * math.cos(a), 0.05, 0.01, 0.24,
                    cols[(k + b) % 3] if b % 2 else cols[k])
            o.rotation_euler = (0, a, 0)
    cyl(0.3, 0.2, 0, 0.012, 0.95, WOODW_D)
    cyl(0.3, 0.2, 0.9, 0.38, 0.12, (60, 120, 160), r2=0.02, verts=16)


SET = {
    'porto_casa_4x3': (lambda: porto_house(4, 3), (4, 3), 3.6),
    'porto_casa_3x4': (lambda: porto_house(3, 4, door='x', roof_rgb=ROOF_T), (3, 4), 3.6),
    'porto_casa_3x3': (lambda: porto_house(3, 3, roof_rgb=ROOF_T), (3, 3), 3.6),
    'porto_casa_5x4': (lambda: porto_house(5, 4, wall_h=1.6), (5, 4), 3.9),
    'porto_estabulo': (stable, (6, 4), 3.6),
    'cavalo_a': (horse(-0.6), (2, 2), 2.2),
    'cavalo_b': (horse(2.3, (70, 50, 40)), (2, 2), 2.2),
    'cocho': (trough, (2, 1), 0.9),
    'feno': (hay_pile, (1, 1), 1.1),
    'sela': (saddle_rack, (1, 1), 1.0),
    'palanque': (hitching_rail, (2, 1), 1.0),
    'sacos_racao': (feed_sacks, (1, 1), 0.8),
    'cavalo_c': (horse(2.4, (150, 150, 150)), (2, 2), 2.2),
    'porto_forja': (forge_shop, (5, 4), 3.6),
    'fornalha': (hearth, (1, 1), 1.6),
    'bigorna': (anvil, (1, 1), 1.0),
    'suporte_armas': (weapon_rack, (1, 1), 1.6),
    'tina_tempera': (quench_tub, (1, 1), 1.0),
    'porto_joalheria': (jewel_shop, (4, 4), 3.6),
    'vitrine_joias': (jewel_counter, (2, 1), 1.6),
    'expositor_gemas': (gem_display, (1, 1), 1.2),
    'porto_casa_cha': (tea_house, (5, 4), 4.4),
    'porto_antiquario': (antique_shop, (4, 4), 3.6),
    'banca_reliquias': (relic_stall, (2, 1), 1.6),
    'leao_pedra': (stone_lion, (1, 1), 1.3),
    'jarros_antigos': (old_jars, (1, 1), 1.0),
    'porto_banco': (lambda: rc.jade_house(5, 4, roof_rgb=ROOF_T, extras=[rt.shop_sign((214, 172, 64))]), (5, 4), 4.4),
    'barraca_vermelha': (stall_night((170, 40, 36)), (2, 2), 2.4),
    'barraca_ambar': (stall_night((200, 130, 40)), (2, 2), 2.4),
    'lanterna_poste': (lantern_post, (1, 1), 2.2),
    'estante_pocoes': (potion_shelf, (1, 1), 1.6),
    'varal_peixe': (fish_rack, (1, 1), 1.5),
    'jarros_cha': (tea_jars, (1, 1), 0.9),
    'cestos': (baskets, (1, 1), 0.9),
    'sacos_especiarias': (spice_sacks, (1, 1), 0.9),
    'marco_caminhos': (waymarker, (1, 1), 2.0),
    'mesa_mapas': (map_table, (2, 1), 1.1),
    'bagagem_viagem': (travel_gear, (1, 1), 1.3),
    'estandarte': (banner, (1, 1), 2.4),
    'braseiro': (brazier, (1, 1), 1.0),
    'mesa_registro': (harbor_desk, (2, 1), 1.2),
    'ancora': (anchor_ropes, (1, 1), 1.2),
    'sino_porto': (harbor_bell, (1, 1), 1.9),
    'portal_trial': (trial_gate, (5, 3), 7.0),
    'braseiro_grande': (big_brazier, (1, 1), 1.7),
    'lanternas_papel': (paper_lantern_rack, (1, 1), 1.6),
    'fogos': (fireworks, (1, 1), 0.9),
    'rolos_seda': (silk_bolts, (1, 1), 1.2),
    'leques': (fan_display, (1, 1), 1.2),
    'lanterna_chao': (floor_lantern, (1, 1), 0.8),
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
