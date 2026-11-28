"""Grou Celestial (montaria de Fundador): grou-de-coroa-vermelha feito por script (sem modelo de terceiros), sempre
voando. Branco com pescoço azul-noite, pontas das asas e plumas da cauda azul-celeste brilhando, coroa rubra, safiras
nas asas e arreio dourado. Esqueleto próprio com duas ações: 'Idle' (plana, bate devagar) e 'Fly' (bate forte)."""
import math
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(__file__))
import _lib  # noqa: E402
from _lib import V, R, mat, gold, sphere, cyl, cone, torus, gem, saddle, pin  # noqa: E402

BACK_TOP = 3.42  # lombo na mesma altura do Cavalo (o cavaleiro senta no mesmo lugar)
ZB = BACK_TOP - 0.8  # centro do corpo
W1, W2 = 1.9, 2.3  # comprimento da asa: braço e ponta (envergadura ≈ 2 x 5.3)


def _armature():
    ad = bpy.data.armatures.new('GrouArm')
    arm = bpy.data.objects.new('GrouArmature', ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = ad.edit_bones

    def bone(n, h, t, parent=None):
        b = eb.new(n)
        b.head, b.tail = V(h), V(t)
        b.roll = 0
        if parent:
            b.parent = eb[parent]
        return b

    bone('Body', (0, 0.9, ZB), (0, -0.9, ZB))
    bone('Neck', (0, -1.4, ZB + 0.2), (0, -3.2, ZB + 0.7), 'Body')
    bone('Head', (0, -3.2, ZB + 0.7), (0, -4.9, ZB + 0.95), 'Neck')
    bone('Tail', (0, 1.5, ZB + 0.05), (0, 3.4, ZB + 0.25), 'Body')
    bone('Legs', (0, 1.2, ZB - 0.5), (0, 3.6, ZB - 1.0), 'Body')
    for s, n in ((1, 'L'), (-1, 'R')):
        bone('Wing1.' + n, (s * 0.55, -0.35, ZB + 0.35), (s * (0.55 + W1), -0.35, ZB + 0.5), 'Body')
        bone('Wing2.' + n, (s * (0.55 + W1), -0.35, ZB + 0.5), (s * (0.55 + W1 + W2), -0.35, ZB + 0.45), 'Wing1.' + n)
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def _wing(s, x0, x1, y_front, y_back_fn, z0, z1, mats, tip=False):
    """Painel de asa entre x0 e x1 (lado s), borda da frente reta e de trás recortada em penas."""
    n = 6
    front = [(x0 + (x1 - x0) * k / n, y_front(k / n), z0 + (z1 - z0) * k / n) for k in range(n + 1)]
    back = []
    for k in range(n * 2, -1, -1):
        t = k / (n * 2)
        back.append((x0 + (x1 - x0) * t, y_back_fn(t) + (0.35 if k % 2 else 0), z0 + (z1 - z0) * t))
    poly = front + back
    me = bpy.data.meshes.new('asa')
    me.from_pydata([(s * p[0], p[1], p[2]) for p in poly], [], [list(range(len(poly)))])
    o = bpy.data.objects.new('asa', me)
    bpy.context.scene.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    o.modifiers.new('esp', 'SOLIDIFY').thickness = 0.14
    return o


def _key_action(arm, name, n, fn):
    """Ação com n quadros-chave (laço: o último repete o primeiro). fn(t) -> {osso: (rx, ry, rz, z)}."""
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    for i in range(n + 1):
        t = i / n
        for b, (rx, ry, rz, z) in fn(t).items():
            pb = arm.pose.bones[b]
            pb.rotation_euler = (R(rx), R(ry), R(rz))
            pb.location = (0, 0, z)
            pb.keyframe_insert('rotation_euler', frame=1 + i * 2)
            pb.keyframe_insert('location', frame=1 + i * 2)
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    return act


def _flap(amp1, amp2, base, bob, neck, lag=0.18):
    def fn(t):
        a = math.sin(2 * math.pi * t)
        a2 = math.sin(2 * math.pi * (t - lag))
        keys = {
            'Body': (0, 0, 0, -bob * a),
            'Neck': (neck * math.sin(2 * math.pi * (t - 0.25)), 0, 0, 0),
            'Head': (-neck * 0.6 * math.sin(2 * math.pi * (t - 0.25)), 0, 0, 0),
            'Tail': (3 * a, 0, 0, 0),
            'Legs': (4 * math.sin(2 * math.pi * (t - 0.4)), 0, 0, 0),
        }
        for n in ('L', 'R'):
            keys['Wing1.' + n] = (base + amp1 * a, 0, 0, 0)
            keys['Wing2.' + n] = (amp2 * a2, 0, 0, 0)
        return keys
    return fn


def setup(cfg):
    _lib.TONE = cfg.get('tone', 1.0)
    arm = _armature()
    W = mat('branco', (0.8, 0.8, 0.8), rough=0.55)
    K = mat('preto', (0.03, 0.03, 0.05), rough=0.5)
    CROWN = mat('coroa', (1, 0.05, 0.05), em=1.5)
    BEAK = mat('bico', (0.75, 0.68, 0.45), rough=0.3)
    SKY = mat('ponta_ceu', (0.15, 0.45, 0.95), em=0.4, rough=0.3)
    NECK = mat('pescoco', (0.2, 0.35, 0.75), rough=0.4)
    SAPH = mat('safira', (0.3, 0.6, 1), em=1.5)
    G = gold()
    z = ZB
    # corpo e plumas da cauda
    pin(arm, 'Body', sphere(V((0, 0, z)), (0.95, 2.0, 0.85), W, seg=24))
    pin(arm, 'Tail', [cone(V((s * 0.35, 2.4 + 0.2 * (s == 0), z + 0.15)), 0.32, 3.2, SKY, rot=(R(-80), 0, R(s * 12)), v=6)
                      for s in (-1, 0, 1)])
    # pescoço (curva convertida em malha) e cabeça
    cu = bpy.data.curves.new('pesc', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.24
    cu.bevel_resolution = 3
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(2)
    for bp, p in zip(sp.bezier_points, [(0, -1.5, z + 0.25), (0, -3.2, z + 0.75), (0, -4.6, z + 0.95)]):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cu.materials.append(NECK)
    neck = bpy.data.objects.new('pesc', cu)
    bpy.context.scene.collection.objects.link(neck)
    pin(arm, 'Neck', [neck, torus(V((0, -1.75, z + 0.45)), 0.36, 0.06, G, rot=(R(70), 0, 0)),
                      gem(V((0, -2.05, z + 0.2)), (0.2, 0.2, 0.25), SAPH)])
    head = [sphere(V((0, -4.85, z + 0.98)), (0.33, 0.48, 0.32), W), sphere(V((0, -4.82, z + 1.22)), (0.24, 0.3, 0.13), CROWN),
            cone(V((0, -5.85, z + 0.88)), 0.13, 1.4, BEAK, rot=(R(95), 0, 0)), torus(V((0, -4.55, z + 0.95)), 0.27, 0.05, G, rot=(R(80), 0, 0))]
    head += [sphere(V((s * 0.26, -5.0, z + 1.02)), (0.05,) * 3, K) for s in (-1, 1)]
    pin(arm, 'Head', head)
    # pernas para trás
    pin(arm, 'Legs', [cyl(V((x, 2.9, z - 0.55)), 0.06, 3.0, K, rot=(R(75), 0, 0)) for x in (-0.3, 0.3)])
    # asas: braço (branco) e ponta (branco com primárias azul-celeste), safiras na borda da frente
    for s, n in ((1, 'L'), (-1, 'R')):
        x0, x1, x2 = 0.55, 0.55 + W1, 0.55 + W1 + W2
        inner = _wing(s, x0, x1, lambda t: -1.25 - 0.3 * t, lambda t: 0.85 + 0.35 * t, z + 0.35, z + 0.5, [W])
        outer = _wing(s, x1, x2, lambda t: -1.55 + 0.9 * t * t, lambda t: 1.2 - 0.8 * t * t, z + 0.5, z + 0.45, [W])
        tips = _wing(s, x1 + W2 * 0.45, x2, lambda t: -1.3 + 0.75 * t * t, lambda t: 0.95 - 0.7 * t * t, z + 0.56, z + 0.51, [SKY])
        pin(arm, 'Wing1.' + n, [inner] + [gem(V((s * (x0 + 0.6 + k * 0.7), -1.3, z + 0.5)), (0.11,) * 3, SAPH) for k in range(3)])
        pin(arm, 'Wing2.' + n, [outer, tips])
    # arreio dourado (sela) no lombo
    pin(arm, 'Body', saddle(V((0, -0.4, BACK_TOP - 0.05)), 1.9, 0.8, (0, -1, 0), mat('pano', (0.12, 0.2, 0.55), rough=0.6), G, SAPH,
                            tassel=mat('borla', (0.85, 0.08, 0.06), em=0.6)))
    # ações (nomes usados no JSON)
    _key_action(arm, 'Idle', 6, _flap(10, 8, -4, 0.08, 3))
    _key_action(arm, 'Fly', 6, _flap(32, 22, 0, 0.2, 5))
