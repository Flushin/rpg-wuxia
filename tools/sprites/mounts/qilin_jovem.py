"""Qilin Jovem (montaria de Fundador): Veado com galhada do Quaternius (Ultimate Animated Animals, CC0) com escamas
branco-douradas, chifres de jade brilhando com anéis de ouro, crina e cauda de chamas de jade, gema na testa, cascos
dourados e sela com manta de jade."""
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import _lib  # noqa: E402
from _lib import V, R, mat, gold, jade, scales, recolor, cone, torus, gem, saddle, rest_pose, pin, place  # noqa: E402

BACK_TOP = 3.42
STAG_BACK = 3.1


def setup(cfg):
    _lib.TONE = cfg.get('tone', 1.0)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    rest_pose(arm)
    body, horns = bpy.data.objects['Stag'], bpy.data.objects['Stag_Horns']
    recolor(body, {
        'Material': scales((0.92, 0.82, 0.6), (0.85, 0.55, 0.15), metal=0.5, scale=8),
        'Material.003': mat('peito', (0.9, 0.88, 0.84), rough=0.5),
        'Material.010': mat('rosto', (0.97, 0.88, 0.66), rough=0.45),
        'Material.001': mat('casco', (0.95, 0.7, 0.2), rough=0.3, metal=0.8),
    })
    horns.data.materials.clear()
    horns.data.materials.append(jade(1.2))
    G = gold()
    mane = mat('crina', (0.15, 0.9, 0.7), em=1.2)
    # crina de chamas ao longo do pescoço (olha para -Y; pescoço y -1.3..-2.1, z 2.6..3.9)
    for k in range(7):
        t = k / 6
        p = V((0, -1.25 - 0.9 * t, 2.95 + 1.0 * t))
        bone = 'Neck1' if t < 0.3 else ('Neck2' if t < 0.6 else 'Neck3')
        pin(arm, bone, cone(p + V((0, 0.25, 0.15)), 0.2 - 0.06 * t, 0.75, mane, rot=(R(-55), 0, 0), v=6))
    pin(arm, 'Tail3', cone(V((0, 1.85, 2.75)), 0.22, 0.9, mane, rot=(R(-60), 0, 0), v=6))
    cloth = mat('pano', (0.06, 0.55, 0.45), rough=0.6)
    J = jade(1.0)
    pin(arm, 'Torso2', saddle(V((0, 0.05, 3.1)), 1.6, 0.66, (0, -1, 0), cloth, G, J, tassel=J))
    head = [gem(V((0, -2.55, 4.15)), (0.14, 0.14, 0.14), jade(1.8))]
    for s in (-1, 1):
        head.append(torus(V((s * 0.3, -2.25, 4.35)), 0.11, 0.045, G))
    pin(arm, 'Head', head)
    place(arm, scale=BACK_TOP / STAG_BACK)
