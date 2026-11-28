"""Peças comuns das montarias de Fundador (materiais, sela, gemas) para os scripts `setup` de render_sprites.py.
As peças são criadas nas coordenadas do modelo em pose de repouso e presas a um osso (seguem a animação)."""
import math
import bpy
from mathutils import Matrix, Vector

V = Vector
R = math.radians
TONE = 1.0  # multiplicador das cores-base (cfg "tone"; < 1 = cores mais profundas, menos estouro)


def _t(c):
    return tuple(v * TONE for v in c)


# ---------- materiais ----------
def _bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def mat(n, c, em=0.0, rough=0.5, metal=0.0, emc=None):
    m = bpy.data.materials.new(n)
    m.use_nodes = True
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*_t(c), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if em:
        b.inputs['Emission Color'].default_value = (*(emc or c), 1)
        b.inputs['Emission Strength'].default_value = em
    return m


def gold(em=0.35):
    return mat('ouro', (1.0, 0.66, 0.18), em=em, rough=0.22, metal=1.0, emc=(1, 0.6, 0.15))


def jade(em=1.2):
    return mat('jade', (0.1, 0.85, 0.5), em=em, rough=0.15, emc=(0.15, 1.0, 0.55))


def striped(base, stripe, em, scale=1.6, thin=0.62, emc=None, axis='X'):
    """Pelagem com listras: faixas onduladas ao longo do eixo `axis` do objeto; as listras brilham (em)."""
    m = bpy.data.materials.new('listras')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    b = _bsdf(m)
    tc = N.new('ShaderNodeTexCoord')
    wv = N.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.bands_direction = axis
    wv.inputs['Scale'].default_value = scale
    wv.inputs['Distortion'].default_value = 7
    wv.inputs['Detail'].default_value = 2
    L.new(tc.outputs['Object'], wv.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = thin
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = thin + 0.06
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    L.new(wv.outputs['Fac'], ramp.inputs['Fac'])
    mix = N.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*_t(base), 1)
    mix.inputs['B'].default_value = (*_t(stripe), 1)
    L.new(ramp.outputs['Color'], mix.inputs['Factor'])
    L.new(mix.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Emission Color'].default_value = (*(emc or stripe), 1)
    mul = N.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = em
    L.new(ramp.outputs['Color'], mul.inputs[0])
    L.new(mul.outputs[0], b.inputs['Emission Strength'])
    b.inputs['Roughness'].default_value = 0.55
    return m


def scales(c1, c2, metal=0.8, em=0.15, scale=9.0):
    """Escamas: voronoi (distância à borda) com relevo e duas tonalidades."""
    m = bpy.data.materials.new('escamas')
    m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links
    b = _bsdf(m)
    tc = N.new('ShaderNodeTexCoord')
    vo = N.new('ShaderNodeTexVoronoi')
    vo.feature = 'DISTANCE_TO_EDGE'
    vo.inputs['Scale'].default_value = scale
    L.new(tc.outputs['Object'], vo.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*_t(c2), 1)
    ramp.color_ramp.elements[1].position = 0.18
    ramp.color_ramp.elements[1].color = (*_t(c1), 1)
    L.new(vo.outputs['Distance'], ramp.inputs['Fac'])
    L.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    L.new(vo.outputs['Distance'], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Emission Color'].default_value = (*c1, 1)
    b.inputs['Emission Strength'].default_value = em
    return m


def recolor(obj, by_name):
    """Troca materiais do objeto pelo nome original ({nome: material})."""
    for i, m in enumerate(obj.data.materials):
        if m and m.name in by_name:
            obj.data.materials[i] = by_name[m.name]


# ---------- formas ----------
def _put(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)
    return o


def sphere(loc, s, m, rot=(0, 0, 0), seg=16, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = s
    if smooth:
        bpy.ops.object.shade_smooth()
    return _put(o, m)


def cyl(loc, r, d, m, rot=(0, 0, 0), v=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc, rotation=rot)
    return _put(bpy.context.object, m)


def cone(loc, r1, d, m, rot=(0, 0, 0), r2=0.0, v=8):
    bpy.ops.mesh.primitive_cone_add(vertices=v, radius1=r1, radius2=r2, depth=d, location=loc, rotation=rot)
    return _put(bpy.context.object, m)


def torus(loc, R_, r, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R_, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=24, minor_segments=8)
    return _put(bpy.context.object, m)


def gem(loc, s, m):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, location=loc)
    o = bpy.context.object
    o.scale = s
    return _put(o, m)


def saddle(loc, length, width, fwd, cloth, trim, gemm, tassel=None):
    """Sela: manta que abraça o lombo com barra dourada, assento, pito com gema, encosto, estribos e borlas.
    fwd = direção da cabeça (V, no plano XY). Devolve a lista de peças."""
    fwd = V((fwd[0], fwd[1], 0)).normalized()
    side = V((-fwd.y, fwd.x, 0))
    ang = math.atan2(fwd.y, fwd.x)
    objs = []
    o = sphere(loc + V((0, 0, -0.32)), (length * 0.46, width * 1.04, 0.5), trim, seg=24)
    o.rotation_euler = (0, 0, ang)
    objs.append(o)
    o = sphere(loc + V((0, 0, -0.22)), (length * 0.43, width * 1.06, 0.48), cloth, seg=24)
    o.rotation_euler = (0, 0, ang)
    objs.append(o)
    s = sphere(loc + V((0, 0, 0.12)), (length * 0.42, width * 0.55, 0.16), trim)
    s.rotation_euler = (0, 0, ang)
    objs.append(s)
    objs.append(sphere(loc + fwd * length * 0.38 + V((0, 0, 0.3)), (0.16, 0.16, 0.22), trim))
    objs.append(gem(loc + fwd * length * 0.38 + V((0, 0, 0.55)), (0.13, 0.13, 0.13), gemm))
    c = sphere(loc - fwd * length * 0.4 + V((0, 0, 0.26)), (0.12, width * 0.45, 0.2), trim)
    c.rotation_euler = (0, 0, ang)
    objs.append(c)
    for sgn in (-1, 1):
        p = loc + side * sgn * width * 1.05 + V((0, 0, -0.55))
        objs.append(torus(p, 0.14, 0.035, trim, rot=(R(90), 0, ang + R(90))))
        if tassel:
            objs.append(cone(p + V((0, 0, -0.25)) - fwd * 0.35, 0.09, 0.4, tassel))
    return objs


# ---------- esqueleto ----------
def rest_pose(arm):
    """Tira a animação e volta à pose de repouso (as peças são posicionadas nela)."""
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


def pin(arm, bone, objs):
    """Prende as peças (já no lugar, em pose de repouso) ao osso, mantendo a posição (parent_set do Blender)."""
    if not isinstance(objs, (list, tuple)):
        objs = [objs]
    vl = bpy.context.view_layer
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    arm.select_set(True)
    vl.objects.active = arm
    arm.data.bones.active = arm.data.bones[bone]
    bpy.ops.object.parent_set(type='BONE', keep_transform=True)
    bpy.ops.object.select_all(action='DESELECT')
    return objs


def place(arm, rot_z=0.0, scale=1.0):
    """Gira (para olhar para -Y, como o glTF) e escala o modelo inteiro a partir da origem."""
    M = Matrix.Rotation(rot_z, 4, 'Z') @ Matrix.Scale(scale, 4)
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_world = M @ o.matrix_world
    bpy.context.view_layer.update()
