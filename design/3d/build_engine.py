"""The beta «Двигатель» screen: our engine turning on the pass stand, idling — pulleys run, the block trembles, sparks rise.

Run: Blender -b --factory-startup --python build_engine.py -- <out_dir> [--still] [--frames N]
Reads pass-mark.png from <out_dir> (build_pass_textures.mjs writes it) and our mark from apps/site/public/brand.
Writes engine-still.png, without --still the frames of one seamless turn to frames-engine/. Everything moves by whole
cycles of the loop, so the last frame runs into the first. The wall is the blue of the pass's second stage (#000b28),
so the screen takes the same colours with data-stage="2".
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
STILL = '--still' in ARGS
FRAMES = int(ARGS[ARGS.index('--frames') + 1]) if '--frames' in ARGS else 180
SIZE = (1080, 1350)
BRAND = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../apps/site/public/brand')
LOOK = dict(wall=(0.0, 0.043, 0.157), glow=(0.0, 0.27, 0.75), ring=(0.0, 0.22, 1.0), rim=(0.2, 0.5, 1.0), sparks=16)
# The engine rests a little above the stand and turns once a loop; pulleys turn PULLEY_TURNS times, the block trembles.
LIFT, SCALE, PULLEY_TURNS, TREMBLE = 0.12, 1.12, 8, 36

scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj)


def material(name, color=(1, 1, 1), metallic=0.0, roughness=0.4, emission=None, strength=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Coat Weight'].default_value = coat
    bsdf.inputs['Coat Roughness'].default_value = 0.08
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def link(obj, parent=None):
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def smooth(obj, bevel=0.0, segments=4):
    for face in obj.data.polygons:
        face.use_smooth = True
    if bevel:
        modifier = obj.modifiers.new('bevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = segments
        modifier.limit_method = 'ANGLE'
    return obj


def box(name, size, location, mat, parent, bevel=0.02):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = link(bpy.data.objects.new(name, mesh), parent)
    obj.location = location
    return smooth(obj, bevel)


def cylinder(name, radius, depth, location, mat, parent, axis='z', vertices=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = {'x': (0, math.pi / 2, 0), 'y': (math.pi / 2, 0, 0), 'z': (0, 0, 0)}[axis]
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    if bevel:
        modifier = obj.modifiers.new('bevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = 'ANGLE'
    return obj


def pipe(name, points, radius, mat, parent):
    """A bent tube through the points: a smooth NURBS curve with a round bevel."""
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 6
    data.use_fill_caps = True
    spline = data.splines.new('NURBS')
    spline.points.add(len(points) - 1)
    for point, (x, y, z) in zip(spline.points, points):
        point.co = (x, y, z, 1)
    spline.order_u = 3
    spline.use_endpoint_u = True
    spline.resolution_u = 16
    data.materials.append(mat)
    return link(bpy.data.objects.new(name, data), parent)


def hull(points):
    """The convex hull of 2D points, counter-clockwise (monotone chain)."""
    points = sorted(set(points))
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for point in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    for point in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def mark(mat, width, location, parent, depth=0.014):
    """Our mark, raised on a surface facing up: the SVG curves extruded with rounded edges."""
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=os.path.join(BRAND, 'logo-mark-white.svg'))
    parts = [obj for obj in bpy.data.objects if obj not in before]
    for obj in bpy.data.objects:
        obj.select_set(obj in parts)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    logo = bpy.context.view_layer.objects.active
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    scale = width / logo.dimensions.x
    logo.scale = (scale, scale, scale)
    logo.data.extrude = depth / scale
    logo.data.bevel_depth = 0.006 / scale
    logo.data.bevel_resolution = 3
    logo.data.materials.clear()
    logo.data.materials.append(mat)
    logo.parent = parent
    logo.location = location
    return logo


# ---------------------------------------------------------------- materials
BLUE = (0.0, 0.155, 1.0)
block_mat = material('Block', (0.045, 0.05, 0.06), 0.3, 0.5)
white_mat = material('Badge', (0.72, 0.75, 0.8), 0.0, 0.3, coat=0.5)
alloy = material('Alloy', (0.62, 0.64, 0.68), 1.0, 0.32)
cover_mat = material('Cover', BLUE, 0.0, 0.32, coat=0.7)
chrome = material('Chrome', (0.8, 0.82, 0.86), 1.0, 0.16)
plastic = material('Plastic', (0.025, 0.026, 0.03), 0.0, 0.45, coat=0.2)
rubber = material('Belt', (0.02, 0.02, 0.022), 0.0, 0.6)
yellow = material('Dipstick', (1.0, 0.72, 0.02), 0.0, 0.35, coat=0.4)
filter_mat = material('Filter', BLUE, 0.2, 0.3, coat=0.5)

# ---------------------------------------------------------------- the engine: crank along X, pulleys at the front (-X)
spin_root = link(bpy.data.objects.new('Float', None))
spin = link(bpy.data.objects.new('Spin', None), spin_root)
spin.scale = (SCALE,) * 3
engine = link(bpy.data.objects.new('Engine', None), spin)

box('OilPan', (1.08, 0.56, 0.18), (0.02, 0, 0.09), block_mat, engine, 0.04)
box('Block', (1.2, 0.64, 0.5), (0, 0, 0.43), block_mat, engine, 0.03)
for side in (-1, 1):
    for index in range(5):
        box(f'Rib{side}{index}', (0.04, 0.03, 0.42), (-0.44 + index * 0.22, side * 0.33, 0.42), block_mat, engine, 0.012)
box('Head', (1.22, 0.68, 0.16), (0, 0, 0.76), alloy, engine, 0.025)
box('Cover', (1.14, 0.58, 0.17), (0, 0, 0.92), cover_mat, engine, 0.07)
box('CoverTop', (0.86, 0.38, 0.06), (0, 0, 1.02), cover_mat, engine, 0.03)
mark(white_mat, 0.5, (0.02, 0, 1.05), engine, depth=0.02)
cap = cylinder('OilCap', 0.07, 0.07, (0.46, 0.17, 1.03), plastic, engine, bevel=0.015)
for index in range(4):
    box(f'Coil{index}', (0.08, 0.08, 0.06), (-0.39 + index * 0.26, -0.24, 1.02), plastic, engine, 0.02)

# Exhaust: four chrome tubes from the head on the -Y side into one collector and down.
box('Flange', (1.02, 0.03, 0.12), (0, -0.355, 0.75), alloy, engine, 0.01)
for index, x in enumerate((-0.39, -0.13, 0.13, 0.39)):
    pipe(f'Header{index}', [(x, -0.35, 0.75), (x, -0.5, 0.74), (x * 0.65, -0.6, 0.56), (0.06, -0.62, 0.36), (0.08, -0.6, 0.2)], 0.048, chrome, engine)
cylinder('Collector', 0.075, 0.2, (0.08, -0.6, 0.16), chrome, engine)

# Intake: black runners from the head on the +Y side arching into the plenum, a throttle body at its front.
box('Plenum', (0.92, 0.22, 0.22), (0.02, 0.6, 0.64), plastic, engine, 0.07)
for index, x in enumerate((-0.39, -0.13, 0.13, 0.39)):
    pipe(f'Runner{index}', [(x, 0.34, 0.78), (x, 0.46, 0.92), (x, 0.6, 0.86), (x, 0.62, 0.72)], 0.05, plastic, engine)
cylinder('Throttle', 0.1, 0.14, (-0.5, 0.6, 0.64), alloy, engine, axis='x', bevel=0.012)
cylinder('Filter', 0.075, 0.18, (0.32, 0.4, 0.3), filter_mat, engine, axis='y', bevel=0.02)
cylinder('DipRod', 0.012, 0.42, (0.2, -0.36, 0.8), alloy, engine)
bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.014, location=(0, 0, 0))
ring = bpy.context.active_object
ring.parent, ring.location, ring.rotation_euler = engine, (0.2, -0.36, 1.04), (math.pi / 2, 0, 0)
ring.data.materials.append(yellow)
smooth(ring)

# The back: a flywheel housing.
cylinder('Flywheel', 0.36, 0.06, (0.63, 0, 0.42), block_mat, engine, axis='x', vertices=64, bevel=0.015)

# The front: a timing cover, three pulleys and a belt around them; the pulleys run while the engine idles.
box('Timing', (0.06, 0.58, 0.72), (-0.62, 0, 0.5), plastic, engine, 0.03)
PULLEYS = [((0.0, 0.26), 0.15), ((0.1, 0.62), 0.1), ((-0.2, 0.86), 0.08), ((0.24, 0.9), 0.07)]
pulleys = []
for index, ((y, z), radius) in enumerate(PULLEYS):
    hub = link(bpy.data.objects.new(f'PulleyHub{index}', None), engine)
    hub.location = (-0.69, y, z)
    wheel = cylinder(f'Pulley{index}', radius, 0.07, (0, 0, 0), alloy, hub, axis='x', vertices=64, bevel=0.01)
    for bolt in range(3):
        angle = bolt * math.tau / 3
        cylinder(f'Bolt{index}{bolt}', radius * 0.16, 0.08, (-0.006, radius * 0.5 * math.cos(angle), radius * 0.5 * math.sin(angle)), block_mat, hub, axis='x', vertices=12)
    pulleys.append(hub)
cylinder('Alternator', 0.13, 0.24, (-0.5, 0.24, 0.9), alloy, engine, axis='x', vertices=32, bevel=0.015)
outline = hull([(y + (r + 0.012) * math.cos(a), z + (r + 0.012) * math.sin(a)) for (y, z), r in PULLEYS for a in (k * math.tau / 64 for k in range(64))])
belt_data = bpy.data.curves.new('Belt', 'CURVE')
belt_data.dimensions = '2D'
belt_data.extrude = 0.026
belt_data.bevel_depth = 0.008
spline = belt_data.splines.new('POLY')
spline.points.add(len(outline) - 1)
for point, (y, z) in zip(spline.points, outline):
    point.co = (y, z, 0, 1)
spline.use_cyclic_u = True
belt_data.materials.append(rubber)
belt = link(bpy.data.objects.new('Belt', belt_data), engine)
belt.location = (-0.69, 0, 0)
belt.rotation_euler = (math.pi / 2, 0, math.pi / 2)

# ---------------------------------------------------------------- the stand, as under the pass can, a bit wider
stand_mat = material('Stand', (0.02, 0.022, 0.03), 0.9, 0.22)
for radius, depth, z in ((1.12, 0.16, -0.08), (1.34, 0.1, -0.21)):
    stand = cylinder('Stand', radius, depth, (0, 0, z), stand_mat, None, vertices=96)
size = 256
ys_, xs_ = np.mgrid[0:size, 0:size]
reach = np.hypot((xs_ + 0.5) / size - 0.5, (ys_ + 0.5) / size - 0.5) * 2
pool = np.ones((size, size, 4), dtype=np.float32)
pool[..., 3] = np.clip(1 - reach, 0, 1) ** 2
pool_img = bpy.data.images.new('Pool', size, size, alpha=True)
pool_img.pixels.foreach_set(pool.ravel())
pool_mat = material('Pool', (0, 0, 0), emission=LOOK['ring'], strength=1.2)
pool_tex = pool_mat.node_tree.nodes.new('ShaderNodeTexImage')
pool_tex.image = pool_img
pool_mat.node_tree.links.new(pool_tex.outputs['Alpha'], pool_mat.node_tree.nodes['Principled BSDF'].inputs['Alpha'])
pool_mat.surface_render_method = 'BLENDED'
bpy.ops.mesh.primitive_plane_add(size=1.9, location=(0, 0, 0.002))
bpy.context.active_object.data.materials.append(pool_mat)
RING_POWER = 2.6
ring_mat = material('Ring', (0, 0, 0), emission=LOOK['ring'], strength=RING_POWER)
ring_light = ring_mat.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
bpy.ops.mesh.primitive_torus_add(major_radius=1.125, minor_radius=0.014, major_segments=128, minor_segments=8, location=(0, 0, 0.0))
bpy.context.active_object.data.materials.append(ring_mat)

rng = random.Random(7)
spark_mat = material('Spark', (0, 0, 0), emission=LOOK['ring'], strength=6.0)
white = material('SparkWhite', (0, 0, 0), emission=(1, 1, 1), strength=4.0)
sparks = []
for index in range(LOOK['sparks']):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=rng.uniform(0.012, 0.022))
    obj = bpy.context.active_object
    obj.data.materials.append(spark_mat if index % 3 else white)
    sparks.append(dict(obj=obj, angle=rng.uniform(0, math.tau), radius=rng.uniform(0.75, 1.25), phase=rng.random(),
                       turns=rng.choice((1, 1, 2)), sway=rng.uniform(0.02, 0.06)))

# ---------------------------------------------------------------- reflections: the pass's studio painted into the world
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
    obj.rotation_euler = (Vector((0, 0, 0.6)) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()


area('Key', (-2.2, -3.2, 3.0), 150, 1.8, (1, 0.98, 0.95))
area('Top', (0.4, -0.6, 3.4), 90, 2.4, (1, 1, 1))
area('RimL', (-2.6, 2.4, 2.2), 240, 1.2, LOOK['rim'])
area('RimR', (2.6, 2.4, 2.2), 240, 1.2, LOOK['rim'])

# ---------------------------------------------------------------- camera: the pass's framing, so the screen's layout fits
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
big_mark = bpy.data.images.load(os.path.join(OUT, 'pass-mark.png'))
mw, mh = big_mark.size
pixels = np.empty(mw * mh * 4, dtype=np.float32)
big_mark.pixels.foreach_get(pixels)
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
canvas = np.clip(canvas, 0, 1)
canvas += np.random.default_rng(2).normal(0, 0.006, canvas.shape[:2] + (1,)).astype(np.float32)
bg_pixels = np.ones((SIZE[1], SIZE[0], 4), dtype=np.float32)
bg_pixels[..., :3] = np.clip(canvas, 0, 1)
bg_img = bpy.data.images.new('EngineBg', SIZE[0], SIZE[1], alpha=True)
bg_img.pixels.foreach_set(np.flipud(bg_pixels).ravel())
bg_img.filepath_raw = os.path.join(OUT, 'engine-bg.png')
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
bg_node.image = bpy.data.images.load(os.path.join(OUT, 'engine-bg.png'))
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
    # Start three-quarters on: the blue cover, the exhaust and the pulleys all show in the first frame (the poster).
    spin.rotation_euler = (0, 0, -turn + math.radians(35))
    spin_root.location = (0.004 * math.sin(turn * TREMBLE * 1.3), 0.003 * math.cos(turn * TREMBLE), LIFT + 0.03 * math.sin(turn * 2) + 0.004 * math.sin(turn * TREMBLE))
    spin_root.rotation_euler = (math.radians(1.4) * math.sin(turn), math.radians(1.4) * math.cos(turn), 0)
    for hub in pulleys:
        hub.rotation_euler = (turn * PULLEY_TURNS, 0, 0)
    ring_light.default_value = RING_POWER * (0.82 + 0.18 * math.sin(turn * 2))
    for spark in sparks:
        life = (spark['phase'] + t * spark['turns']) % 1
        angle = spark['angle'] + turn
        radius = spark['radius'] + spark['sway'] * math.sin(life * math.tau)
        spark['obj'].location = (radius * math.cos(angle), radius * math.sin(angle), 0.05 + life * 2.1)
        spark['obj'].scale = (min(1, life * 8) * min(1, (1 - life) * 3),) * 3


if STILL:
    pose(0)
    scene.render.filepath = os.path.join(OUT, 'engine-still.png')
    bpy.ops.render.render(write_still=True)
    print('STILL', scene.render.filepath)
else:
    folder = os.path.join(OUT, 'frames-engine')
    os.makedirs(folder, exist_ok=True)
    for frame in range(FRAMES):
        pose(frame)
        scene.render.filepath = os.path.join(folder, f'{frame:04d}.png')
        bpy.ops.render.render(write_still=True)
    print('FRAMES', folder)
