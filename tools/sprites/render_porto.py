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
