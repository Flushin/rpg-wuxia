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
out = sys.argv[1]
tiles = {
  'grass1': tile((96, 150, 72), 0.16, 1),
  'grass2': tile((92, 146, 70), 0.18, 2, [((80, 128, 60), 0.35)]),
  'grass3': tile((98, 152, 74), 0.16, 3, [((120, 160, 80), 0.25)]),
  'path':   tile((160, 132, 96), 0.14, 4, [((140, 114, 82), 0.4)]),
  'plaza1': flagstone((178, 172, 160), 5),
  'plaza2': flagstone((172, 168, 158), 6),
}
sheet = Image.new('RGBA', (W * len(tiles), H))
for i, im in enumerate(tiles.values()): sheet.paste(im, (i * W, 0))
sheet.save(out)
json.dump({'tileWidth': W, 'tileHeight': H, 'names': list(tiles)}, open(sys.argv[2], 'w'))
