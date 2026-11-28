"""Pose de montaria dos personagens KayKit (gancho `setup` de render_sprites.py): cria a ação 'Ride' a partir de
'Sit_Chair_Pose', com pés e joelhos levados para fora e para baixo (pernas abertas, abraçando a sela).
Deslocamentos (em unidades do modelo, mundo: X = lado, Y = trás, Z = cima) no cfg "ride": {"foot": [x,y,z], "knee": [x,y,z]}."""
import bpy
from mathutils import Vector


def _offset(arm, bone, world_delta):
    pb = arm.pose.bones[bone]
    rot = (arm.matrix_world.to_3x3() @ pb.bone.matrix_local.to_3x3()).inverted()
    pb.location = pb.location + rot @ Vector(world_delta)


def setup(cfg):
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    rc = cfg.get('ride', {})
    foot = rc.get('foot', [0.16, 0.22, -0.32])
    knee = rc.get('knee', [0.35, 0.0, 0.0])
    src = bpy.data.actions['Sit_Chair_Pose']
    act = src.copy()
    act.name = 'Ride'
    arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots:
        arm.animation_data.action_slot = act.slots[0]
    sc = bpy.context.scene
    sc.frame_set(int(act.frame_range[0]))
    for s in ('l', 'r'):
        sign = 1 if s == 'l' else -1
        for b, d in (('control-heel-roll.' + s, foot), ('kneeIK.' + s, knee)):
            _offset(arm, b, (sign * d[0], d[1], d[2]))
            for fr in range(int(act.frame_range[0]), int(act.frame_range[1]) + 1):
                arm.pose.bones[b].keyframe_insert('location', frame=fr)
    arm.animation_data.action = None
