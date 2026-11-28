"""Asinha dourada do título exclusivo (Fundador): modelada aqui (penas em camadas), renderizada batendo em N quadros.
Saída: public/sprites/fx/title-wing.png (tira horizontal, asa ESQUERDA: base à direita) + .json {frames, w, h}.
Rodar (na raiz):  .venv-blender/bin/python tools/sprites/title_wing.py
"""
import bpy, bmesh, math, json, os, tempfile
from mathutils import Matrix, Vector

N = 8            # quadros do bater de asa (loop)
W, H = 96, 72    # quadro em px (o jogo desenha em ~1/3)
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'sprites', 'fx')

def srgb(c):
    return [((v / 255 + 0.055) / 1.055) ** 2.4 for v in c] + [1]

def mat(name, rgb, metal=0.7, rough=0.35, emit=0.15):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(rgb)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Emission Color'].default_value = srgb(rgb)
    b.inputs['Emission Strength'].default_value = emit
    return m

def feather(bm, length, width, curve=0.12, seg=6):
    """Pena: folha alongada com ponta arredondada, levemente curvada (eixo +X), espessura pequena; base na origem."""
    top, bot = [], []
    for i in range(seg + 1):
        t = i / seg
        w = width * (math.sin(math.pi * min(1, t * 1.15)) ** 0.6 if t < 0.87 else (1 - t) / 0.13 * 0.55) + 0.01
        x = length * t; y = curve * length * t * t
        top.append(bm.verts.new((x, y + w / 2, 0.012))); bot.append(bm.verts.new((x, y - w / 2, 0.012)))
    for i in range(seg):
        bm.faces.new((bot[i], bot[i + 1], top[i + 1], top[i]))
    # nervura central (aresta clara) num fio fino por cima
    return top, bot

def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    mats = [mat('claro', (255, 238, 170)), mat('medio', (240, 190, 90)), mat('escuro', (196, 128, 40)),
            mat('osso', (255, 246, 210), metal=0.3, rough=0.3, emit=0.3)]
    root = bpy.data.objects.new('raiz', None); sc.collection.objects.link(root)
    # 3 fileiras: rêmiges (longas, escuras), secundárias (médias), coberteiras (curtas, claras), em leque para cima
    rows = [  # (n, comprimento, largura, ângulo inicial, ângulo final, material, z)
        (8, 2.0, 0.42, 150, 100, 2, 0.00),
        (7, 1.35, 0.40, 146, 104, 1, 0.05),
        (6, 0.8, 0.38, 140, 108, 0, 0.10),
    ]
    for ri, (n, ln, wd, a0, a1, mi, z) in enumerate(rows):
        for k in range(n):
            t = k / (n - 1)
            me = bpy.data.meshes.new(f'p{ri}{k}'); bm = bmesh.new()
            feather(bm, ln * (1 - 0.18 * t), wd, curve=-0.10)
            bm.to_mesh(me); bm.free(); me.materials.append(mats[mi])
            for p in me.polygons: p.use_smooth = True
            o = bpy.data.objects.new(f'p{ri}{k}', me); sc.collection.objects.link(o); o.parent = root
            o.rotation_euler = (0, 0, math.radians(a0 + (a1 - a0) * t))
            o.location = (0.08 * ri, 0.10 * ri + 0.05 * t, z)
            o.modifiers.new('s', 'SOLIDIFY').thickness = 0.02
    # "ombro": gota dourada na base
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0.18, 0.2, 0.09), segments=16, ring_count=8)
    s = bpy.context.active_object; s.scale = (1.3, 0.9, 0.5); s.data.materials.append(mats[1]); s.parent = root
    bpy.ops.object.shade_smooth()
    cam_d = bpy.data.cameras.new('C'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = 2.7
    cam = bpy.data.objects.new('C', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (-0.75, 0.95, 10)
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.film_transparent = True
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    sun_d = bpy.data.lights.new('S', 'SUN'); sun_d.energy = 3.5
    sun = bpy.data.objects.new('S', sun_d); sc.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(35), math.radians(-25), 0)
    return sc, root

def main():
    from PIL import Image
    sc, root = build()
    os.makedirs(OUT, exist_ok=True)
    strip = Image.new('RGBA', (W * N, H))
    tmp = tempfile.mkdtemp()
    for f in range(N):
        a = math.sin(2 * math.pi * f / N)  # -1..1
        # bater: a asa gira em torno do eixo vertical da base (encurta ao "ir para trás") e sobe/desce um pouco
        root.rotation_euler = (0, math.radians(30 * (1 - a) / 2), math.radians(24 * a))
        root.location = (0.18, 0.2, 0)
        root.matrix_world = Matrix.Translation((0.18, 0.2, 0)) @ root.rotation_euler.to_matrix().to_4x4() @ Matrix.Translation((-0.18, -0.2, 0))
        p = os.path.join(tmp, f'{f}.png'); sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        strip.paste(Image.open(p), (W * f, 0))
    # contorno marrom de 2 px em volta (como o traço do texto do título)
    from PIL import ImageFilter
    al = strip.getchannel('A').point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(5))
    edge = Image.new('RGBA', strip.size, (42, 22, 0, 255)); edge.putalpha(al)
    edge.alpha_composite(strip); strip = edge
    path = os.path.join(OUT, 'title-wing.png')
    strip.save(path, optimize=True)
    json.dump({'frames': N, 'w': W, 'h': H}, open(path[:-4] + '.json', 'w'))
    print('ok', path)

main()
