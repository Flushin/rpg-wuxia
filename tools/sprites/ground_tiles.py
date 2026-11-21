"""Gera os pisos isométricos (64x32, em 2x = 128x64) com textura suave, sem frestas."""
import json, random, sys
import numpy as np
from PIL import Image, ImageFilter
S = 2; W, H = 64 * S, 32 * S
def diamond_mask():
    y, x = np.mgrid[0:H, 0:W]
    return (np.abs(x + 0.5 - W / 2) / (W / 2) + np.abs(y + 0.5 - H / 2) / (H / 2)) <= 1.0 + 1.0 / W
def tile(base, var, seed, blobs=None):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (H // 4 + 2, W // 4 + 2))
    n = np.array(Image.fromarray(((n - n.min()) / (np.ptp(n) + 1e-9) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) / 255 - 0.5
    fine = rng.normal(0, 0.18, (H, W))
    col = np.array(base, np.float32)[None, None, :] * (1 + var * (n[..., None] * 1.0 + fine[..., None] * 0.35))
    if blobs:
        for c, amt in blobs:
            m = rng.normal(0, 1, (H // 8 + 2, W // 8 + 2))
            m = np.array(Image.fromarray(((m - m.min()) / (np.ptp(m) + 1e-9) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
            a = np.clip((m - (1 - amt)) * 6, 0, 1)[..., None]
            col = col * (1 - a) + np.array(c, np.float32)[None, None, :] * (1 + 0.15 * fine[..., None]) * a
    img = np.zeros((H, W, 4), np.uint8)
    img[..., :3] = np.clip(col, 0, 255)
    img[..., 3] = diamond_mask() * 255
    return Image.fromarray(img)
def flagstone(base, seed, slabs=2, grout=(112, 108, 100)):
    """Lajotas de pedra (praça): grade de slabs x slabs por tile, alinhada entre tiles (sem emenda)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W]
    X = (x + 0.5) / W * 2 - 1; Y = (y + 0.5) / H * 2 - 1
    i = (X + Y + 1) / 2 * slabs; j = (Y - X + 1) / 2 * slabs
    fi, fj = np.floor(np.clip(i, 0, slabs - 1e-6)), np.floor(np.clip(j, 0, slabs - 1e-6))
    jit = rng.normal(0, 0.06, (slabs, slabs))[fi.astype(int), fj.astype(int)]
    fine = rng.normal(0, 0.03, (H, W))
    col = np.array(base, np.float32)[None, None, :] * (1 + jit[..., None] + fine[..., None])
    g = (np.minimum(i % 1, 1 - i % 1) < 0.035) | (np.minimum(j % 1, 1 - j % 1) < 0.035)
    col[g] = grout
    img = np.zeros((H, W, 4), np.uint8)
    img[..., :3] = np.clip(col, 0, 255)
    img[..., 3] = diamond_mask() * 255
    return Image.fromarray(img)
def ruin(base, seed, moss=0.0):
    """Lajotas gastas das ruínas: grade 2x2, juntas largas com terra, rachaduras e musgo."""
    rng = np.random.default_rng(seed)
    im = np.array(flagstone(base, seed, slabs=2, grout=(104, 108, 112)), np.float32)
    col = im[..., :3]
    # terra/areia nas juntas e manchas
    dirt = np.array(tile((118, 120, 112), 0.2, seed + 100), np.float32)[..., :3]
    m = rng.normal(0, 1, (H // 8 + 2, W // 8 + 2))
    m = np.array(Image.fromarray(((m - m.min()) / (np.ptp(m) + 1e-9) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    a = np.clip((m - 0.62) * 5, 0, 1)[..., None]
    col = col * (1 - a) + dirt * a
    if moss:
        mm = rng.normal(0, 1, (H // 8 + 2, W // 8 + 2))
        mm = np.array(Image.fromarray(((mm - mm.min()) / (np.ptp(mm) + 1e-9) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
        b = np.clip((mm - (1 - moss)) * 5, 0, 1)[..., None]
        col = col * (1 - b) + np.array((92, 112, 62), np.float32) * (0.9 + 0.2 * rng.random((H, W, 1))) * b
    # rachaduras: passeios aleatórios escuros
    for _ in range(2):
        x, y = rng.uniform(W * 0.3, W * 0.7), rng.uniform(H * 0.3, H * 0.7)
        ang = rng.uniform(0, 6.28)
        for _ in range(40):
            ang += rng.normal(0, 0.5); x += np.cos(ang) * 1.5; y += np.sin(ang) * 0.8
            xi, yi = int(x), int(y)
            if 0 <= xi < W and 0 <= yi < H: col[yi, xi] *= 0.6
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(col, 0, 255); out[..., 3] = diamond_mask() * 255
    return Image.fromarray(out)
def water(frame, seed=40):
    """Água com reflexos que se movem (3 quadros em ciclo). Reflexos longe da borda: sem emenda entre tiles."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.array((52, 98, 150), np.float32)
    n = np.array(tile((52, 98, 150), 0.08, seed), np.float32)[..., :3]
    ph = frame * 2 * np.pi / 3
    wave = np.sin(x * 0.11 + y * 0.32 + ph) * np.sin(x * 0.05 - y * 0.12 - ph * 0.5)
    col = n * (1 + 0.07 * wave[..., None])
    inner = (np.abs(x + 0.5 - W / 2) / (W / 2) + np.abs(y + 0.5 - H / 2) / (H / 2)) < 0.72
    for k in range(4):
        cx = W * (0.28 + 0.44 * rng.random()) + np.cos(ph + k) * 4
        cy = H * (0.3 + 0.4 * rng.random()) + np.sin(ph + k) * 1.5
        L = 7 + 5 * rng.random()
        hl = (np.abs(y - cy) < 0.9) & (np.abs(x - cx) < L) & inner
        col[hl] = col[hl] * 0.4 + np.array((190, 220, 245)) * 0.6
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(col, 0, 255); out[..., 3] = diamond_mask() * 255
    return Image.fromarray(out)
def ice(seed):
    """Lago congelado: azul-claro com rachaduras finas."""
    rng = np.random.default_rng(seed)
    col = np.array(tile((150, 196, 226), 0.05, seed), np.float32)[..., :3]
    for _ in range(5):
        x, y = rng.uniform(W * 0.25, W * 0.75), rng.uniform(H * 0.3, H * 0.7)
        ang = rng.uniform(0, 6.28)
        for _ in range(30):
            ang += rng.normal(0, 0.4); x += np.cos(ang) * 1.4; y += np.sin(ang) * 0.7
            xi, yi = int(x), int(y)
            if 0 <= xi < W and 0 <= yi < H: col[yi, xi] = col[yi, xi] * 0.5 + np.array((235, 245, 252)) * 0.5
    out = np.zeros((H, W, 4), np.uint8)
    out[..., :3] = np.clip(col, 0, 255); out[..., 3] = diamond_mask() * 255
    return Image.fromarray(out)
out = sys.argv[1]
tiles = {
  'grass1': tile((96, 150, 72), 0.16, 1),
  'grass2': tile((92, 146, 70), 0.18, 2, [((80, 128, 60), 0.35)]),
  'grass3': tile((98, 152, 74), 0.16, 3, [((120, 160, 80), 0.25)]),
  'path':   tile((160, 132, 96), 0.14, 4, [((140, 114, 82), 0.4)]),
  'plaza1': flagstone((178, 172, 160), 5),
  'plaza2': flagstone((172, 168, 158), 6),
  'ruin1':  ruin((146, 148, 146), 7),
  'ruin2':  ruin((140, 144, 142), 8, moss=0.3),
  'ruin3':  ruin((150, 150, 148), 9, moss=0.15),
  'water1': water(0), 'water2': water(1), 'water3': water(2),
  # marco 9 (Montanha Nevada): neve e lago congelado, sempre no fim (não muda os índices de cima)
  'snow1':  tile((226, 234, 242), 0.05, 41),
  'snow2':  tile((222, 230, 240), 0.06, 42, [((200, 214, 230), 0.3)]),
  'snow3':  tile((230, 236, 244), 0.05, 43, [((240, 246, 252), 0.3)]),
  'ice':    ice(44),
  # nível 40: Vale das Cinzas Rubras (cinza vulcânica e lava) e Ruínas do Palácio Celeste (mármore e nuvens), no fim
  'ash1':   tile((74, 64, 62), 0.14, 51, [((58, 50, 50), 0.35)]),
  'ash2':   tile((70, 60, 58), 0.16, 52, [((96, 70, 58), 0.25)]),
  'ash3':   tile((78, 66, 62), 0.14, 53, [((150, 64, 40), 0.12)]),
  'lava':   tile((210, 70, 30), 0.18, 54, [((255, 170, 60), 0.35), ((90, 30, 24), 0.3)]),
  'marble1': flagstone((222, 218, 208), 55, grout=(170, 160, 140)),
  'marble2': flagstone((214, 212, 204), 56, grout=(168, 156, 136)),
  'cloud':  tile((150, 172, 212), 0.12, 57, [((246, 248, 255), 0.45), ((196, 212, 240), 0.35)]),
}
sheet = Image.new('RGBA', (W * len(tiles), H))
for i, im in enumerate(tiles.values()): sheet.paste(im, (i * W, 0))
sheet.save(out)
json.dump({'tileWidth': W, 'tileHeight': H, 'names': list(tiles)}, open(sys.argv[2], 'w'))
