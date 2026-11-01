"""The season pass can: one rotating can on a stand, five stages from bare aluminium to a legendary one.

Run: Blender -b --factory-startup --python build_pass_can.py -- <out_dir> --stage 1..5 [--still|--cutout] [--frames N]
Reads pass-wrap-<stage>.png, pass-glow-<stage>.png and pass-mark.png from <out_dir> (build_pass_textures.mjs writes them).
Writes pass-<stage>-still.png, with --cutout pass-<stage>-cutout.png (the can alone, on nothing), and without either
the frames of one seamless turn to frames-pass-<stage>/.
Everything moves by whole cycles of the loop, so the last frame runs into the first.
"""
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = ARGS[0]
STAGE = int(ARGS[ARGS.index('--stage') + 1])
STILL = '--still' in ARGS
CUTOUT = '--cutout' in ARGS
FRAMES = int(ARGS[ARGS.index('--frames') + 1]) if '--frames' in ARGS else 180
SIZE = (1080, 1350)
# The frame a still is taken from: the logo looks at the camera.
STILL_FRAME = 0

# Back wall, its glow, the stand's light, the world's tint, sparks.
LOOKS = {
    1: dict(wall=(0.039, 0.055, 0.086), glow=(0.15, 0.22, 0.33), ring=None, rim=(0.55, 0.72, 1.0), sparks=0),
    2: dict(wall=(0.0, 0.043, 0.157), glow=(0.0, 0.27, 0.75), ring=(0.0, 0.22, 1.0), rim=(0.2, 0.5, 1.0), sparks=0),
    3: dict(wall=(0.024, 0.016, 0.137), glow=(0.0, 0.42, 0.62), ring=(0.05, 0.75, 1.0), rim=(0.15, 0.9, 1.0), sparks=18),
    4: dict(wall=(0.067, 0.039, 0.016), glow=(0.5, 0.29, 0.06), ring=(1.0, 0.5, 0.08), rim=(1.0, 0.7, 0.3), sparks=24),
    5: dict(wall=(0.09, 0.016, 0.16), glow=(0.5, 0.1, 0.75), ring=(0.8, 0.22, 1.0), rim=(1.0, 0.4, 0.95), sparks=44),
}
LOOK = LOOKS[STAGE]

scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj)


def material(name, color=(1, 1, 1), metallic=0.0, roughness=0.4, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def link(obj, parent=None):
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def image(file, colorspace='sRGB'):
    img = bpy.data.images.load(os.path.join(OUT, file))
    img.colorspace_settings.name = colorspace
    return img


# ---------------------------------------------------------------- the can: a lathe, the printed body keeps a UV wrap
RADIUS = 0.29
BODY_BOTTOM, BODY_TOP = 0.1, 1.6
PROFILE = [
    (0.0, 0.085), (0.1, 0.08), (0.17, 0.055), (0.205, 0.015), (0.222, 0.0), (0.24, 0.006), (0.262, 0.04), (0.285, 0.085),
    (0.29, BODY_BOTTOM), (0.29, 0.5), (0.29, 1.0), (0.29, 1.45), (0.287, 1.49), (0.272, 1.54), (0.256, 1.585), (0.25, BODY_TOP),
    (0.247, 1.625), (0.252, 1.642), (0.256, 1.656), (0.25, 1.668), (0.24, 1.664), (0.233, 1.645), (0.226, 1.602), (0.216, 1.594),
    (0.206, 1.606), (0.12, 1.612), (0.0, 1.612),
]
SEGMENTS = 128


def lathe(name, mats):
    verts, faces, uvs = [], [], []
    rings = len(PROFILE)
    for ring, (radius, z) in enumerate(PROFILE):
        for step in range(SEGMENTS):
            angle = 2 * math.pi * step / SEGMENTS
            verts.append((radius * math.cos(angle), radius * math.sin(angle), z))
    for ring in range(rings - 1):
        for step in range(SEGMENTS):
            a, b = ring * SEGMENTS + step, ring * SEGMENTS + (step + 1) % SEGMENTS
            faces.append((a, b, b + SEGMENTS, a + SEGMENTS))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for mat in mats:
        mesh.materials.append(mat)
    uv = mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        ring = face.index // SEGMENTS
        step = face.index % SEGMENTS
        printed = BODY_BOTTOM - 1e-6 <= PROFILE[ring][1] and PROFILE[ring + 1][1] <= BODY_TOP + 1e-6 and PROFILE[ring + 1][1] >= PROFILE[ring][1]
        face.material_index = 0 if printed else 1
        face.use_smooth = True
        for corner, loop in enumerate(face.loop_indices):
            u = (step + (corner in (1, 2))) / SEGMENTS
            z = PROFILE[ring + (corner in (2, 3))][1]
            uv.data[loop].uv = (u, (z - BODY_BOTTOM) / (BODY_TOP - BODY_BOTTOM))
    return bpy.data.objects.new(name, mesh)


def stadium(half, radius, steps=10):
    """A flat stadium outline, counter-clockwise."""
    points = []
    for side, base in ((half, -math.pi / 2), (-half, math.pi / 2)):
        for step in range(steps + 1):
            angle = base + math.pi * step / steps
            points.append((side + radius * math.cos(angle), radius * math.sin(angle)))
    return points


def tab(mat):
    """The ring pull: a stadium with a hole, a tongue over the rivet, slightly lifted."""
    mesh = bpy.data.meshes.new('Tab')
    bm = bmesh.new()
    outer = stadium(0.052, 0.062)
    inner = stadium(0.03, 0.034)
    low, high = 0.0, 0.016
    rings = []
    for points, z in ((outer, low), (outer, high), (inner, high), (inner, low)):
        rings.append([bm.verts.new((x, y, z)) for x, y in points])
    count = len(outer)
    for ring in range(4):
        for step in range(count):
            a, b = rings[ring][step], rings[ring][(step + 1) % count]
            c, d = rings[(ring + 1) % 4][(step + 1) % count], rings[(ring + 1) % 4][step]
            bm.faces.new((a, b, c, d))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    for face in mesh.polygons:
        face.use_smooth = False
    return bpy.data.objects.new('Tab', mesh)


wrap = image(f'pass-wrap-{STAGE}.png')
glow = image(f'pass-glow-{STAGE}.png')

METAL = {
    1: dict(color=(0.74, 0.76, 0.8), roughness=0.3),
    2: dict(color=(0.8, 0.82, 0.86), roughness=0.24),
    3: dict(color=(0.12, 0.14, 0.26), roughness=0.3),
    4: dict(color=(1.0, 0.68, 0.22), roughness=0.2),
    5: dict(color=(1.0, 0.72, 0.3), roughness=0.16),
}[STAGE]
metal = material('CanMetal', METAL['color'], 1.0, METAL['roughness'])

body = material('CanBody', metallic=1.0, roughness={1: 0.32, 2: 0.28, 3: 0.3, 4: 0.24, 5: 0.2}[STAGE])
nodes, links = body.node_tree.nodes, body.node_tree.links
bsdf = nodes['Principled BSDF']
color_tex = nodes.new('ShaderNodeTexImage')
color_tex.image = wrap
links.new(color_tex.outputs['Color'], bsdf.inputs['Base Color'])

glow_strength = None
if STAGE in (3, 5):
    glow_tex = nodes.new('ShaderNodeTexImage')
    glow_tex.image = glow
    links.new(glow_tex.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.8
    glow_strength = bsdf.inputs['Emission Strength']

if STAGE == 5:
    # Holographic foil: the colour runs with the angle to the camera and with a slow noise stuck to the body.
    facing = nodes.new('ShaderNodeLayerWeight')
    facing.inputs['Blend'].default_value = 0.5
    coord = nodes.new('ShaderNodeTexCoord')
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.0
    noise.inputs['Detail'].default_value = 3.0
    links.new(coord.outputs['Object'], noise.inputs['Vector'])
    mix = nodes.new('ShaderNodeMath')
    mix.operation = 'ADD'
    scale = nodes.new('ShaderNodeMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = 0.8
    links.new(noise.outputs['Fac'], scale.inputs[0])
    links.new(facing.outputs['Facing'], mix.inputs[0])
    links.new(scale.outputs['Value'], mix.inputs[1])
    ramp = nodes.new('ShaderNodeValToRGB')
    stops = ramp.color_ramp.elements
    stops[0].position, stops[0].color = 0.15, (0.1, 0.008, 0.42, 1)
    stops[1].position, stops[1].color = 1.1 / 1.5, (0.6, 0.04, 0.3, 1)
    for position, color in ((0.3, (0.02, 0.1, 0.6, 1)), (0.45, (0.01, 0.42, 0.55, 1)), (0.6, (0.38, 0.06, 0.65, 1)), (0.86, (0.7, 0.36, 0.05, 1))):
        stop = stops.new(position)
        stop.color = color
    links.new(mix.outputs['Value'], ramp.inputs['Fac'])
    # The white name in the wrap stays gold foil; the grey is what the hologram shows through.
    logo_mask = nodes.new('ShaderNodeMix')
    logo_mask.data_type = 'RGBA'
    logo_mask.inputs['B'].default_value = (1.0, 0.8, 0.42, 1)
    links.new(ramp.outputs['Color'], logo_mask.inputs['A'])
    threshold = nodes.new('ShaderNodeMapRange')
    threshold.inputs['From Min'].default_value = 0.6
    threshold.inputs['From Max'].default_value = 0.8
    links.new(color_tex.outputs['Color'], threshold.inputs['Value'])
    links.new(threshold.outputs['Result'], logo_mask.inputs['Factor'])
    links.new(logo_mask.outputs['Result'], bsdf.inputs['Base Color'])

spin_root = link(bpy.data.objects.new('Float', None))
spin = link(bpy.data.objects.new('Spin', None), spin_root)
can = link(lathe('Can', [body, metal]), spin)
pull = link(tab(metal), spin)
pull.location = (0.075, 0, 1.616)
rivet_mesh = bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.02, depth=0.014, location=(0.0, 0, 1.624))
rivet = bpy.context.active_object
rivet.parent = spin
rivet.data.materials.append(metal)

# ---------------------------------------------------------------- the stand
stand_mat = material('Stand', (0.02, 0.022, 0.03), 0.9, 0.22)
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.0, depth=0.16, location=(0, 0, -0.08))
stand = bpy.context.active_object
stand.data.materials.append(stand_mat)
for face in stand.data.polygons:
    face.use_smooth = len(face.vertices) == 4
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.22, depth=0.1, location=(0, 0, -0.21))
step = bpy.context.active_object
step.data.materials.append(stand_mat)
for face in step.data.polygons:
    face.use_smooth = len(face.vertices) == 4

# A pool of light on the stand under the can, brighter as the can grows.
size = 256
ys_, xs_ = np.mgrid[0:size, 0:size]
reach = np.hypot((xs_ + 0.5) / size - 0.5, (ys_ + 0.5) / size - 0.5) * 2
pool = np.ones((size, size, 4), dtype=np.float32)
pool[..., 3] = np.clip(1 - reach, 0, 1) ** 2
pool_img = bpy.data.images.new('Pool', size, size, alpha=True)
pool_img.pixels.foreach_set(pool.ravel())
pool_mat = material('Pool', (0, 0, 0), emission=LOOK['ring'] or LOOK['rim'], strength=0.5 + STAGE * 0.35)
pool_nodes = pool_mat.node_tree.nodes
pool_tex = pool_nodes.new('ShaderNodeTexImage')
pool_tex.image = pool_img
pool_mat.node_tree.links.new(pool_tex.outputs['Alpha'], pool_nodes['Principled BSDF'].inputs['Alpha'])
pool_mat.surface_render_method = 'BLENDED'
bpy.ops.mesh.primitive_plane_add(size=1.7, location=(0, 0, 0.002))
bpy.context.active_object.data.materials.append(pool_mat)

RING_POWER = {2: 2.6, 3: 2.3, 4: 2.1, 5: 2.3}.get(STAGE, 0)
ring_light = None
if LOOK['ring']:
    ring_mat = material('Ring', (0, 0, 0), emission=LOOK['ring'], strength=RING_POWER)
    ring_light = ring_mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
    bpy.ops.mesh.primitive_torus_add(major_radius=1.005, minor_radius=0.014, major_segments=128, minor_segments=8, location=(0, 0, 0.0))
    bpy.context.active_object.data.materials.append(ring_mat)
    if STAGE >= 3:
        bpy.ops.mesh.primitive_torus_add(major_radius=1.225, minor_radius=0.01, major_segments=128, minor_segments=8, location=(0, 0, -0.16))
        bpy.context.active_object.data.materials.append(ring_mat)

# ---------------------------------------------------------------- what each stage adds around the can
caps, arcs, aura, sparks = [], [], None, []
rng = random.Random(STAGE)


def spark_mesh(name, mat, size):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=size)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


if LOOK['sparks']:
    tint = LOOK['ring']
    spark_mat = material('Spark', (0, 0, 0), emission=tint, strength=6.0)
    white = material('SparkWhite', (0, 0, 0), emission=(1, 1, 1), strength=4.0)
    for index in range(LOOK['sparks']):
        sparks.append(dict(
            obj=spark_mesh(f'Spark{index}', spark_mat if index % 3 else white, rng.uniform(0.012, 0.022)),
            angle=rng.uniform(0, math.tau), radius=rng.uniform(0.55, 1.15), phase=rng.random(), turns=rng.choice((1, 1, 2)), sway=rng.uniform(0.02, 0.06)))

if STAGE >= 4:
    # Gold bottle caps orbit the can.
    cap_mat = material('Cap', (1.0, 0.66, 0.2), 1.0, 0.2)
    count = 6 if STAGE == 4 else 8
    for index in range(count):
        bpy.ops.mesh.primitive_cone_add(vertices=21, radius1=0.078, radius2=0.066, depth=0.04, location=(0, 0, 0))
        cap = bpy.context.active_object
        cap.data.materials.append(cap_mat)
        for face in cap.data.polygons:
            face.use_smooth = False
        caps.append(dict(obj=cap, angle=index * math.tau / count, height=0.86 + 0.3 * math.sin(index * 2.4), radius=0.72 + 0.06 * (index % 2)))

if STAGE == 5:
    # Lightning: thin ribbons around the can, one set shows at a time.
    arc_mat = material('Arc', (0, 0, 0), emission=(0.85, 0.6, 1.0), strength=7.0)


    def arc(seed):
        pick = random.Random(seed)
        start = pick.uniform(0, math.tau)
        points, joints = [], 9
        base = pick.uniform(0.3, 1.5)
        for joint in range(joints):
            t = joint / (joints - 1)
            angle = start + t * pick.uniform(1.0, 1.5)
            distance = 0.33 + 0.1 * math.sin(t * math.pi) + pick.uniform(-0.03, 0.05)
            points.append(Vector((distance * math.cos(angle), distance * math.sin(angle), base + (t - 0.5) * 0.5 + pick.uniform(-0.05, 0.05))))
        verts, faces = [], []
        for index, point in enumerate(points):
            width = 0.012 * (1 - abs(index / (joints - 1) - 0.5) * 1.4)
            verts += [point + Vector((0, 0, width)), point - Vector((0, 0, width))]
            if index:
                faces.append((2 * index - 2, 2 * index - 1, 2 * index + 1, 2 * index))
        mesh = bpy.data.meshes.new(f'Arc{seed}')
        mesh.from_pydata(verts, [], faces)
        mesh.materials.append(arc_mat)
        return link(bpy.data.objects.new(f'Arc{seed}', mesh))


    arcs = [arc(seed) for seed in range(18)]
    aura_mat = material('Aura', (0, 0, 0), emission=(0.7, 0.16, 1.0), strength=2.0)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.42, minor_radius=0.012, major_segments=128, minor_segments=8, location=(0, 0, 0.1))
    aura = bpy.context.active_object
    aura.data.materials.append(aura_mat)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.62, minor_radius=0.008, major_segments=128, minor_segments=8, location=(0, 0, 0.28))
    bpy.context.active_object.data.materials.append(aura_mat)

# ---------------------------------------------------------------- reflections: a studio painted into the world
width, height = 1024, 512
xs, ys = np.meshgrid((np.arange(width) + 0.5) / width, (np.arange(height) + 0.5) / height)
azimuth = xs * 2 * np.pi - np.pi
elevation = (0.5 - ys) * np.pi
rim = np.array(LOOK['rim'])
sky = np.zeros((height, width, 4), dtype=np.float32)
sky[..., 3] = 1
sky[..., :3] = np.array(LOOK['glow']) * 0.2 * (0.6 + 0.4 * np.sin(elevation))[..., None]


def softbox(center, half_width, low, high, color, power):
    distance = np.abs((azimuth - center + np.pi) % (2 * np.pi) - np.pi)
    across = np.clip(1 - (distance / half_width) ** 6, 0, 1)
    along = np.clip((elevation - low) * 8, 0, 1) * np.clip((high - elevation) * 8, 0, 1)
    sky[..., :3] += (across * along)[..., None] * np.array(color) * power


# The camera looks along +Y, so the can's front mirrors what is behind the camera, at azimuth -pi/2.
softbox(-np.pi / 2 - 0.85, 0.2, -0.5, 1.2, (1, 1, 1), 5.5)
softbox(-np.pi / 2 + 0.62, 0.075, -0.5, 1.2, (1, 1, 1), 3.2)
softbox(-np.pi / 2 + 2.2, 0.3, -0.4, 1.3, rim, 7)
softbox(-np.pi / 2 - 2.2, 0.3, -0.4, 1.3, rim, 7)
softbox(np.pi / 2, 3.2, 1.15, 1.6, (1, 1, 1), 2.2)
world_img = bpy.data.images.new('Studio', width, height, alpha=True, float_buffer=True)
world_img.pixels.foreach_set(np.flipud(sky).ravel())
world = bpy.data.worlds.new('Studio')
world.use_nodes = True
env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = world_img
world.node_tree.links.new(env.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
scene.world = world


def area(name, location, energy, size, color):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size, light.color = energy, size, color
    obj = link(bpy.data.objects.new(name, light))
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 0.8)) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()


area('Key', (-2.2, -3.2, 3.0), 110, 1.8, (1, 0.98, 0.95))
area('RimL', (-2.6, 2.4, 2.2), 220, 1.2, LOOK['rim'])
area('RimR', (2.6, 2.4, 2.2), 220, 1.2, LOOK['rim'])

# ---------------------------------------------------------------- camera: the can stands above the middle of the tall frame
cam = bpy.data.cameras.new('Camera')
cam.lens = 72
cam.sensor_fit = 'VERTICAL'
cam.sensor_height = 36
cam_obj = link(bpy.data.objects.new('Camera', cam))
scene.camera = cam_obj
cam_obj.location = (0, -6.1, 2.62)
cam_obj.rotation_euler = (Vector((0, 0, 0.5)) - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

# ---------------------------------------------------------------- the back wall: a vignette and the big CanRush mark
yy, xx = np.mgrid[0:SIZE[1], 0:SIZE[0]]
nx, ny = (xx + 0.5) / SIZE[0] - 0.5, (yy + 0.5) / SIZE[1] - 0.46
distance = np.hypot(nx * 1.15, ny) * 2
wall = np.array(LOOK['wall'], dtype=np.float32)
light_tone = np.array(LOOK['glow'], dtype=np.float32)
falloff = np.clip(1 - distance, 0, 1) ** 2.1
canvas = wall + (light_tone - wall)[None, None, :] * falloff[..., None]
mark = bpy.data.images.load(os.path.join(OUT, 'pass-mark.png'))
mw, mh = mark.size
pixels = np.empty(mw * mh * 4, dtype=np.float32)
mark.pixels.foreach_get(pixels)
alpha = np.flipud(pixels.reshape(mh, mw, 4))[..., 3]
wide = int(SIZE[0] * 1.02)
rows = (np.arange(int(wide * mh / mw)) * mh / int(wide * mh / mw)).astype(int)
cols = (np.arange(wide) * mw / wide).astype(int)
scaled = alpha[rows][:, cols]
left, top = (SIZE[0] - wide) // 2, int(SIZE[1] * 0.4) - scaled.shape[0] // 2
crop = scaled[:, -left:-left + SIZE[0]]
layer = np.zeros((SIZE[1], SIZE[0]), dtype=np.float32)
layer[top:top + crop.shape[0], :] = crop
canvas += light_tone[None, None, :] * (layer * 0.34 * (0.25 + falloff))[..., None]
# Grain against banding in the dark gradient after the video compression.
canvas = np.clip(canvas, 0, 1)
canvas += np.random.default_rng(STAGE).normal(0, 0.006, canvas.shape[:2] + (1,)).astype(np.float32)
bg_pixels = np.ones((SIZE[1], SIZE[0], 4), dtype=np.float32)
bg_pixels[..., :3] = np.clip(canvas, 0, 1)
bg_img = bpy.data.images.new(f'PassBg{STAGE}', SIZE[0], SIZE[1], alpha=True)
bg_img.pixels.foreach_set(np.flipud(bg_pixels).ravel())
bg_img.filepath_raw = os.path.join(OUT, f'pass-bg-{STAGE}.png')
bg_img.file_format = 'PNG'
bg_img.save()

# ---------------------------------------------------------------- render and compositing
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = SIZE
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.eevee.taa_render_samples = 48
scene.eevee.use_raytracing = True
tree = bpy.data.node_groups.new('SceneComp', 'CompositorNodeTree')
tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
layers = tree.nodes.new('CompositorNodeRLayers')
bg_node = tree.nodes.new('CompositorNodeImage')
bg_node.image = bpy.data.images.load(os.path.join(OUT, f'pass-bg-{STAGE}.png'))
over = tree.nodes.new('CompositorNodeAlphaOver')
glare = tree.nodes.new('CompositorNodeGlare')
result = tree.nodes.new('NodeGroupOutput')
for key, value in (('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 1.0), ('Strength', 0.55), ('Size', 0.6)):
    if key in glare.inputs:
        glare.inputs[key].default_value = value
tree.links.new(layers.outputs['Image'], glare.inputs['Image'])
inputs = [socket for socket in over.inputs if socket.type == 'RGBA']
tree.links.new(bg_node.outputs['Image'], inputs[0])
tree.links.new(glare.outputs['Image'], inputs[1])
tree.links.new(over.outputs['Image'], result.inputs['Image'])
scene.compositing_node_group = tree
scene.render.use_compositing = True
scene.render.image_settings.file_format = 'PNG'


def pose(frame):
    t = frame / FRAMES
    turn = t * math.tau
    spin.rotation_euler = (0, 0, -turn - math.pi)
    spin_root.location = (0, 0, 0.11 + 0.035 * math.sin(turn * 2))
    spin_root.rotation_euler = (math.radians(1.6) * math.sin(turn), math.radians(1.6) * math.cos(turn), 0)
    if glow_strength:
        glow_strength.default_value = (1.7 if STAGE == 3 else 1.5) * (0.8 + 0.2 * math.sin(turn * 4))
    if ring_light:
        ring_light.default_value = RING_POWER * (0.82 + 0.18 * math.sin(turn * 2))
    for spark in sparks:
        life = (spark['phase'] + t * spark['turns']) % 1
        angle = spark['angle'] + turn
        radius = spark['radius'] + spark['sway'] * math.sin(life * math.tau)
        spark['obj'].location = (radius * math.cos(angle), radius * math.sin(angle), 0.05 + life * 2.1)
        spark['obj'].scale = (min(1, life * 8) * min(1, (1 - life) * 3),) * 3
    for cap in caps:
        angle = cap['angle'] + turn
        cap['obj'].location = (cap['radius'] * math.cos(angle), cap['radius'] * math.sin(angle) * 0.92, cap['height'] + 0.07 * math.sin(angle * 2))
        cap['obj'].rotation_euler = (1.1 + 0.3 * math.sin(angle), turn * 2, angle)
    if arcs:
        shown = {(frame // 3 * 7) % len(arcs), (frame // 3 * 11 + 5) % len(arcs)}
        for index, obj in enumerate(arcs):
            obj.hide_render = index not in shown or (frame // 3) % 5 == 4


if CUTOUT:
    keep = {can, pull, rivet, spin, spin_root, cam_obj}
    for obj in scene.objects:
        if obj.type == 'MESH' and obj not in keep:
            obj.hide_render = True
    pose(STILL_FRAME)
    for obj in arcs:
        obj.hide_render = True
    scene.render.use_compositing = False
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = os.path.join(OUT, f'pass-{STAGE}-cutout.png')
    bpy.ops.render.render(write_still=True)
elif STILL:
    pose(STILL_FRAME)
    scene.render.filepath = os.path.join(OUT, f'pass-{STAGE}-still.png')
    bpy.ops.render.render(write_still=True)
    print('STILL', scene.render.filepath)
else:
    folder = os.path.join(OUT, f'frames-pass-{STAGE}')
    os.makedirs(folder, exist_ok=True)
    for frame in range(FRAMES):
        pose(frame)
        scene.render.filepath = os.path.join(folder, f'{frame:04d}.png')
        bpy.ops.render.render(write_still=True)
    print('FRAMES', folder)
