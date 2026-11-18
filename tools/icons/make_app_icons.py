#!/usr/bin/env python3
"""Gera os ícones do app (PWA) em public/icons/ e os insumos do @capacitor/assets em assets/:
duas lâminas cruzadas sobre uma lua, dourado/carmesim.
Uso: python3 tools/icons/make_app_icons.py   (precisa de Pillow)"""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'icons'
ASSETS = ROOT / 'assets'  # formato do @capacitor/assets
BG, GOLD, CRIMSON, STEEL = (16, 20, 28), (212, 160, 23), (170, 40, 40), (222, 226, 236)
S = 1024  # desenha grande e reduz (antialias)


def blade(d, cx, cy, ang, length, w):
    """Espada centrada em (cx,cy) apontando para `ang` (graus): lâmina, guarda e cabo."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    def pt(t, o): return (cx + ux * t + px * o, cy + uy * t + py * o)
    # lâmina (ponta em +length)
    d.polygon([pt(-length * .05, -w), pt(length * .85, -w * .75), pt(length, 0), pt(length * .85, w * .75), pt(-length * .05, w)], fill=STEEL)
    d.line([pt(0, 0), pt(length * .9, 0)], fill=(150, 156, 172), width=int(w * .25))
    # guarda dourada
    d.polygon([pt(-length * .08, -w * 3.4), pt(length * .02, -w * 3.4), pt(length * .02, w * 3.4), pt(-length * .08, w * 3.4)], fill=GOLD)
    # cabo carmesim e pomo
    d.line([pt(-length * .08, 0), pt(-length * .38, 0)], fill=CRIMSON, width=int(w * 1.5))
    px_, py_ = pt(-length * .42, 0)
    d.ellipse([px_ - w * 1.1, py_ - w * 1.1, px_ + w * 1.1, py_ + w * 1.1], fill=GOLD)


def art(scale):
    """Arte centrada; `scale` encolhe o motivo (versão maskable precisa de margem segura)."""
    im = Image.new('RGBA', (S, S), BG + (255,))
    # brilho de fundo
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    c = S / 2
    r = S * .34 * scale
    gd.ellipse([c - r * 1.5, c - r * 1.5 - S * .03, c + r * 1.5, c + r * 1.5 - S * .03], fill=(212, 160, 23, 60))
    im = Image.alpha_composite(im, glow.filter(ImageFilter.GaussianBlur(S * .05)))
    d = ImageDraw.Draw(im)
    # lua cheia: disco dourado com aro
    cy = c - S * .03
    d.ellipse([c - r, cy - r, c + r, cy + r], fill=(232, 205, 130))
    d.ellipse([c - r * .86, cy - r * .86, c + r * .86, cy + r * .86], outline=(240, 200, 90), width=int(S * .008))
    # espadas cruzadas (centro de cada uma no cruzamento, apontando para cima-esq/cima-dir)
    L, w = S * .42 * scale, S * .024 * scale
    cx, cyy = c, cy + S * .10 * scale
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for ang in (-60, -120):
        blade(sd, cx + S * .008, cyy + S * .012, ang, L, w)
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * .006))
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sh.putalpha(shadow.split()[3].point(lambda v: v // 2))
    im = Image.alpha_composite(im, sh)
    d = ImageDraw.Draw(im)
    for ang in (-60, -120):
        blade(d, cx, cyy, ang, L, w)
    # fita carmesim no cruzamento
    d.ellipse([cx - w * 2, cyy - w * 2, cx + w * 2, cyy + w * 2], fill=CRIMSON)
    return im


def save(im, name, size):
    im.convert('RGB').resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)


def make_capacitor_assets():
    """assets/: icon-only (sem alfa), ícone adaptativo (frente na zona segura ~66%), splash claro/escuro."""
    ASSETS.mkdir(parents=True, exist_ok=True)
    full = art(1.0).convert('RGB')
    full.resize((1024, 1024), Image.LANCZOS).save(ASSETS / 'icon-only.png', optimize=True)
    # frente: a arte reduzida a 66%, centrada, com máscara circular suave (sem borda quadrada)
    small = full.convert('RGBA').resize((int(S * .66), int(S * .66)), Image.LANCZOS)
    front = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mask = Image.new('L', small.size, 0)
    ImageDraw.Draw(mask).ellipse([0, 0, small.size[0] - 1, small.size[1] - 1], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(S * .01))
    off = (S - small.size[0]) // 2
    front.paste(small, (off, off), mask)
    front.save(ASSETS / 'icon-foreground.png', optimize=True)
    Image.new('RGB', (S, S), BG).save(ASSETS / 'icon-background.png', optimize=True)
    # splash: logo pequena centralizada sobre #10141c (mesmo fundo no claro e no escuro)
    for name in ('splash.png', 'splash-dark.png'):
        sp = Image.new('RGB', (2732, 2732), BG)
        logo = full.resize((640, 640), Image.LANCZOS)
        lmask = Image.new('L', (640, 640), 0)
        ImageDraw.Draw(lmask).rounded_rectangle([0, 0, 639, 639], radius=140, fill=255)
        sp.paste(logo, ((2732 - 640) // 2, (2732 - 640) // 2), lmask)
        sp.save(ASSETS / name, optimize=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    normal = art(1.0)
    save(normal, 'icon-192.png', 192)
    save(normal, 'icon-512.png', 512)
    save(normal, 'apple-touch-icon.png', 180)
    save(art(.72), 'icon-512-maskable.png', 512)  # motivo dentro da zona segura (~80%)
    make_capacitor_assets()
    print('ícones gerados em', OUT, 'e', ASSETS)
