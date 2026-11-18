"""Ícones de itens e skills (marco 6), no lugar dos emojis e das iniciais.

Desenhados por script (formas vetoriais com degradê, contorno escuro e brilho), em 4x e reduzidos para 128 px.
Itens: fundo transparente (a célula da mochila já tem o fundo na cor da raridade).
Skills: ícone quadrado completo com fundo no tom do elemento (trovão = Tormenta, gelo = Geada, fogo = Titã, veneno = Víbora).

Uso: python tools/sprites/icons.py
Saída: public/sprites/icones.png (grade de 8 colunas de 128 px) + src/data/sprites/icones.json ({nome: índice}).
"""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
S = 512          # tamanho de trabalho
OUT = 128        # tamanho final de cada ícone
COLS = 8
OUTLINE = (24, 18, 16, 255)


# ---------- utilidades de desenho ----------
def new():
    return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def mask_poly(pts):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).polygon([(float(x), float(y)) for x, y in pts], fill=255)
    return m


def mask_ellipse(box):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    return m


def mask_line(pts, w):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).line([(float(x), float(y)) for x, y in pts], fill=255, width=int(w), joint='curve')
    for x, y in (pts[0], pts[-1]):
        ImageDraw.Draw(m).ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=255)
    return m


def gradient(c1, c2, angle=90):
    """Degradê linear de c1 (topo-esquerda) para c2 na direção do ângulo (graus, 90 = de cima para baixo)."""
    a = math.radians(angle)
    dx, dy = math.cos(a), math.sin(a)
    g = Image.linear_gradient('L').resize((S, S))  # 0 em cima, 255 embaixo
    g = g.rotate(-(angle - 90), resample=Image.BICUBIC, expand=False, fillcolor=128)
    im1 = Image.new('RGBA', (S, S), tuple(c1) + (255,) if len(c1) == 3 else tuple(c1))
    im2 = Image.new('RGBA', (S, S), tuple(c2) + (255,) if len(c2) == 3 else tuple(c2))
    _ = dx, dy
    return Image.composite(im2, im1, g)


def radial(c_in, c_out, cx=0.5, cy=0.45, r=0.7):
    y, x = [v for v in (range(S), range(S))]
    m = Image.new('L', (S, S))
    px = m.load()
    for j in range(0, S, 4):
        for i in range(0, S, 4):
            d = math.hypot(i / S - cx, j / S - cy) / r
            v = int(max(0, min(255, d * 255)))
            for jj in range(4):
                for ii in range(4):
                    px[i + ii, j + jj] = v
    m = m.filter(ImageFilter.GaussianBlur(3))
    return Image.composite(Image.new('RGBA', (S, S), tuple(c_out) + (255,)), Image.new('RGBA', (S, S), tuple(c_in) + (255,)), m)


def fill(im, m, c1, c2=None, angle=90, outline=10, shade=True):
    """Pinta a máscara m com degradê, contorno escuro e uma borda de luz em cima."""
    if outline:
        grown = m.filter(ImageFilter.MaxFilter(outline * 2 + 1 if outline * 2 + 1 <= 99 else 99))
        im.paste(Image.new('RGBA', (S, S), OUTLINE), (0, 0), grown)
    src = gradient(c1, c2 or shade_of(c1, 0.62), angle)
    im.paste(src, (0, 0), m)
    if shade:  # brilho: a máscara deslocada para baixo-direita, subtraída, vira um filete claro em cima-esquerda
        sh = ImageChops.subtract(m, ImageChops.offset(m, 10, 12)).filter(ImageFilter.GaussianBlur(3))
        hl = Image.new('RGBA', (S, S), (255, 255, 255, 0))
        hl.putalpha(sh.point(lambda v: int(v * 0.45)))
        im.alpha_composite(hl)
    return im


def shade_of(c, k):
    return tuple(int(v * k) for v in c[:3])


def lighten(c, k):
    return tuple(int(v + (255 - v) * k) for v in c[:3])


def glow(im, m, color, radius=24, strength=1.0):
    g = m.filter(ImageFilter.GaussianBlur(radius))
    layer = Image.new('RGBA', (S, S), tuple(color) + (0,))
    layer.putalpha(g.point(lambda v: int(min(255, v * strength))))
    out = new(); out.alpha_composite(layer); out.alpha_composite(im)
    return out


def rot_pts(pts, ang, cx=S / 2, cy=S / 2):
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in pts]


def bg_badge(c_in, c_out):
    """Fundo das skills: quadrado arredondado com degradê radial e moldura."""
    im = radial(c_in, c_out)
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, S - 1, S - 1), radius=70, fill=255)
    out = new(); out.paste(im, (0, 0), m)
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((10, 10, S - 11, S - 11), radius=62, outline=lighten(c_in, 0.4) + (120,), width=8)
    return out


# ---------- peças reutilizáveis ----------
def jian(im, angle, blade=(206, 214, 222), guard=(196, 156, 64), hilt=(80, 44, 36), glow_c=None, tassel=None):
    """Espada reta chinesa (jian) inclinada pelo ângulo (rad), cabo embaixo."""
    L = S * 0.86
    cx, cy = S / 2, S / 2
    tip = (cx, cy - L / 2); base = (cx, cy + L * 0.18)
    w = 26
    blade_pts = [(cx, tip[1]), (cx + w, tip[1] + 50), (cx + w, base[1]), (cx - w, base[1]), (cx - w, tip[1] + 50)]
    m = mask_poly(rot_pts(blade_pts, angle))
    layer = new()
    fill(layer, m, lighten(blade, 0.3), shade_of(blade, 0.7), angle=0)
    g = mask_poly(rot_pts([(cx - 64, base[1]), (cx + 64, base[1]), (cx + 44, base[1] + 26), (cx - 44, base[1] + 26)], angle))
    fill(layer, g, guard, outline=8)
    h = mask_poly(rot_pts([(cx - 15, base[1] + 26), (cx + 15, base[1] + 26), (cx + 15, base[1] + 120), (cx - 15, base[1] + 120)], angle))
    fill(layer, h, hilt, outline=8)
    p = mask_ellipse(_rot_box(cx, base[1] + 132, 22, angle))
    fill(layer, p, guard, outline=8)
    if tassel:
        tp = rot_pts([(cx, base[1] + 150), (cx + 30, base[1] + 210), (cx + 8, base[1] + 214)], angle)
        fill(layer, mask_poly(tp), tassel, outline=6)
    if glow_c:
        layer = glow(layer, m, glow_c, 22, 1.4)
    im.alpha_composite(layer)


def _rot_box(x, y, r, angle):
    (px, py), = rot_pts([(x, y)], angle)
    return (px - r, py - r, px + r, py + r)


def fan(im, paper, rib, accent=None, cloud=None):
    cx, cy = S / 2, S * 0.78
    R, r0 = S * 0.46, S * 0.1
    a0, a1 = math.radians(-160), math.radians(-20)
    n = 11
    layer = new()
    pts = [(cx + math.cos(a0 + (a1 - a0) * k / 40) * R, cy + math.sin(a0 + (a1 - a0) * k / 40) * R) for k in range(41)]
    pts += [(cx + math.cos(a1 - (a1 - a0) * k / 10) * r0, cy + math.sin(a1 - (a1 - a0) * k / 10) * r0) for k in range(11)]
    m = mask_poly(pts)
    fill(layer, m, lighten(paper, 0.2), shade_of(paper, 0.8), angle=90)
    # pregas
    d = ImageDraw.Draw(layer)
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        d.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * R, cy + math.sin(a) * R)],
               fill=shade_of(paper, 0.72) + (255,), width=5)
    if cloud:
        for (u, v, rr) in [(0.38, 0.42, 34), (0.5, 0.36, 40), (0.62, 0.43, 32), (0.45, 0.52, 26), (0.58, 0.53, 24)]:
            e = mask_ellipse((S * u - rr, S * v - rr * 0.7, S * u + rr, S * v + rr * 0.7))
            e = ImageChops.multiply(e, m)
            layer.paste(Image.new('RGBA', (S, S), cloud + (255,)), (0, 0), e)
    if accent:
        band = ImageChops.subtract(m, mask_ellipse((cx - R + 26, cy - R + 26, cx + R - 26, cy + R - 26)))
        layer.paste(Image.new('RGBA', (S, S), accent + (255,)), (0, 0), band)
    # varetas externas e pino
    for a in (a0, a1):
        fill(layer, mask_line([(cx, cy), (cx + math.cos(a) * R * 1.02, cy + math.sin(a) * R * 1.02)], 16), rib, outline=6)
    fill(layer, mask_ellipse((cx - 22, cy - 22, cx + 22, cy + 22)), (200, 160, 70), outline=6)
    im.alpha_composite(layer)


def robe(im, cloth, trim, belt, sleeves_long=True):
    cx = S / 2
    body = [(cx - 70, 110), (cx - 160, 150), (cx - 205, 290), (cx - 150, 312), (cx - 112, 240), (cx - 110, 450),
            (cx + 110, 450), (cx + 112, 240), (cx + 150, 312), (cx + 205, 290), (cx + 160, 150), (cx + 70, 110)]
    if not sleeves_long:
        body = [(cx - 70, 110), (cx - 150, 150), (cx - 175, 240), (cx - 118, 252), (cx - 110, 450),
                (cx + 110, 450), (cx + 118, 252), (cx + 175, 240), (cx + 150, 150), (cx + 70, 110)]
    fill(im, mask_poly(body), lighten(cloth, 0.15), shade_of(cloth, 0.7))
    # gola cruzada
    fill(im, mask_poly([(cx - 70, 110), (cx - 40, 110), (cx + 60, 260), (cx + 30, 280)]), trim, outline=5, shade=False)
    fill(im, mask_poly([(cx + 70, 110), (cx + 40, 110), (cx - 10, 190), (cx - 30, 170)]), trim, outline=5, shade=False)
    fill(im, mask_poly([(cx - 112, 262), (cx + 112, 262), (cx + 112, 304), (cx - 112, 304)]), belt, outline=6)
    fill(im, mask_poly([(cx - 110, 430), (cx + 110, 430), (cx + 110, 450), (cx - 110, 450)]), trim, outline=0, shade=False)


def pants(im, cloth, strap=None, belt=(90, 60, 40)):
    cx = S / 2
    pts = [(cx - 120, 90), (cx + 120, 90), (cx + 150, 440), (cx + 30, 450), (cx, 200), (cx - 30, 450), (cx - 150, 440)]
    fill(im, mask_poly(pts), lighten(cloth, 0.15), shade_of(cloth, 0.7))
    fill(im, mask_poly([(cx - 122, 86), (cx + 122, 86), (cx + 124, 128), (cx - 124, 128)]), belt, outline=6)
    if strap:
        for y in (250, 340):
            for sx in (-1, 1):
                x0 = cx + sx * 40; x1 = cx + sx * 145
                fill(im, mask_poly([(x0, y), (x1, y + 6), (x1, y + 30), (x0, y + 24)]), strap, outline=4, shade=False)
    for sx in (-1, 1):
        fill(im, mask_poly([(cx + sx * 30, 425), (cx + sx * 150, 418), (cx + sx * 150, 444), (cx + sx * 30, 452)]), shade_of(cloth, 0.6), outline=0, shade=False)


def boot(im, cloth, sole, trim=None, sandal=False):
    def one(dx, dy, k=1.0):
        layer = new()
        if sandal:
            sole_pts = [(150, 380), (360, 360), (400, 392), (380, 420), (150, 420), (128, 400)]
            fill(layer, mask_poly([(x + dx, y + dy) for x, y in sole_pts]), sole)
            for (a, b) in [((200, 300), (270, 375)), ((300, 300), (240, 375)), ((180, 260), (330, 290))]:
                fill(layer, mask_line([(a[0] + dx, a[1] + dy), (b[0] + dx, b[1] + dy)], 22), cloth, outline=6)
        else:
            pts = [(170, 110), (290, 110), (300, 300), (395, 340), (410, 400), (150, 400), (160, 250)]
            fill(layer, mask_poly([(x + dx, y + dy) for x, y in pts]), lighten(cloth, 0.15), shade_of(cloth, 0.65))
            fill(layer, mask_poly([(x + dx, y + dy) for x, y in [(148, 395), (412, 395), (412, 425), (148, 425)]]), sole, outline=6)
            if trim:
                fill(layer, mask_poly([(x + dx, y + dy) for x, y in [(166, 110), (294, 110), (296, 150), (164, 150)]]), trim, outline=6)
        if k != 1:
            layer = layer.point(lambda v: v)  # (mantido simples)
        im.alpha_composite(layer)
    one(-70, -30)
    one(40, 40)


def potion(im, liquid, big=False):
    cx = S / 2
    r = 150 if big else 118
    cy = 320 if big else 340
    neck_w = 46 if big else 38
    layer = new()
    body = mask_ellipse((cx - r, cy - r, cx + r, cy + r))
    neck = mask_poly([(cx - neck_w, cy - r - 70), (cx + neck_w, cy - r - 70), (cx + neck_w, cy - r + 30), (cx - neck_w, cy - r + 30)])
    glass = ImageChops.lighter(body, neck)
    fill(layer, glass, (210, 230, 240), (150, 170, 190))
    liq = ImageChops.multiply(mask_ellipse((cx - r + 18, cy - r + 18, cx + r - 18, cy + r - 18)),
                              mask_poly([(0, cy - r * 0.35), (S, cy - r * 0.45), (S, S), (0, S)]))
    layer.paste(gradient(lighten(liquid, 0.25), shade_of(liquid, 0.6)), (0, 0), liq)
    fill(layer, mask_poly([(cx - neck_w - 10, cy - r - 110), (cx + neck_w + 10, cy - r - 110), (cx + neck_w + 4, cy - r - 62), (cx - neck_w - 4, cy - r - 62)]),
         (150, 100, 60), outline=6)
    if big:
        fill(layer, mask_line([(cx - neck_w, cy - r - 30), (cx + neck_w, cy - r - 30)], 14), (200, 160, 70), outline=4)
    hl = mask_ellipse((cx - r * 0.62, cy - r * 0.6, cx - r * 0.28, cy - r * 0.05))
    layer.paste(Image.new('RGBA', (S, S), (255, 255, 255, 150)), (0, 0), hl)
    layer = glow(layer, liq, liquid, 30, 0.8)
    im.alpha_composite(layer)


# ---------- itens ----------
def i_colar_jade(im):
    fill(im, mask_line([(110, 100), (170, 260), (256, 300), (342, 260), (402, 100)], 14), (120, 86, 60), outline=6)
    m = ImageChops.subtract(mask_ellipse((166, 270, 346, 450)), mask_ellipse((228, 332, 284, 388)))
    fill(im, m, (150, 220, 160), (50, 130, 80))


def i_colar_dragao(im):
    for k in range(12):
        t = k / 11
        x = 110 + 292 * t; y = 100 + 190 * math.sin(math.pi * t)
        fill(im, mask_ellipse((x - 18, y - 12, x + 18, y + 12)), (230, 190, 80), outline=5)
    fill(im, mask_poly([(196, 300), (316, 300), (290, 340), (222, 340)]), (220, 176, 66), outline=7)
    m = mask_ellipse((180, 320, 332, 472))
    part = new(); fill(part, m, (140, 230, 255), (30, 90, 200))
    im.alpha_composite(glow(part, m, (120, 200, 255), 26, 1.3))


def i_tunica(im):
    robe(im, (196, 180, 150), (240, 232, 210), (120, 90, 60), sleeves_long=False)


def i_manto(im):
    robe(im, (60, 100, 180), (220, 180, 80), (40, 60, 110))


def i_espadas_ferro(im):
    jian(im, -0.55); jian(im, 0.55)


def i_espadas_vento(im):
    jian(im, -0.55, blade=(170, 230, 240), glow_c=(120, 230, 255), tassel=(80, 200, 200))
    jian(im, 0.55, blade=(170, 230, 240), glow_c=(120, 230, 255), tassel=(80, 200, 200))


def i_leque_bambu(im):
    fan(im, (236, 222, 186), (150, 120, 60))


def i_leque_nuvens(im):
    fan(im, (246, 248, 252), (90, 110, 150), accent=(110, 170, 230), cloud=(170, 205, 240))


def i_faixa(im):
    """Faixa de linho na testa, vista de frente: tira curva com o nó e as pontas soltas do lado."""
    band = Image.new('L', (S, S), 0)
    ImageDraw.Draw(band).arc((70, 150, 442, 420), 195, 345, fill=255, width=64)
    fill(im, band, (232, 222, 196), (170, 156, 128))
    fill(im, mask_poly([(388, 196), (470, 300), (440, 318), (372, 226)]), (220, 208, 180), outline=8)
    fill(im, mask_poly([(392, 206), (420, 330), (388, 336), (372, 222)]), (206, 194, 166), outline=8)
    fill(im, mask_ellipse((360, 180, 418, 238)), (200, 186, 156), outline=8)
    fill(im, mask_ellipse((226, 150, 286, 190)), (190, 60, 50), outline=6)


def i_coroa(im):
    base = mask_poly([(120, 300), (392, 300), (372, 400), (140, 400)])
    fill(im, base, (210, 160, 80), (130, 90, 40))
    fill(im, mask_poly([(150, 300), (196, 150), (236, 300)]), (220, 170, 86), outline=8)
    fill(im, mask_poly([(216, 300), (256, 110), (296, 300)]), (230, 180, 90), outline=8)
    fill(im, mask_poly([(276, 300), (316, 150), (362, 300)]), (220, 170, 86), outline=8)
    fill(im, mask_ellipse((232, 316, 280, 364)), (220, 60, 50), outline=6)


def i_calca_algodao(im):
    pants(im, (190, 176, 146))


def i_calca_couro(im):
    pants(im, (130, 86, 54), strap=(70, 44, 30), belt=(60, 40, 28))


def i_sandalia(im):
    boot(im, (200, 170, 100), (176, 140, 80), sandal=True)


def i_botas(im):
    boot(im, (50, 70, 120), (40, 34, 30), trim=(210, 170, 70))


# ---------- skills ----------
THUNDER_BG = ((110, 70, 150), (30, 18, 48))
ICE_BG = ((80, 150, 210), (14, 34, 70))
FIRE_BG = ((220, 110, 40), (70, 14, 10))
POISON_BG = ((90, 170, 70), (14, 44, 24))


def bolt_mask(pts, w=34):
    return mask_poly(pts)


def s_corte_duplo(im):
    """Dois cortes em arco, lado a lado (presas), com faísca no meio."""
    for dx, start, col in ((-70, 120, (255, 230, 120)), (70, 300, (255, 250, 200))):
        arc = new()
        m = Image.new('L', (S, S), 0)
        ImageDraw.Draw(m).arc((110 + dx, 110, 402 + dx, 402), start, start + 120, fill=255, width=38)
        fill(arc, m, col, (230, 160, 40), outline=7)
        im.alpha_composite(glow(arc, m, (255, 220, 90), 18, 1.2))
    spark = mask_poly([(256, 196), (276, 246), (322, 256), (276, 266), (256, 316), (236, 266), (190, 256), (236, 246)])
    fill(im, spark, (255, 255, 230), outline=0)


def s_passo(im):
    pts = [(300, 70), (170, 270), (250, 270), (190, 450), (350, 220), (268, 220), (330, 70)]
    m = mask_poly(pts)
    layer = new(); fill(layer, m, (255, 245, 150), (240, 180, 40))
    im.alpha_composite(glow(layer, m, (200, 160, 255), 28, 1.5))
    for y, l in ((170, 90), (250, 120), (330, 80)):
        fill(im, mask_line([(80, y), (80 + l, y)], 12), (200, 180, 255), outline=0, shade=False)


def s_tempestade(im):
    for k in range(6):
        a = k * math.pi / 3
        pts = [(256, 120), (282, 200), (256, 236), (232, 200)]
        m = mask_poly(rot_pts(pts, a))
        trail = Image.new('L', (S, S), 0)
        ImageDraw.Draw(trail).arc((130, 130, 382, 382), math.degrees(a) - 120, math.degrees(a) - 95, fill=180, width=16)
        im.paste(Image.new('RGBA', (S, S), (255, 220, 100, 255)), (0, 0), trail)
        fill(im, m, (240, 244, 250), (150, 160, 180), outline=6)
    c = mask_ellipse((216, 216, 296, 296))
    layer = new(); fill(layer, c, (255, 240, 150), outline=0)
    im.alpha_composite(glow(layer, c, (255, 210, 80), 26, 1.6))


def s_quebra(im):
    sh = mask_poly([(256, 110), (380, 150), (370, 300), (256, 410), (142, 300), (132, 150)])
    fill(im, sh, (150, 150, 160), (80, 80, 90))
    crack = mask_line([(256, 110), (236, 190), (276, 250), (240, 320), (262, 410)], 14)
    im.paste(Image.new('RGBA', (S, S), (30, 10, 10, 255)), (0, 0), crack)
    blade = mask_poly([(392, 60), (412, 80), (290, 300), (270, 280)])
    layer = new(); fill(layer, blade, (255, 220, 200), (220, 70, 50), outline=7)
    im.alpha_composite(glow(layer, blade, (255, 80, 50), 22, 1.4))


def s_fluxo(im):
    for k, (y, col) in enumerate(((180, (220, 230, 255)), (260, (190, 200, 240)), (340, (160, 170, 220)))):
        pts = [(80 + 40 * k, y + 30), (180, y - 20), (300, y + 30), (430 - 30 * k, y - 30)]
        fill(im, mask_line(pts, 22 - k * 3), col, outline=0)
    jian_layer = new(); jian(jian_layer, 0.8, blade=(230, 236, 244))
    im.alpha_composite(jian_layer.resize((S, S)))


def s_orbe(im):
    m = mask_ellipse((136, 136, 376, 376))
    layer = new()
    layer.paste(radial((240, 252, 255), (60, 140, 220), 0.42, 0.4, 0.5), (0, 0), m)
    d = ImageDraw.Draw(layer)
    for k in range(6):
        a = k * math.pi / 3
        d.line([(256, 256), (256 + math.cos(a) * 90, 256 + math.sin(a) * 90)], fill=(255, 255, 255, 160), width=8)
    im.alpha_composite(glow(layer, m, (140, 220, 255), 34, 1.6))


def s_lotus(im):
    for k in range(7):
        a = -math.pi / 2 + (k - 3) * 0.42
        pts = [(256, 380), (256 + 40, 300), (256, 140), (256 - 40, 300)]
        m = mask_poly(rot_pts(pts, a + math.pi / 2, 256, 380))
        fill(im, m, (230, 250, 255), (110, 190, 240), outline=7)
    base = mask_ellipse((150, 360, 362, 420))
    fill(im, base, (150, 210, 245), (70, 130, 200), outline=7)


def s_nevasca(im):
    d = new()
    for k in range(6):
        a = k * math.pi / 3
        x2, y2 = 256 + math.cos(a) * 160, 220 + math.sin(a) * 160
        fill(d, mask_line([(256, 220), (x2, y2)], 20), (240, 250, 255), outline=6, shade=False)
        for t in (0.55,):
            bx, by = 256 + math.cos(a) * 160 * t, 220 + math.sin(a) * 160 * t
            for s2 in (-1, 1):
                fill(d, mask_line([(bx, by), (bx + math.cos(a + s2 * 0.8) * 50, by + math.sin(a + s2 * 0.8) * 50)], 14), (240, 250, 255), outline=5, shade=False)
    im.alpha_composite(glow(d, d.getchannel('A'), (160, 220, 255), 20, 1.2))
    for x in (130, 256, 382):
        pts = [(x, 470), (x + 18, 410), (x, 390), (x - 18, 410)]
        fill(im, mask_poly(pts), (200, 240, 255), (90, 160, 220), outline=5)


def s_veu(im):
    ring = ImageChops.subtract(mask_ellipse((96, 96, 416, 416)), mask_ellipse((136, 136, 376, 376)))
    layer = new(); fill(layer, ring, (240, 248, 255), (170, 200, 230), outline=6)
    im.alpha_composite(glow(layer, ring, (200, 230, 255), 24, 1.2))
    for (u, v, r) in [(0.4, 0.55, 54), (0.56, 0.5, 64), (0.66, 0.6, 44), (0.48, 0.64, 46)]:
        m = mask_ellipse((S * u - r, S * v - r * 0.7, S * u + r, S * v + r * 0.7))
        im.paste(Image.new('RGBA', (S, S), (235, 245, 255, 200)), (0, 0), m)


def s_mente(im):
    m = ImageChops.subtract(mask_ellipse((126, 96, 386, 356)), mask_ellipse((176, 76, 426, 326)))
    layer = new(); fill(layer, m, (230, 220, 255), (150, 130, 220), outline=7)
    im.alpha_composite(glow(layer, m, (200, 180, 255), 26, 1.3))
    for (x, y, r) in [(330, 170, 14), (370, 250, 10), (300, 120, 8)]:
        fill(im, mask_ellipse((x - r, y - r, x + r, y + r)), (255, 255, 255), outline=0)
    fill(im, mask_line([(120, 420), (190, 380), (256, 420), (322, 380), (392, 420)], 18), (170, 150, 240), outline=0)


# ---------- armas das seitas Titã e Víbora (marco 8) ----------
def staff(im, shaft, cap, glow_c=None, band=(70, 50, 40)):
    """Bastão curto na diagonal com tampas de metal; opcionalmente com veios de brasa."""
    ang = 0.7
    cx, cy = S / 2, S / 2
    L = 190
    body = mask_poly(rot_pts([(cx - 24, cy - L), (cx + 24, cy - L), (cx + 24, cy + L), (cx - 24, cy + L)], ang))
    layer = new()
    fill(layer, body, lighten(shaft, 0.2), shade_of(shaft, 0.6), angle=0)
    for dy in (-L, L - 56):
        fill(layer, mask_poly(rot_pts([(cx - 32, cy + dy), (cx + 32, cy + dy), (cx + 32, cy + dy + 56), (cx - 32, cy + dy + 56)], ang)), cap, outline=8)
    for dy in (-60, 60):
        fill(layer, mask_poly(rot_pts([(cx - 27, cy + dy), (cx + 27, cy + dy), (cx + 27, cy + dy + 24), (cx - 27, cy + dy + 24)], ang)), band, outline=5, shade=False)
    if glow_c:
        for dy in (-130, -20, 90, 150):  # veios de brasa
            fill(layer, mask_poly(rot_pts([(cx - 8, cy + dy - 20), (cx + 8, cy + dy - 20), (cx + 6, cy + dy + 24), (cx - 6, cy + dy + 24)], ang)), (255, 210, 90), (255, 110, 30), outline=0, shade=False)
        layer = glow(layer, body, glow_c, 24, 1.3)
    im.alpha_composite(layer)


def i_bastao_ferro(im):
    staff(im, (110, 112, 124), (170, 174, 184))


def i_bastao_brasa(im):
    staff(im, (70, 40, 34), (200, 90, 40), glow_c=(255, 110, 40), band=(40, 24, 20))


def needles(im, metal, head, glow_c=None):
    """Três agulhas longas em leque, ponta para cima, cabecinha redonda embaixo."""
    layer = new()
    px0, py0 = S / 2, S - 30
    for ang in (-0.42, 0.0, 0.42):
        m = mask_poly(rot_pts([(px0, 40), (px0 + 11, 120), (px0 + 11, 400), (px0 - 11, 400), (px0 - 11, 120)], ang, px0, py0))
        fill(layer, m, lighten(metal, 0.4), shade_of(metal, 0.65), angle=0, outline=8)
        (px, py), = rot_pts([(px0, 420)], ang, px0, py0)
        fill(layer, mask_ellipse((px - 28, py - 28, px + 28, py + 28)), head, outline=8)
    if glow_c:
        layer = glow(layer, layer.getchannel('A'), glow_c, 20, 1.0)
    im.alpha_composite(layer)


def i_agulhas_bronze(im):
    needles(im, (200, 140, 70), (150, 70, 40))


def i_agulhas_jade(im):
    needles(im, (170, 240, 190), (40, 150, 90), glow_c=(90, 230, 140))


# ---------- skills do Titã (fogo) e da Víbora (veneno) ----------
def fist(layer, col, col2, cx=256, cy=270, k=1.0):
    """Punho fechado visto de frente: bloco com quatro nós dos dedos e o polegar."""
    body = mask_poly([(cx - 110 * k, cy - 30 * k), (cx + 110 * k, cy - 30 * k), (cx + 120 * k, cy + 90 * k), (cx + 70 * k, cy + 150 * k), (cx - 70 * k, cy + 150 * k), (cx - 120 * k, cy + 90 * k)])
    fill(layer, body, col, col2)
    for i in range(4):
        x = cx - 82 * k + i * 55 * k
        fill(layer, mask_ellipse((x - 30 * k, cy - 80 * k, x + 30 * k, cy - 10 * k)), lighten(col, 0.1), col2, outline=7)
    fill(layer, mask_poly([(cx - 110 * k, cy + 10 * k), (cx - 30 * k, cy + 60 * k), (cx - 40 * k, cy + 100 * k), (cx - 120 * k, cy + 70 * k)]), col, col2, outline=6, shade=False)
    return body


def s_punho_montanha(im):
    mtn = mask_poly([(60, 440), (190, 190), (250, 290), (340, 120), (460, 440)])
    fill(im, mtn, (150, 120, 90), (70, 50, 40))
    fill(im, mask_poly([(340, 120), (300, 200), (340, 190), (370, 215), (392, 190)]), (250, 240, 225), (200, 190, 175), outline=5, shade=False)
    layer = new(); fist(layer, (240, 170, 80), (170, 80, 30), 256, 300, 0.85)
    im.alpha_composite(layer)


def s_tremor(im):
    fill(im, mask_poly([(60, 330), (452, 330), (470, 440), (42, 440)]), (130, 96, 70), (60, 40, 34))
    crack = mask_line([(256, 440), (240, 400), (276, 350), (236, 300), (270, 240), (250, 170)], 22)
    im.paste(Image.new('RGBA', (S, S), (255, 150, 50, 255)), (0, 0), crack.filter(ImageFilter.MaxFilter(15)))
    im.paste(Image.new('RGBA', (S, S), (20, 8, 8, 255)), (0, 0), crack)
    for (x, y, w, h) in [(90, 250, 50, 70), (370, 230, 60, 90), (150, 190, 36, 50), (330, 150, 40, 56)]:
        fill(im, mask_poly([(x, y + h), (x + w * 0.2, y), (x + w, y + h * 0.15), (x + w, y + h)]), (170, 130, 96), (90, 66, 50), outline=6)
    for x in (80, 430):
        im.paste(Image.new('RGBA', (S, S), (230, 190, 130, 130)), (0, 0), mask_ellipse((x - 40, 300, x + 40, 350)))


def s_pele_ferro(im):
    sh = mask_poly([(256, 70), (410, 120), (400, 290), (256, 450), (112, 290), (102, 120)])
    layer = new(); fill(layer, sh, (200, 204, 214), (90, 96, 112))
    inner = mask_poly([(256, 120), (362, 154), (354, 276), (256, 392), (158, 276), (150, 154)])
    fill(layer, inner, (130, 136, 150), (70, 76, 92), outline=6, shade=False)
    d = ImageDraw.Draw(layer)
    for y in (200, 270, 340):
        d.line([(170, y), (342, y)], fill=(210, 214, 224, 255), width=8)
    for x in (206, 256, 306):
        d.line([(x, 150), (x, 380)], fill=(210, 214, 224, 140), width=5)
    for (x, y) in [(150, 140), (362, 140), (180, 290), (332, 290), (256, 400)]:
        d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=(60, 64, 76, 255))
    im.alpha_composite(glow(layer, sh, (255, 150, 60), 22, 0.9))


def flame(layer, cx, cy, k, c1=(255, 240, 150), c2=(255, 90, 30)):
    pts = [(cx, cy - 190 * k), (cx + 50 * k, cy - 80 * k), (cx + 110 * k, cy), (cx + 70 * k, cy + 110 * k), (cx, cy + 140 * k), (cx - 70 * k, cy + 110 * k), (cx - 110 * k, cy), (cx - 40 * k, cy - 90 * k)]
    fill(layer, mask_poly(pts), c1, c2, outline=8)


def s_punho_vulcanico(im):
    layer = new()
    flame(layer, 256, 200, 0.95)
    flame(layer, 140, 250, 0.5); flame(layer, 372, 250, 0.5)
    im.alpha_composite(glow(layer, layer.getchannel('A'), (255, 120, 40), 26, 1.0))
    l2 = new(); fist(l2, (250, 190, 120), (190, 60, 30), 256, 300, 0.82)
    im.alpha_composite(l2)
    for (x, y) in [(90, 120), (430, 140), (60, 330), (450, 360)]:
        fill(im, mask_ellipse((x - 14, y - 14, x + 14, y + 14)), (255, 210, 90), outline=0, shade=False)


def s_corpo_bronze(im):
    layer = new()
    fill(layer, mask_ellipse((196, 70, 316, 190)), (214, 150, 90), (140, 80, 40))
    fill(layer, mask_poly([(120, 215), (392, 215), (420, 300), (360, 450), (152, 450), (92, 300)]), (220, 156, 92), (130, 76, 38))
    fill(layer, mask_ellipse((90, 215, 190, 335)), (230, 166, 100), (140, 80, 40))
    fill(layer, mask_ellipse((322, 215, 422, 335)), (230, 166, 100), (140, 80, 40))
    d = ImageDraw.Draw(layer)
    d.line([(256, 225), (256, 440)], fill=(110, 60, 30, 255), width=8)
    for y in (300, 360, 420):
        d.line([(190, y), (322, y)], fill=(110, 60, 30, 255), width=7)
    d.arc((150, 230, 256, 300), 200, 340, fill=(110, 60, 30, 255), width=8)
    d.arc((256, 230, 362, 300), 200, 340, fill=(110, 60, 30, 255), width=8)
    im.alpha_composite(glow(layer, layer.getchannel('A'), (255, 190, 90), 20, 0.9))


def drop(im, x, y, r, c1=(150, 255, 90), c2=(50, 170, 50)):
    fill(im, mask_poly([(x, y - r * 1.8), (x + r, y), (x, y + r * 0.9), (x - r, y)]), c1, c2, outline=6, shade=False)


def s_agulha_venenosa(im):
    ndl = mask_poly(rot_pts([(256, 40), (272, 120), (272, 380), (240, 380), (240, 120)], 0.7))
    layer = new(); fill(layer, ndl, (230, 255, 230), (120, 190, 130), angle=0)
    fill(layer, mask_ellipse(_rot_box(256, 400, 34, 0.7)), (40, 120, 70), outline=8)
    im.alpha_composite(glow(layer, ndl, (120, 255, 120), 18, 1.0))
    drop(im, 130, 150, 38)
    drop(im, 90, 260, 26)
    drop(im, 190, 300, 22)


def s_chuva_agulhas(im):
    layer = new()
    for x, y, l in [(110, 60, 260), (190, 20, 330), (270, 50, 300), (350, 10, 340), (430, 70, 250)]:
        mm = mask_poly(rot_pts([(x, y + l), (x + 11, y + 40), (x + 11, y), (x - 11, y), (x - 11, y + 40)], 0.2, x, y))
        fill(layer, mm, (235, 255, 235), (100, 180, 120), angle=0, outline=7)
    im.alpha_composite(glow(layer, layer.getchannel('A'), (130, 255, 130), 16, 1.0))
    for (x, y) in [(90, 440), (200, 462), (330, 450), (430, 440)]:
        drop(im, x, y, 20)


def s_nevoa_toxica(im):
    puffs = [(150, 330, 100), (260, 290, 120), (370, 340, 96), (210, 400, 90), (330, 410, 84), (256, 360, 100)]
    layer = new()
    for (x, y, r) in puffs:
        fill(layer, mask_ellipse((x - r, y - r * 0.72, x + r, y + r * 0.72)), (150, 235, 110), (40, 120, 60), outline=8)
    im.alpha_composite(glow(layer, layer.getchannel('A'), (120, 255, 90), 24, 0.9))
    sk = new()
    fill(sk, mask_ellipse((196, 80, 316, 200)), (240, 244, 232), (170, 180, 160))
    fill(sk, mask_poly([(220, 186), (292, 186), (286, 250), (226, 250)]), (240, 244, 232), (170, 180, 160), outline=8)
    for x in (226, 286):
        fill(sk, mask_ellipse((x - 26, 120, x + 26, 172)), (20, 40, 20), outline=0, shade=False)
    fill(sk, mask_poly([(256, 176), (244, 204), (268, 204)]), (20, 40, 20), outline=0, shade=False)
    d = ImageDraw.Draw(sk)
    for x in (236, 256, 276):
        d.line([(x, 222), (x, 248)], fill=(40, 60, 40, 255), width=6)
    im.alpha_composite(sk)


def s_seiva_jade(im):
    leaf = mask_poly([(256, 60), (350, 140), (390, 250), (330, 360), (256, 400), (182, 360), (122, 250), (162, 140)])
    layer = new(); fill(layer, leaf, (170, 245, 190), (40, 150, 90))
    d = ImageDraw.Draw(layer)
    d.line([(256, 90), (256, 440)], fill=(30, 100, 60, 255), width=12)
    for y in (170, 240, 310):
        d.line([(256, y + 40), (190, y)], fill=(30, 100, 60, 255), width=8)
        d.line([(256, y + 40), (322, y)], fill=(30, 100, 60, 255), width=8)
    im.alpha_composite(glow(layer, leaf, (130, 255, 170), 22, 1.0))
    drop(im, 256, 470, 22, (210, 255, 230), (90, 210, 140))
    drop(im, 110, 400, 18, (210, 255, 230), (90, 210, 140))
    drop(im, 410, 410, 18, (210, 255, 230), (90, 210, 140))


def s_sangue_serpente(im):
    pts = [(120, 440), (120, 340), (230, 300), (330, 330), (260, 230), (150, 190), (170, 110), (300, 90), (390, 150)]
    body = mask_line(pts, 54)
    layer = new(); fill(layer, body, (90, 200, 100), (24, 96, 52))
    d = ImageDraw.Draw(layer)
    d.line(pts, fill=(200, 255, 120, 255), width=10, joint='curve')
    fill(layer, mask_ellipse((350, 100, 450, 200)), (110, 220, 110), (24, 96, 52))
    fill(layer, mask_ellipse((395, 128, 417, 150)), (255, 230, 60), outline=0, shade=False)
    fill(layer, mask_line([(440, 180), (470, 230), (450, 250)], 8), (230, 40, 40), outline=0, shade=False)
    im.alpha_composite(layer)
    drop(im, 100, 120, 24, (255, 90, 90), (150, 20, 30))
    drop(im, 60, 230, 18, (255, 90, 90), (150, 20, 30))


ITEMS = {
    'colar_jade': i_colar_jade, 'colar_dragao': i_colar_dragao,
    'tunica_algodao': i_tunica, 'manto_seda': i_manto,
    'espadas_ferro': i_espadas_ferro, 'espadas_vento': i_espadas_vento,
    'leque_bambu': i_leque_bambu, 'leque_nuvens': i_leque_nuvens,
    'faixa_linho': i_faixa, 'coroa_monge': i_coroa,
    'calca_algodao': i_calca_algodao, 'calca_couro': i_calca_couro,
    'sandalia_palha': i_sandalia, 'botas_andarilho': i_botas,
    'bastao_ferro': i_bastao_ferro, 'bastao_brasa': i_bastao_brasa,
    'agulhas_bronze': i_agulhas_bronze, 'agulhas_jade': i_agulhas_jade,
    'pocao_hp_p': lambda im: potion(im, (220, 40, 40)), 'pocao_hp_g': lambda im: potion(im, (255, 30, 30), True),
    'pocao_mp_p': lambda im: potion(im, (50, 120, 230)), 'pocao_mp_g': lambda im: potion(im, (40, 90, 255), True),
}
SKILLS = {
    'corte_duplo': (s_corte_duplo, THUNDER_BG), 'passo_fantasma': (s_passo, THUNDER_BG),
    'tempestade_laminas': (s_tempestade, THUNDER_BG), 'golpe_rompe_guarda': (s_quebra, ((150, 50, 50), (40, 10, 14))),
    'fluxo_lamina': (s_fluxo, THUNDER_BG),
    'esfera_qi': (s_orbe, ICE_BG), 'lotus_congelante': (s_lotus, ICE_BG), 'chuva_qi': (s_nevasca, ICE_BG),
    'escudo_nuvem': (s_veu, ICE_BG), 'meditacao_celeste': (s_mente, ((120, 100, 190), (26, 20, 60))),
    'punho_montanha': (s_punho_montanha, FIRE_BG), 'tremor': (s_tremor, FIRE_BG), 'pele_ferro': (s_pele_ferro, FIRE_BG),
    'punho_vulcanico': (s_punho_vulcanico, FIRE_BG), 'corpo_bronze': (s_corpo_bronze, FIRE_BG),
    'agulha_venenosa': (s_agulha_venenosa, POISON_BG), 'chuva_agulhas': (s_chuva_agulhas, POISON_BG),
    'nevoa_toxica': (s_nevoa_toxica, POISON_BG), 'seiva_jade': (s_seiva_jade, POISON_BG),
    'sangue_serpente': (s_sangue_serpente, POISON_BG),
}


def main():
    icons = []
    for name, fn in ITEMS.items():
        im = new(); fn(im); icons.append((name, im))
    for name, (fn, (c1, c2)) in SKILLS.items():
        im = bg_badge(c1, c2); fn(im); icons.append(('skill_' + name, im))
    rows = (len(icons) + COLS - 1) // COLS
    sheet = Image.new('RGBA', (COLS * OUT, rows * OUT), (0, 0, 0, 0))
    index = {}
    for k, (name, im) in enumerate(icons):
        sheet.paste(im.resize((OUT, OUT), Image.LANCZOS), ((k % COLS) * OUT, (k // COLS) * OUT))
        index[name] = k
    out = os.path.join(HERE, '../../public/sprites/icones.png')
    sheet.save(out, optimize=True)
    with open(os.path.join(HERE, '../../src/data/sprites/icones.json'), 'w') as f:
        json.dump({'size': OUT, 'cols': COLS, 'rows': rows, 'index': index}, f, indent=1)
    print('icones', sheet.size, len(icons))


if __name__ == '__main__':
    main()
