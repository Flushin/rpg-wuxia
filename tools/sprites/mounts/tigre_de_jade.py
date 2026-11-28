"""Tigre de Jade (montaria de Fundador): Gato do Quaternius (Animal Pack Vol.2, CC0) aumentado, pelagem branca com
listras de jade que brilham, sela dourada, colar de contas, elmo com gema, peitoral, braceletes e gema na cauda."""
import math
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import _lib  # noqa: E402
from _lib import V, R, mat, gold, jade, striped, recolor, sphere, torus, gem, saddle, rest_pose, pin, place  # noqa: E402

BACK_TOP = 3.42  # altura do lombo do Cavalo (a sela do cavaleiro fica no mesmo lugar)
CAT_BACK = 2.72


def setup(cfg):
    _lib.TONE = cfg.get('tone', 1.0)
    o = bpy.data.objects['Cat']
    arm = bpy.data.objects['CatArmature']
    rest_pose(arm)
    # as ações do FBX animam o próprio objeto (rotação/posição/escala) e desfariam o place(): ficam só os ossos
    for act in bpy.data.actions:
        fcs = act.fcurves if hasattr(act, 'fcurves') else [c for ly in act.layers for st in ly.strips for cb in st.channelbags for c in cb.fcurves]
        for c in [c for c in fcs if not c.data_path.startswith('pose')]:
            (act.fcurves if hasattr(act, 'fcurves') else next(cb for ly in act.layers for st in ly.strips for cb in st.channelbags if c in cb.fcurves[:]).fcurves).remove(c)
    recolor(o, {
        'Grey': striped((0.84, 0.84, 0.82), (0.0, 0.36, 0.22), 0.5, scale=0.95, thin=0.56, emc=(0.1, 1, 0.5)),
        'White': mat('barriga', (0.88, 0.88, 0.86), rough=0.6),
        'Pink': mat('rosa', (0.95, 0.6, 0.65)),
    })
    G, J = gold(0.6), jade(1.4)
    cloth = mat('pano', (0.06, 0.42, 0.3), rough=0.7)
    red = mat('borla', (0.85, 0.08, 0.06), em=0.6)
    # o gato olha para +X; lombo em x≈0.25, z≈2.72; cabeça x 2.0..3.25 (topo ≈3.1); pescoço x≈1.8
    pin(arm, 'Bone.001', saddle(V((0.15, 0, 2.72)), 1.9, 0.7, (1, 0, 0), cloth, G, J, tassel=red))
    beads = []
    for k in range(13):
        a = R(-120 + k * 20)
        p = V((1.8, 0.58 * math.sin(a), 2.5 + 0.55 * math.cos(a)))
        beads.append(sphere(p, (0.085,) * 3, J if k % 2 else G, seg=10))
    beads.append(gem(V((1.86, 0, 1.92)), (0.15, 0.15, 0.2), J))
    pin(arm, 'Bone.002', beads)
    # elmo dourado (calota no alto da cabeça) com gema na testa
    helm = sphere(V((2.45, 0, 3.0)), (0.48, 0.42, 0.16), G)
    helm.rotation_euler = (0, R(-8), 0)
    pin(arm, 'Bone.003', [helm, gem(V((2.88, 0, 2.95)), (0.12, 0.12, 0.12), jade(1.6)),
                          torus(V((2.4, 0, 2.95)), 0.42, 0.04, G, rot=(0, R(90 - 8), 0))])
    # peitoral
    pin(arm, 'Bone.002', sphere(V((1.72, 0, 1.95)), (0.18, 0.42, 0.34), G))
    # braceletes
    for b, p in (('Bone.015', (1.15, -0.41, 0.42)), ('Bone.018', (1.15, 0.41, 0.42)),
                 ('Bone.009', (-1.77, 0.58, 0.45)), ('Bone.012', (-1.78, -0.53, 0.45))):
        pin(arm, b, torus(V(p), 0.2, 0.06, G))
    # gema e anel na ponta da cauda
    pin(arm, 'Bone.007', [gem(V((-2.29, 0, 4.42)), (0.15, 0.15, 0.25), jade(1.6)), torus(V((-2.27, 0, 4.15)), 0.13, 0.05, G)])
    place(arm, rot_z=R(90), scale=BACK_TOP / CAT_BACK)
