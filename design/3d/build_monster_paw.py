"""The «Монстр» tag's paw: our own clawed beast paw (not the brand's logo) as a two-frame sprite — claws in, claws out.

Run: Blender -b --factory-startup --python build_monster_paw.py -- <out_dir> [--size 160]
Writes <out_dir>/paw-in.png and <out_dir>/paw-out.png on a transparent background; join them side by side into
apps/site/public/brand/tags/monster-paw.webp (the tag's ::before steps between the two halves with background-position).
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = ARGS[0]
SIZE = int(ARGS[ARGS.index('--size') + 1]) if '--size' in ARGS else 160

scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)


def srgb(hex_value):
    value = hex_value.lstrip('#')
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels) + (1.0,)


def material(name, colour, rough=0.4, metallic=0.0, coat=0.0, emission=None, strength=0.0, bump=0.0, bump_scale=60.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = srgb(colour)
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Coat Weight'].default_value = coat
    shader.inputs['Coat Roughness'].default_value = 0.1
    if emission:
        shader.inputs['Emission Color'].default_value = srgb(emission)
        shader.inputs['Emission Strength'].default_value = strength
    if bump:
        # Short fur: a stretched noise pressed into the surface.
        coords = nodes.new('ShaderNodeTexCoord')
        stretch = nodes.new('ShaderNodeMapping')
        stretch.inputs['Scale'].default_value = (1.0, 1.0, 4.0)
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = bump_scale
        noise.inputs['Detail'].default_value = 8
        relief = nodes.new('ShaderNodeBump')
        relief.inputs['Strength'].default_value = bump
        links.new(coords.outputs['Object'], stretch.inputs['Vector'])
        links.new(stretch.outputs['Vector'], noise.inputs['Vector'])
        links.new(noise.outputs['Fac'], relief.inputs['Height'])
        links.new(relief.outputs['Normal'], shader.inputs['Normal'])
    return mat


def ball(name, location, scale, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def claw_mesh(name, mat, rings=16, sides=24):
    mesh = bpy.data.meshes.new(name)
    verts, faces = [], []
    for ring in range(rings):
        t = ring / rings
        radius = 0.17 * (1 - t) ** 0.85
        for side in range(sides):
            angle = math.tau * side / sides
            verts.append((radius * math.cos(angle), radius * math.sin(angle) * 0.8, t))
    tip = len(verts)
    verts.append((0, 0, 1.0))
    for ring in range(rings - 1):
        for side in range(sides):
            a, b = ring * sides + side, ring * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    last = (rings - 1) * sides
    for side in range(sides):
        faces.append((last + side, last + (side + 1) % sides, tip))
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


fur = material('fur', '#141d14', rough=0.7, bump=1.0, bump_scale=70)
pad = material('pad', '#5bd62a', rough=0.28, coat=0.8, emission='#7dff36', strength=0.35)
claw_mat = material('claw', '#efeadb', rough=0.22, coat=0.6)

# The paw faces the camera (-Y): a furry back, a palm pad and four toes, each with a pad and a claw over it.
ball('palm', (0, 0.3, -0.2), (1.2, 0.6, 1.05), fur)
ball('palm-pad', (0, -0.22, -0.4), (0.78, 0.26, 0.58), pad)

TOES = [(-1.0, 0.72, -24), (-0.36, 1.08, -8), (0.36, 1.08, 8), (1.0, 0.72, 24)]
claws = []
for index, (x, z, tilt) in enumerate(TOES):
    angle = math.radians(tilt)
    ball(f'toe{index}', (x, 0.2, z), (0.42, 0.42, 0.5), fur, rotation=(0, angle, 0))
    ball(f'toe-pad{index}', (x * 0.98, -0.16, z - 0.06), (0.25, 0.14, 0.3), pad, rotation=(0, angle, 0))
    # A claw: a hooked cone with rings along its length (a plain cone has none and would not bend), base at its
    # origin so scaling grows it out of the toe, curved away from the middle of the paw.
    claw = claw_mesh(f'claw{index}', claw_mat)
    bend = claw.modifiers.new('bend', 'SIMPLE_DEFORM')
    bend.deform_method = 'BEND'
    bend.deform_axis = 'Y'
    bend.angle = math.radians(-55 if x > 0 else 55)
    claw.location = (x + math.sin(angle) * 0.42, 0.02, z + math.cos(angle) * 0.42)
    claw.rotation_euler = (0, angle, 0)
    claws.append(claw)

# ------------------------------------------------------------------ light, camera
world = bpy.data.worlds.new('world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#0b120b')
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.4
scene.world = world


def area(name, energy, location, size, colour):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.size, data.color = energy, size, srgb(colour)[:3]
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (Vector((0, 0, 0.4)) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()


area('key', 260, (-2.5, -4.0, 3.0), 3.0, '#ffffff')
area('rim-l', 420, (-3.2, 2.5, 1.5), 1.5, '#7dff36')
area('rim-r', 420, (3.2, 2.5, 1.5), 1.5, '#7dff36')
area('under', 60, (0, -3.0, -2.5), 2.0, '#9dff6a')

camera_data = bpy.data.cameras.new('camera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 3.7
camera = bpy.data.objects.new('camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, -8, 1.4)
camera.rotation_euler = (Vector((0, 0, 0.5)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = camera

scene.render.engine = 'CYCLES'
preferences = bpy.context.preferences.addons['cycles'].preferences
preferences.compute_device_type = 'METAL'
preferences.get_devices()
for device in preferences.devices:
    device.use = True
scene.cycles.device = 'GPU'
scene.cycles.samples = 192
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'

# Claws in: short tips just over the toes. Claws out: long, a little spread.
for name, length, spread in (('in', 0.26, -4.0), ('out', 1.0, 6.0)):
    for index, claw in enumerate(claws):
        tilt = TOES[index][2]
        claw.scale = (1.0, 1.0, length)
        claw.rotation_euler = (0, math.radians(tilt + (spread if tilt > 0 else -spread)), 0)
    scene.render.filepath = os.path.join(OUT, f'paw-{name}.png')
    bpy.ops.render.render(write_still=True)
    print('written', scene.render.filepath)
