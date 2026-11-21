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


# ---------- marco 9: equipamentos nv 10 e 15, materiais e pergaminho ----------
def colar_gema(im, chain, gem_in, gem_out, glow_c):
    fill(im, mask_line([(110, 100), (170, 260), (256, 300), (342, 260), (402, 100)], 14), chain, outline=6)
    m = mask_poly([(256, 290), (330, 380), (256, 470), (182, 380)])
    part = new(); fill(part, m, gem_in, gem_out)
    im.alpha_composite(glow(part, m, glow_c, 24, 1.2))


def i_colar_cristal(im):
    colar_gema(im, (190, 200, 214), (230, 248, 255), (90, 170, 230), (160, 220, 255))


def i_colar_lotus(im):
    fill(im, mask_line([(110, 100), (170, 260), (256, 300), (342, 260), (402, 100)], 14), (230, 190, 80), outline=6)
    layer = new()
    for ang in (-0.9, -0.45, 0, 0.45, 0.9):
        fill(layer, mask_poly(rot_pts([(256, 280), (290, 360), (256, 440), (222, 360)], ang, 256, 430)), (255, 200, 230), (200, 80, 150))
    im.alpha_composite(glow(layer, layer.getchannel('A'), (255, 170, 220), 22, 1.1))


def i_manto_yeti(im):
    robe(im, (230, 234, 240), (170, 186, 204), (110, 120, 140))


def i_armadura_templo(im):
    robe(im, (120, 40, 70), (220, 176, 70), (60, 24, 40))


def i_espadas_trovao_nevado(im):
    for a in (-0.55, 0.55):
        jian(im, a, blade=(220, 236, 250), guard=(150, 170, 200), glow_c=(200, 180, 255), tassel=(150, 120, 230))


def i_espadas_ceu_partido(im):
    for a in (-0.55, 0.55):
        jian(im, a, blade=(255, 246, 210), guard=(230, 180, 70), glow_c=(255, 220, 120), tassel=(220, 60, 60))


def i_leque_lua_fria(im):
    fan(im, (220, 232, 248), (70, 90, 130), accent=(150, 190, 240), cloud=(230, 240, 255))


def i_leque_fenix(im):
    fan(im, (250, 236, 210), (150, 40, 40), accent=(240, 120, 60), cloud=(120, 220, 170))


def i_bastao_granito(im):
    staff(im, (120, 124, 132), (200, 210, 224), band=(90, 96, 110))


def i_bastao_vulcao(im):
    staff(im, (50, 30, 30), (230, 120, 40), glow_c=(255, 140, 50), band=(30, 18, 16))


def i_agulhas_prata(im):
    needles(im, (210, 216, 230), (70, 60, 90), glow_c=(150, 140, 200))


def i_agulhas_escorpiao(im):
    needles(im, (250, 220, 120), (150, 40, 60), glow_c=(255, 200, 90))


def i_capuz_la(im):
    fill(im, mask_ellipse((120, 110, 392, 400)), (200, 190, 176), (130, 120, 108))
    fill(im, mask_ellipse((176, 200, 336, 370)), (60, 50, 44), outline=0, shade=False)
    fill(im, mask_poly([(120, 330), (392, 330), (420, 440), (92, 440)]), (190, 178, 160), (120, 110, 96))


def i_elmo_guardiao(im):
    fill(im, mask_ellipse((130, 120, 382, 380)), (210, 170, 80), (120, 84, 36))
    fill(im, mask_poly([(120, 280), (392, 280), (372, 420), (140, 420)]), (190, 150, 70), (110, 76, 34))
    fill(im, mask_poly([(240, 70), (272, 70), (266, 170), (246, 170)]), (200, 50, 50), outline=6)
    fill(im, mask_poly([(196, 300), (316, 300), (300, 330), (212, 330)]), (40, 30, 30), outline=0, shade=False)


def i_calca_la(im):
    pants(im, (150, 160, 176), strap=(90, 96, 110), belt=(70, 70, 80))


def i_calca_escamas(im):
    pants(im, (190, 140, 70), strap=(120, 80, 40), belt=(80, 50, 30))


def i_botas_pico(im):
    boot(im, (226, 228, 232), (90, 80, 70), trim=(170, 180, 196))


def i_botas_passo_celeste(im):
    boot(im, (90, 60, 140), (40, 30, 50), trim=(240, 200, 90))


def i_minerio(im):
    m = mask_poly([(120, 300), (190, 170), (310, 150), (400, 250), (370, 380), (220, 410)])
    fill(im, m, (150, 140, 130), (80, 72, 66))
    for x, y in ((210, 240), (300, 220), (260, 320), (330, 300)):
        fill(im, mask_ellipse((x - 22, y - 16, x + 22, y + 16)), (230, 200, 160), (170, 120, 80), outline=4)


def i_cristal(im):
    layer = new()
    for pts in ([(256, 80), (320, 220), (256, 440), (192, 220)], [(170, 200), (210, 290), (170, 420), (130, 290)], [(342, 190), (382, 280), (342, 420), (302, 280)]):
        fill(layer, mask_poly(pts), (240, 252, 255), (80, 170, 230))
    im.alpha_composite(glow(layer, layer.getchannel('A'), (150, 220, 255), 26, 1.3))


def i_essencia(im):
    m = mask_ellipse((150, 150, 362, 362))
    part = new(); fill(part, m, (250, 220, 255), (150, 60, 200))
    im.alpha_composite(glow(part, m, (210, 140, 255), 40, 1.6))
    fill(im, mask_ellipse((220, 200, 260, 240)), (255, 255, 255), outline=0, shade=False)


def i_pergaminho(im):
    fill(im, mask_poly([(130, 150), (382, 150), (382, 380), (130, 380)]), (246, 230, 180), (200, 170, 110))
    for y in (150, 380):
        fill(im, mask_ellipse((100, y - 30, 160, y + 30)), (150, 90, 50), outline=6)
        fill(im, mask_ellipse((352, y - 30, 412, y + 30)), (150, 90, 50), outline=6)
    d = ImageDraw.Draw(im)
    for y in (210, 250, 290, 330):
        d.line([(180, y), (332, y)], fill=(120, 80, 50, 255), width=8)
    fill(im, mask_ellipse((300, 300, 360, 360)), (200, 40, 40), outline=5)


# ---------- nível 30 (etapa 3): conjuntos nv 20 (Bambu Sombrio) e nv 25 (Névoa) e Jade da Névoa ----------
def colar_contas(im, cord, bead_in, bead_out):
    fill(im, mask_line([(110, 100), (170, 260), (256, 300), (342, 260), (402, 100)], 10), cord, outline=5)
    for x, y in ((150, 190), (196, 262), (256, 300), (316, 262), (362, 190)):
        fill(im, mask_ellipse((x - 26, y - 26, x + 26, y + 26)), bead_in, bead_out, outline=5)
    fill(im, mask_poly([(232, 320), (280, 320), (296, 450), (216, 450)]), (90, 140, 70), (40, 70, 30))


def i_colar_bambu(im):
    colar_contas(im, (90, 70, 50), (150, 190, 110), (60, 100, 50))


def i_veste_bambu(im):
    robe(im, (40, 70, 52), (120, 170, 100), (24, 34, 28))


def i_espadas_folha_bambu(im):
    for a in (-0.55, 0.55):
        jian(im, a, blade=(200, 236, 200), guard=(70, 110, 60), hilt=(40, 50, 36), glow_c=(140, 230, 150), tassel=(40, 90, 50))


def i_leque_bambu_negro(im):
    fan(im, (210, 228, 200), (36, 40, 34), accent=(100, 160, 90), cloud=(170, 210, 160))


def i_bastao_raiz_bambu(im):
    staff(im, (90, 130, 70), (170, 210, 120), glow_c=(150, 230, 130), band=(40, 60, 30))


def i_agulhas_espinho(im):
    needles(im, (170, 200, 160), (40, 60, 40), glow_c=(120, 220, 120))


def i_chapeu_bambu(im):
    fill(im, mask_poly([(256, 110), (440, 330), (72, 330)]), (210, 190, 120), (140, 116, 60))
    d = ImageDraw.Draw(im)
    for k in range(1, 6):
        x = 72 + k * (368 / 6)
        d.line([(256, 120), (x, 326)], fill=(120, 96, 50, 255), width=5)
    fill(im, mask_poly([(150, 330), (362, 330), (340, 360), (172, 360)]), (40, 70, 52), outline=5)


def i_calca_cacador(im):
    pants(im, (50, 64, 54), strap=(110, 150, 90), belt=(30, 36, 30))


def i_botas_sombra(im):
    boot(im, (44, 50, 48), (20, 22, 22), trim=(110, 160, 100))


def i_colar_nevoa(im):
    colar_gema(im, (220, 226, 236), (230, 255, 245), (60, 190, 150), (150, 255, 210))


def i_manto_nevoa(im):
    robe(im, (220, 232, 240), (90, 200, 170), (120, 140, 170))


def i_espadas_rasga_nevoa(im):
    for a in (-0.55, 0.55):
        jian(im, a, blade=(236, 250, 255), guard=(80, 200, 160), glow_c=(170, 255, 230), tassel=(230, 240, 255))


def i_leque_grou(im):
    fan(im, (246, 248, 252), (40, 44, 60), accent=(220, 50, 50), cloud=(170, 230, 210))


def i_bastao_pico(im):
    staff(im, (200, 210, 224), (110, 230, 190), glow_c=(170, 255, 225), band=(80, 96, 120))


def i_agulhas_jade_celeste(im):
    needles(im, (150, 240, 200), (230, 240, 255), glow_c=(160, 255, 220))


def i_coroa_jade(im):
    fill(im, mask_poly([(130, 380), (130, 220), (190, 290), (256, 150), (322, 290), (382, 220), (382, 380)]), (120, 220, 180), (30, 110, 80))
    for x, y in ((256, 250), (180, 330), (332, 330)):
        fill(im, mask_ellipse((x - 18, y - 18, x + 18, y + 18)), (240, 255, 250), (140, 220, 200), outline=4)


def i_calca_nuvens(im):
    pants(im, (210, 220, 236), strap=(90, 190, 160), belt=(100, 120, 150))


def i_botas_nebulosas(im):
    boot(im, (200, 214, 230), (90, 100, 120), trim=(100, 220, 180))


def i_jade(im):
    m = mask_poly([(256, 90), (380, 200), (350, 380), (256, 440), (162, 380), (132, 200)])
    part = new(); fill(part, m, (210, 255, 230), (40, 150, 100))
    im.alpha_composite(glow(part, m, (120, 240, 180), 30, 1.3))
    fill(im, mask_ellipse((214, 190, 298, 274)), (240, 255, 248), (150, 230, 200), outline=4)


# nível 40 (etapa 3): conjunto nv 35 do Palácio Celeste (carmesim e dourado)
def i_colar_sol_carmesim(im):
    colar_gema(im, (236, 200, 110), (255, 220, 170), (200, 40, 40), (255, 140, 90))


def i_tunica_palacio(im):
    robe(im, (176, 36, 44), (236, 196, 90), (90, 40, 40))


def i_espadas_asa_fenix(im):
    for a in (-0.55, 0.55):
        jian(im, a, blade=(255, 236, 214), guard=(230, 170, 60), glow_c=(255, 150, 80), tassel=(210, 40, 40))


def i_leque_aurora(im):
    fan(im, (250, 226, 200), (120, 30, 36), accent=(230, 180, 70), cloud=(255, 150, 120))


def i_bastao_pilar_celeste(im):
    staff(im, (190, 60, 50), (250, 210, 110), glow_c=(255, 200, 120), band=(230, 180, 70))


def i_agulhas_escarlates(im):
    needles(im, (240, 90, 80), (250, 220, 150), glow_c=(255, 120, 100))


def i_coroa_celeste(im):
    fill(im, mask_poly([(130, 380), (130, 220), (190, 290), (256, 150), (322, 290), (382, 220), (382, 380)]), (250, 214, 110), (150, 90, 30))
    for x, y in ((256, 250), (180, 330), (332, 330)):
        fill(im, mask_ellipse((x - 18, y - 18, x + 18, y + 18)), (255, 160, 150), (190, 30, 40), outline=4)


def i_calca_nuvens_rubras(im):
    pants(im, (170, 40, 48), strap=(236, 196, 90), belt=(90, 40, 40))


def i_botas_degrau_imperial(im):
    boot(im, (160, 36, 44), (70, 40, 36), trim=(240, 200, 100))


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
    'colar_cristal': i_colar_cristal, 'colar_lotus': i_colar_lotus,
    'manto_yeti': i_manto_yeti, 'armadura_templo': i_armadura_templo,
    'espadas_trovao_nevado': i_espadas_trovao_nevado, 'espadas_ceu_partido': i_espadas_ceu_partido,
    'leque_lua_fria': i_leque_lua_fria, 'leque_fenix': i_leque_fenix,
    'bastao_granito': i_bastao_granito, 'bastao_vulcao': i_bastao_vulcao,
    'agulhas_prata': i_agulhas_prata, 'agulhas_escorpiao': i_agulhas_escorpiao,
    'capuz_la': i_capuz_la, 'elmo_guardiao': i_elmo_guardiao,
    'calca_la': i_calca_la, 'calca_escamas': i_calca_escamas,
    'botas_pico': i_botas_pico, 'botas_passo_celeste': i_botas_passo_celeste,
    'minerio_ferro': i_minerio, 'cristal_gelo': i_cristal, 'essencia_qi': i_essencia,
    'pergaminho_retorno': i_pergaminho,
    'colar_bambu': i_colar_bambu, 'veste_bambu': i_veste_bambu,
    'espadas_folha_bambu': i_espadas_folha_bambu, 'leque_bambu_negro': i_leque_bambu_negro,
    'bastao_raiz_bambu': i_bastao_raiz_bambu, 'agulhas_espinho': i_agulhas_espinho,
    'chapeu_bambu': i_chapeu_bambu, 'calca_cacador': i_calca_cacador, 'botas_sombra': i_botas_sombra,
    'colar_nevoa': i_colar_nevoa, 'manto_nevoa': i_manto_nevoa,
    'espadas_rasga_nevoa': i_espadas_rasga_nevoa, 'leque_grou': i_leque_grou,
    'bastao_pico': i_bastao_pico, 'agulhas_jade_celeste': i_agulhas_jade_celeste,
    'coroa_jade': i_coroa_jade, 'calca_nuvens': i_calca_nuvens, 'botas_nebulosas': i_botas_nebulosas,
    'jade_nevoa': i_jade,
    'colar_sol_carmesim': i_colar_sol_carmesim, 'tunica_palacio': i_tunica_palacio,
    'espadas_asa_fenix': i_espadas_asa_fenix, 'leque_aurora': i_leque_aurora,
    'bastao_pilar_celeste': i_bastao_pilar_celeste, 'agulhas_escarlates': i_agulhas_escarlates,
    'coroa_celeste': i_coroa_celeste, 'calca_nuvens_rubras': i_calca_nuvens_rubras,
    'botas_degrau_imperial': i_botas_degrau_imperial,
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


# ---------- Épicos (raridade epico): 1 ícone fixo por nome épico, formas próprias em roxo e ouro com aura ----------
EP_VIOLET = (190, 120, 255)
EP_PURPLE = (140, 64, 214)
EP_DEEP = (64, 22, 112)
EP_GOLD = (246, 204, 92)
EP_GOLD_D = (176, 120, 30)
EP_AURA = (180, 92, 255)


def ep_aura(im, strength=1.1):
    """Aura roxa em volta de tudo o que já foi desenhado no ícone."""
    a = im.getchannel('A')
    out = glow(im, a, EP_AURA, 26, strength)
    im.paste(out, (0, 0))


def ep_petal(cx, cy, ang, length, width):
    pts = [(cx, cy), (cx + width, cy - length * 0.5), (cx, cy - length), (cx - width, cy - length * 0.5)]
    return rot_pts(pts, ang, cx, cy)


def i_epico_colar(im):
    """Colar do Lótus Violeta: corrente dourada e pingente de lótus aberto (8 pétalas) com gema de ouro."""
    fill(im, mask_line([(118, 70), (172, 210), (256, 246), (340, 210), (394, 70)], 12), EP_GOLD, EP_GOLD_D, outline=6)
    cx, cy = 256, 352
    for k in range(8):  # pétalas de trás
        fill(im, mask_poly(ep_petal(cx, cy, math.radians(k * 45 + 22.5), 128, 40)), EP_PURPLE, EP_DEEP, outline=7)
    for k in range(8):  # pétalas da frente
        fill(im, mask_poly(ep_petal(cx, cy, math.radians(k * 45), 104, 34)), lighten(EP_VIOLET, 0.25), EP_PURPLE, outline=7)
    fill(im, mask_ellipse((cx - 34, cy - 34, cx + 34, cy + 34)), lighten(EP_GOLD, 0.4), EP_GOLD_D, outline=6)
    ep_aura(im)


def i_epico_tronco(im):
    """Manto do Imperador Celeste: manto longo e largo, gola alta, ombreiras e faixa dourada com nuvem."""
    cx = S / 2
    body = [(cx - 62, 92), (cx - 150, 126), (cx - 222, 214), (cx - 186, 258), (cx - 138, 222), (cx - 168, 480),
            (cx + 168, 480), (cx + 138, 222), (cx + 186, 258), (cx + 222, 214), (cx + 150, 126), (cx + 62, 92)]
    fill(im, mask_poly(body), EP_PURPLE, EP_DEEP)
    fill(im, mask_poly([(cx - 22, 120), (cx + 22, 120), (cx + 30, 480), (cx - 30, 480)]), EP_GOLD, EP_GOLD_D, outline=5)
    fill(im, mask_poly([(cx - 168, 448), (cx + 168, 448), (cx + 170, 482), (cx - 170, 482)]), EP_GOLD, EP_GOLD_D, outline=5)
    for sx in (-1, 1):  # ombreiras
        fill(im, mask_poly([(cx + sx * 64, 100), (cx + sx * 154, 122), (cx + sx * 206, 196), (cx + sx * 150, 196), (cx + sx * 96, 150)]),
             EP_GOLD, EP_GOLD_D, outline=6)
    fill(im, mask_poly([(cx - 66, 56), (cx + 66, 56), (cx + 74, 118), (cx - 74, 118)]), lighten(EP_GOLD, 0.2), EP_GOLD_D, outline=6)
    for x, y, r in ((cx - 92, 286, 24), (cx - 66, 272, 30), (cx - 40, 288, 22), (cx + 66, 340, 26), (cx + 90, 352, 20)):
        fill(im, mask_ellipse((x - r, y - r * 0.8, x + r, y + r * 0.8)), lighten(EP_GOLD, 0.3), EP_GOLD, outline=4, shade=False)
    ep_aura(im)


def i_epico_cabeca(im):
    """Coroa das Mil Névoas: três picos ondulados de névoa violeta, aro de ouro, gema e fitas."""
    for sx in (-1, 1):
        fill(im, mask_line([(256 + sx * 118, 362), (256 + sx * 150, 420), (256 + sx * 130, 486)], 22), EP_VIOLET, EP_PURPLE, outline=6)

    def peak(cx, top, half):
        return [(cx - half, 340), (cx - half * 0.55, 286), (cx - half * 0.95, 232), (cx - half * 0.35, 180), (cx, top),
                (cx + half * 0.5, 196), (cx + half * 0.15, 248), (cx + half * 0.85, 290), (cx + half, 340)]
    for cx, top, half in ((166, 150, 64), (346, 150, 64), (256, 62, 82)):
        fill(im, mask_poly(peak(cx, top, half)), lighten(EP_VIOLET, 0.35), EP_PURPLE, outline=8)
    fill(im, mask_poly([(122, 330), (390, 330), (378, 398), (134, 398)]), EP_GOLD, EP_GOLD_D, outline=8)
    fill(im, mask_poly([(256, 334), (286, 364), (256, 394), (226, 364)]), lighten(EP_VIOLET, 0.5), EP_DEEP, outline=5)
    for x in (172, 340):
        fill(im, mask_ellipse((x - 13, 351, x + 13, 377)), lighten(EP_VIOLET, 0.4), EP_PURPLE, outline=4)
    ep_aura(im)


def i_epico_calca(im):
    """Calça do Dragão Adormecido: calça larga (abre embaixo), escamas de ouro e medalhão de dragão no cinto."""
    cx = S / 2
    legs = [(cx - 112, 104), (cx + 112, 104), (cx + 182, 450), (cx + 32, 460), (cx, 232), (cx - 32, 460), (cx - 182, 450)]
    m = mask_poly(legs)
    fill(im, m, EP_PURPLE, EP_DEEP)
    sc = new(); d = ImageDraw.Draw(sc)
    for row, y in enumerate(range(250, 440, 34)):
        for x in range(60, 460, 40):
            ox = 20 if row % 2 else 0
            d.arc((x + ox - 18, y - 14, x + ox + 18, y + 18), 200, 340, fill=EP_GOLD + (255,), width=6)
    sc.putalpha(ImageChops.multiply(sc.getchannel('A'), m))
    im.alpha_composite(sc)
    fill(im, mask_poly([(cx - 116, 96), (cx + 116, 96), (cx + 118, 146), (cx - 118, 146)]), EP_GOLD, EP_GOLD_D, outline=6)
    fill(im, mask_ellipse((cx - 48, 72, cx + 48, 168)), lighten(EP_GOLD, 0.3), EP_GOLD_D, outline=6)
    fill(im, mask_ellipse((cx - 30, 90, cx + 30, 150)), EP_PURPLE, EP_DEEP, outline=4)
    fill(im, mask_ellipse((cx - 14, 106, cx + 14, 134)), lighten(EP_GOLD, 0.5), EP_GOLD, outline=3)  # pérola do dragão
    ep_aura(im)


def i_epico_bota(im):
    """Botas do Vento Sem Rastro: uma bota alta violeta com asa dourada e redemoinho de vento."""
    for k, (a, b) in enumerate([((60, 440), (200, 446)), ((40, 400), (150, 404)), ((80, 470), (260, 476))]):
        fill(im, mask_line([a, b], 10 - k * 2), lighten(EP_VIOLET, 0.5), outline=0, shade=False)
    boot_pts = [(196, 64), (326, 64), (330, 318), (438, 356), (448, 432), (176, 432), (186, 250)]
    fill(im, mask_poly(boot_pts), lighten(EP_VIOLET, 0.1), EP_DEEP)
    fill(im, mask_poly([(172, 420), (452, 420), (452, 452), (172, 452)]), EP_GOLD_D, shade_of(EP_GOLD_D, 0.6), outline=6)
    fill(im, mask_poly([(190, 58), (332, 58), (334, 108), (188, 108)]), EP_GOLD, EP_GOLD_D, outline=6)
    for k, (dy, ln) in enumerate(((0, 170), (44, 140), (88, 104))):  # asa: 3 penas
        y = 170 + dy
        fill(im, mask_poly([(250, y), (250 - ln, y - 70 + k * 8), (250 - ln + 30, y - 30 + k * 6), (250, y + 30)]),
             lighten(EP_GOLD, 0.3), EP_GOLD_D, outline=6)
    ep_aura(im)


def i_epico_arma_lamina(im):
    """Espadas do Trovão Celestial: dois sabres curvos largos lado a lado (não cruzados), com raios violeta."""
    def saber(x0, y0, k):
        layer = new()
        spine, edge = [], []
        for n in range(21):
            t = n / 20
            y = y0 - 300 * k * t
            x = x0 + 120 * k * t * t
            w = 50 * k * (1 - t) + 8
            spine.append((x, y)); edge.append((x + w, y + 14 * t))
        m = mask_poly(spine + edge[::-1])
        fill(layer, m, (226, 210, 255), (130, 90, 210), angle=0)
        bolt = [(x0 + 22, y0 - 40), (x0 + 44, y0 - 90), (x0 + 26, y0 - 110), (x0 + 56, y0 - 170), (x0 + 42, y0 - 186), (x0 + 82, y0 - 240)]
        bolt = [(x, y0 - (y0 - y) * k) for x, y in bolt]
        bl = ImageChops.multiply(mask_line(bolt, 9), m)
        layer.paste(Image.new('RGBA', (S, S), (255, 240, 255, 255)), (0, 0), bl)
        layer = glow(layer, bl, EP_VIOLET, 10, 1.6)
        hx = x0 + 26
        fill(layer, mask_ellipse((hx - 44, y0 - 10, hx + 44, y0 + 22)), EP_GOLD, EP_GOLD_D, outline=6)
        fill(layer, mask_poly([(hx - 14, y0 + 18), (hx + 14, y0 + 18), (hx + 12, y0 + 100), (hx - 12, y0 + 100)]), EP_DEEP, outline=6)
        for y in (y0 + 40, y0 + 70):
            fill(layer, mask_poly([(hx - 17, y), (hx + 17, y), (hx + 17, y + 10), (hx - 17, y + 10)]), EP_GOLD, outline=3, shade=False)
        im.alpha_composite(layer)
    saber(206, 392, 1.0)
    saber(96, 404, 0.86)
    ep_aura(im)


def i_epico_arma_pavilhao(im):
    """Leque da Geada Eterna: leque redondo de seda (tuanshan) com cristal de gelo violeta e cabo de jade."""
    cx, cy, r = 256, 206, 160
    fill(im, mask_line([(cx, cy + 120), (cx, 488)], 26), (110, 210, 180), (40, 120, 100), outline=7)
    fill(im, mask_poly([(cx - 16, 470), (cx + 16, 470), (cx + 30, 506), (cx - 30, 506)]), EP_PURPLE, EP_DEEP, outline=5)
    silk = mask_ellipse((cx - r, cy - r, cx + r, cy + r))
    fill(im, silk, (240, 230, 255), (176, 140, 236), angle=60)
    ring = ImageChops.subtract(silk, mask_ellipse((cx - r + 16, cy - r + 16, cx + r - 16, cy + r - 16)))
    im.paste(gradient(EP_GOLD, EP_GOLD_D), (0, 0), ring)
    flake = new()
    for k in range(6):
        a = math.radians(k * 60)
        ex, ey = cx + math.cos(a) * 112, cy + math.sin(a) * 112
        fill(flake, mask_line([(cx, cy), (ex, ey)], 14), EP_PURPLE, outline=4, shade=False)
        for f in (0.55, 0.8):
            bx, by = cx + math.cos(a) * 112 * f, cy + math.sin(a) * 112 * f
            for da in (-0.6, 0.6):
                fill(flake, mask_line([(bx, by), (bx + math.cos(a + da) * 30, by + math.sin(a + da) * 30)], 9), EP_PURPLE, outline=3, shade=False)
    fill(flake, mask_ellipse((cx - 24, cy - 24, cx + 24, cy + 24)), lighten(EP_VIOLET, 0.5), EP_PURPLE, outline=4)
    im.alpha_composite(glow(flake, flake.getchannel('A'), EP_VIOLET, 12, 1.2))
    ep_aura(im)


def i_epico_arma_tita(im):
    """Bastão do Monte Inabalável: bastão com cabeça em forma de montanha vazada e anéis de ouro pendurados."""
    fill(im, mask_line([(256, 230), (256, 492)], 30), EP_PURPLE, EP_DEEP, outline=7)
    for y in (290, 400, 470):
        fill(im, mask_poly([(236, y), (276, y), (276, y + 16), (236, y + 16)]), EP_GOLD, outline=4, shade=False)
    outer = [(110, 250), (176, 120), (214, 170), (256, 48), (298, 170), (336, 120), (402, 250)]
    inner = [(158, 226), (184, 176), (214, 214), (256, 116), (298, 214), (328, 176), (354, 226)]
    m = ImageChops.subtract(mask_poly(outer), mask_poly(inner))
    fill(im, m, lighten(EP_GOLD, 0.2), EP_GOLD_D, outline=8)
    for x, y in ((128, 290), (384, 290), (98, 340), (414, 340)):
        rm = ImageChops.subtract(mask_ellipse((x - 28, y - 28, x + 28, y + 28)), mask_ellipse((x - 16, y - 16, x + 16, y + 16)))
        fill(im, rm, EP_GOLD, EP_GOLD_D, outline=5)
    fill(im, mask_poly([(256, 150), (282, 190), (256, 226), (230, 190)]), lighten(EP_VIOLET, 0.4), EP_PURPLE, outline=5)
    ep_aura(im)


def i_epico_arma_vibora(im):
    """Agulhas da Víbora Imperial: 5 agulhas violeta em leque saindo de uma serpente enrolada em anel, olhos de ouro."""
    cx, cy = 256, 372
    for k in range(5):
        a = math.radians(-145 + k * 27.5)
        tx, ty = cx + math.cos(a) * 250, cy + math.sin(a) * 250
        bx, by = cx + math.cos(a) * 70, cy + math.sin(a) * 70
        nx, ny = -math.sin(a) * 10, math.cos(a) * 10
        fill(im, mask_poly([(bx + nx, by + ny), (tx, ty), (bx - nx, by - ny)]), lighten(EP_VIOLET, 0.4), EP_PURPLE, outline=6)
    ring = ImageChops.subtract(mask_ellipse((cx - 96, cy - 96, cx + 96, cy + 96)), mask_ellipse((cx - 52, cy - 52, cx + 52, cy + 52)))
    fill(im, ring, (120, 200, 110), (40, 110, 60))
    d = ImageDraw.Draw(im)
    for k in range(12):
        a = math.radians(k * 30 + 15)
        x, y = cx + math.cos(a) * 74, cy + math.sin(a) * 74
        d.ellipse((x - 8, y - 6, x + 8, y + 6), fill=EP_PURPLE + (255,))
    hx, hy = cx + 92, cy - 70
    fill(im, mask_ellipse((hx - 46, hy - 34, hx + 46, hy + 34)), (140, 220, 120), (50, 120, 60), outline=7)
    for ex in (hx - 16, hx + 16):
        fill(im, mask_ellipse((ex - 9, hy - 14, ex + 9, hy + 2)), EP_GOLD, EP_GOLD_D, outline=3, shade=False)
    fill(im, mask_line([(hx + 40, hy + 10), (hx + 70, hy + 22), (hx + 84, hy + 10)], 7), (220, 60, 80), outline=0, shade=False)
    ep_aura(im)


EPICS = {
    'epico_colar': i_epico_colar, 'epico_tronco': i_epico_tronco, 'epico_cabeca': i_epico_cabeca,
    'epico_calca': i_epico_calca, 'epico_bota': i_epico_bota,
    'epico_arma_lamina': i_epico_arma_lamina, 'epico_arma_pavilhao': i_epico_arma_pavilhao,
    'epico_arma_tita': i_epico_arma_tita, 'epico_arma_vibora': i_epico_arma_vibora,
}


def main():
    icons = []
    for name, fn in ITEMS.items():
        im = new(); fn(im); icons.append((name, im))
    for name, (fn, (c1, c2)) in SKILLS.items():
        im = bg_badge(c1, c2); fn(im); icons.append(('skill_' + name, im))
    for name, fn in EPICS.items():  # depois das skills: os índices antigos não mudam
        im = new(); fn(im); icons.append((name, im))
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
