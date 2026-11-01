"""The price-tag hunt: a shop on a round street corner, five stages from a stall to a flagship.

Run: Blender -b --factory-startup --python build_hunt_store.py -- <out_dir> --stage 1..5 [--still|--cutout] [--frames N]
Reads pass-mark.png from <out_dir> (build_pass_textures.mjs writes it) and the logotype font from apps/site/fonts.
Writes hunt-<stage>-still.png, with --cutout hunt-<stage>-cutout.png (the shop alone, on nothing), and without either the
frames of one seamless sway to frames-hunt-<stage>/.
Only our own name stands on the shops: no brand of anybody else, no real chain.
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
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT = os.path.join(ROOT, 'apps', 'site', 'fonts', 'PPObjectSans-Heavy.otf')

# The same walls as the season pass: the screen's colour is the colour of the frame's edge (`--pass-wall`).
LOOKS = {
    1: dict(wall=(0.039, 0.055, 0.086), glow=(0.15, 0.22, 0.33), neon=(1.0, 0.72, 0.35), rim=(0.55, 0.72, 1.0)),
    2: dict(wall=(0.0, 0.043, 0.157), glow=(0.0, 0.27, 0.75), neon=(0.1, 0.45, 1.0), rim=(0.2, 0.5, 1.0)),
    3: dict(wall=(0.024, 0.016, 0.137), glow=(0.0, 0.42, 0.62), neon=(0.08, 0.85, 1.0), rim=(0.15, 0.9, 1.0)),
    4: dict(wall=(0.067, 0.039, 0.016), glow=(0.5, 0.29, 0.06), neon=(1.0, 0.62, 0.14), rim=(1.0, 0.7, 0.3)),
    5: dict(wall=(0.09, 0.016, 0.16), glow=(0.5, 0.1, 0.75), neon=(0.95, 0.3, 1.0), rim=(1.0, 0.4, 0.95)),
}
LOOK = LOOKS[STAGE]
random.seed(STAGE)

scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj)


def material(name, color=(1, 1, 1), metallic=0.0, roughness=0.5, emission=None, strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
    return mat


asphalt = material('Asphalt', (0.05, 0.055, 0.07), roughness=0.9)
pavement = material('Pavement', (0.13, 0.14, 0.18), roughness=0.8)
kerb = material('Kerb', (0.27, 0.29, 0.34), roughness=0.7)
wall_paint = material('Wall', {1: (0.58, 0.6, 0.64), 2: (0.84, 0.86, 0.9), 3: (0.09, 0.11, 0.17), 4: (0.13, 0.11, 0.09), 5: (0.05, 0.03, 0.1)}[STAGE], roughness=0.55)
trim = material('Trim', (0.0, 0.26, 1.0), roughness=0.35) if STAGE < 4 else material('Trim', (0.95, 0.66, 0.2), metallic=1.0, roughness=0.28)
steel = material('Steel', (0.72, 0.75, 0.8), metallic=1.0, roughness=0.3)
dark = material('Dark', (0.03, 0.035, 0.05), roughness=0.5)
white = material('White', (0.94, 0.95, 0.97), roughness=0.5)
brand = material('Brand', (0.0, 0.26, 1.0), roughness=0.4)
wood = material('Wood', (0.38, 0.23, 0.12), roughness=0.75)
leaf = material('Leaf', (0.06, 0.32, 0.14), roughness=0.75)
glow_inside = material('Inside', (1, 0.96, 0.85), emission=(1, 0.93, 0.78), strength=1.5)
room = material('Room', (0.9, 0.84, 0.72), roughness=0.6, emission=(1, 0.9, 0.72), strength=0.42)
neon = material('Neon', LOOK['neon'], emission=LOOK['neon'], strength=4.2)
tag_gold = material('TagGold', (1.0, 0.72, 0.2), metallic=1.0, roughness=0.26, emission=(1.0, 0.6, 0.12), strength=0.5)
can_colours = [material(f'Can{i}', colour, metallic=0.65, roughness=0.3) for i, colour in enumerate([(0.0, 0.26, 1.0), (0.95, 0.15, 0.2), (0.1, 0.8, 0.5), (1.0, 0.72, 0.15), (0.75, 0.2, 0.9)])]
neon_strength = neon.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
inside_strength = glow_inside.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']

# Everything on the corner hangs on this: the sway is a turn of one empty.
spin = bpy.data.objects.new('Spin', None)
scene.collection.objects.link(spin)


def attach(obj, parent=spin):
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def box(name, size, loc, mat, bevel=0.012, parent=spin, rot=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = attach(bpy.data.objects.new(name, mesh), parent)
    obj.location = loc
    obj.rotation_euler = rot
    if bevel:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width, mod.segments = bevel, 2
    return obj


def cylinder(name, radius, depth, loc, mat, top=None, segments=48, parent=spin):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius if top is None else top, depth=depth)
    for face in bm.faces:
        face.smooth = abs(face.normal.z) < 0.5
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = attach(bpy.data.objects.new(name, mesh), parent)
    obj.location = loc
    return obj


def can(x, y, z, colour=None, scale=1.0, parent=spin):
    mat = colour or random.choice(can_colours)
    cylinder('Can', 0.062 * scale, 0.19 * scale, (x, y, z + 0.095 * scale), mat, segments=16, parent=parent)
    cylinder('CanTop', 0.058 * scale, 0.012 * scale, (x, y, z + 0.196 * scale), steel, segments=16, parent=parent)


def text(body, size, loc, mat, parent=spin, extrude=0.02):
    curve = bpy.data.curves.new('Sign', 'FONT')
    curve.body = body
    curve.font = bpy.data.fonts.load(FONT)
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    obj = attach(bpy.data.objects.new('Sign', curve), parent)
    obj.data.materials.append(mat)
    obj.location = loc
    obj.rotation_euler = (math.pi / 2, 0, 0)
    return obj


def awning(center, width, depth, drop=0.32, stripes=8, colours=(brand, white)):
    """Striped canvas over the front, tilted down to the street, with a scalloped edge."""
    x0, y, z = center
    step = width / stripes
    for index in range(stripes):
        x = x0 - width / 2 + step * (index + 0.5)
        mat = colours[index % 2]
        box('Awning', (step * 0.99, depth, 0.03), (x, y - depth / 2 * 0.92, z - drop / 2), mat, bevel=0, rot=(math.atan2(drop, depth), 0, 0))
        cylinder('Scallop', step / 2, 0.03, (x, y - depth * 0.93, z - drop), mat, segments=16).rotation_euler = (math.pi / 2, 0, 0)


def fridge(center, width, height, rows, cols):
    """A lit glass case with rows of cans."""
    x0, y, z = center
    box('FridgeBack', (width, 0.03, height), (x0, y + 0.16, z + height / 2), dark, bevel=0)
    box('FridgeLight', (width * 0.92, 0.02, height * 0.92), (x0, y + 0.14, z + height / 2), glow_inside, bevel=0)
    for side in (-1, 1):
        box('FridgeSide', (0.035, 0.34, height), (x0 + side * width / 2, y, z + height / 2), dark, bevel=0)
    for level in (0, height):
        box('FridgeEdge', (width + 0.035, 0.34, 0.035), (x0, y, z + level), dark, bevel=0)
    for row in range(rows):
        shelf_z = z + 0.07 + row * (height - 0.08) / rows
        box('Shelf', (width * 0.9, 0.26, 0.012), (x0, y - 0.02, shelf_z), steel, bevel=0)
        for col in range(cols):
            can(x0 - width * 0.42 + (col + 0.5) * width * 0.84 / cols, y - 0.06, shelf_z + 0.006, scale=min(1.0, (height / rows - 0.03) / 0.21))


def storefront(width, height, front, depth=0.42, frame=None, floor=0.16):
    """A shop window standing out of the wall: a lit room behind glass, so the fridges in it can be seen."""
    frame = frame or trim
    box('Room', (width, 0.03, height), (0, front - 0.02, floor + height / 2), room, bevel=0)
    box('RoomFloor', (width, depth, 0.04), (0, front - depth / 2, floor + 0.02), dark, bevel=0)
    box('RoomTop', (width + 0.12, depth + 0.04, 0.1), (0, front - depth / 2, floor + height + 0.05), frame)
    for side in (-1, 1):
        box('RoomSide', (0.08, depth, height), (side * (width / 2 + 0.02), front - depth / 2, floor + height / 2), frame, bevel=0.008)
    # EEVEE keeps a thin pane opaque here, so the glass is only its frame: the shelves are what has to be seen.
    for index in range(1, 4):
        box('RoomBar', (0.025, 0.025, height), (-width / 2 + width * index / 4, front - depth, floor + height / 2), frame, bevel=0)


def price_tag(name, scale, mat, parent=spin):
    """A flat tag with the cut corners and the hole of a shop's price label: the currency of the hunt."""
    points = [(-0.62, -0.32), (0.34, -0.32), (0.62, 0), (0.34, 0.32), (-0.62, 0.32)]
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x * scale, 0, z * scale)) for x, z in points]
    face = bm.faces.new(verts)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, 0.05 * scale, 0), verts=[v for v in extruded['geom'] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = attach(bpy.data.objects.new(name, mesh), parent)
    hole = cylinder('TagHole', 0.075 * scale, 0.07 * scale, (0.38 * scale, 0.025 * scale, 0), dark, segments=20, parent=obj)
    hole.rotation_euler = (math.pi / 2, 0, 0)
    return obj


def tree(x, y, height=0.9):
    cylinder('Trunk', 0.035, height * 0.6, (x, y, 0.22 + height * 0.3), wood, segments=10)
    for offset, radius in ((0.5, 0.26), (0.72, 0.2), (0.92, 0.13)):
        cylinder('Crown', radius, height * 0.42, (x, y, 0.22 + height * offset), leaf, top=0.02, segments=14)


def lamp(x, y, height=1.25):
    cylinder('Post', 0.02, height, (x, y, 0.22 + height / 2), dark, segments=10)
    box('Lamp', (0.2, 0.05, 0.05), (x, y - 0.06, 0.22 + height), dark, bevel=0.01)
    cylinder('LampBulb', 0.035, 0.03, (x, y - 0.12, 0.2 + height), glow_inside, segments=12)


def planter(x, y):
    box('Planter', (0.3, 0.16, 0.14), (x, y, 0.29), dark, bevel=0.015)
    cylinder('Bush', 0.13, 0.3, (x, y, 0.5), leaf, top=0.02, segments=12)


def cart(x, y):
    box('CartBasket', (0.22, 0.32, 0.14), (x, y, 0.42), steel, bevel=0.01)
    box('CartLeg', (0.02, 0.02, 0.18), (x - 0.09, y - 0.12, 0.29), steel, bevel=0)
    box('CartLeg', (0.02, 0.02, 0.18), (x + 0.09, y + 0.12, 0.29), steel, bevel=0)
    can(x, y, 0.42, scale=0.9)


def bulbs(x0, x1, y, z, count):
    for index in range(count):
        t = index / (count - 1)
        cylinder('Bulb', 0.018, 0.03, (x0 + (x1 - x0) * t, y, z - 0.045 * math.sin(t * math.pi)), glow_inside, segments=8)


# ---------------------------------------------------------------- the street corner, wider as the shop grows
RADIUS = {1: 1.72, 2: 1.8, 3: 2.12, 4: 2.4, 5: 2.4}[STAGE]
cylinder('Road', RADIUS + 0.28, 0.14, (0, 0, 0.0), asphalt, segments=96)
cylinder('Kerb', RADIUS + 0.06, 0.2, (0, 0, 0.03), kerb, segments=96)
cylinder('Pavement', RADIUS, 0.2, (0, 0, 0.05), pavement, segments=96)
ring = cylinder('NeonRing', RADIUS + 0.3, 0.025, (0, 0, -0.08), neon, segments=96)

# ---------------------------------------------------------------- the shop
FRONT = -0.55
if STAGE == 1:
    box('Stall', (1.5, 0.95, 1.12), (0, 0.15, 0.73), wall_paint)
    box('Roof', (1.62, 1.08, 0.06), (0, 0.15, 1.32), dark)
    box('Hatch', (1.16, 0.03, 0.56), (0, -0.335, 0.9), dark, bevel=0)
    box('HatchLight', (1.1, 0.02, 0.5), (0, -0.325, 0.9), glow_inside, bevel=0)
    box('Counter', (1.26, 0.26, 0.05), (0, -0.44, 0.64), wood)
    for index in range(7):
        can(-0.48 + index * 0.16, -0.44, 0.665)
    awning((0, -0.33, 1.3), 1.5, 0.55, drop=0.2, stripes=7)
    bulbs(-0.74, 0.74, -0.88, 1.03, 9)
    box('Crate', (0.34, 0.26, 0.2), (1.14, -0.25, 0.3), wood, bevel=0.015)
    for index in range(3):
        can(1.04 + index * 0.1, -0.25, 0.4)
    box('Board', (0.42, 0.03, 0.5), (-1.12, -0.42, 0.45), dark, rot=(0.14, 0, 0.2))
    tag = price_tag('BoardTag', 0.3, tag_gold)
    tag.location, tag.rotation_euler = (-1.12, -0.47, 0.52), (0.14, 0, 0.2)
elif STAGE == 2:
    box('Kiosk', (2.1, 1.1, 1.36), (0, 0.2, 0.83), wall_paint)
    box('Base', (2.14, 1.14, 0.2), (0, 0.2, 0.25), brand)
    box('Roof', (2.26, 1.26, 0.07), (0, 0.2, 1.55), dark)
    box('Hatch', (0.9, 0.02, 0.62), (-0.42, -0.36, 1.0), glow_inside, bevel=0)
    box('Counter', (1.0, 0.26, 0.05), (-0.42, -0.47, 0.68), wood)
    for index in range(6):
        can(-0.78 + index * 0.14, -0.47, 0.705)
    fridge((0.64, -0.5, 0.35), 0.66, 0.92, 3, 4)
    awning((-0.42, -0.35, 1.5), 1.1, 0.5, drop=0.2, stripes=6)
    box('SignBox', (1.5, 0.1, 0.32), (0, -0.26, 1.78), dark)
    text('CANRUSH', 0.22, (0, -0.33, 1.78), neon)
    planter(-1.3, -0.65)
    bulbs(-1.0, 1.0, -0.42, 1.5, 11)
elif STAGE == 3:
    box('Shop', (2.7, 1.5, 1.42), (0, 0.35, 0.86), wall_paint)
    box('Parapet', (2.8, 1.6, 0.1), (0, 0.35, 1.62), dark)
    storefront(2.4, 0.98, -0.4)
    for side in (-0.82, 0.82):
        fridge((side, -0.62, 0.2), 0.62, 0.86, 3, 4)
    box('Door', (0.5, 0.03, 0.9), (0, -0.46, 0.65), dark, bevel=0.01)
    box('DoorGlass', (0.42, 0.015, 0.78), (0, -0.48, 0.66), glow_inside, bevel=0)
    box('NeonStrip', (2.56, 0.03, 0.03), (0, -0.86, 1.3), neon, bevel=0)
    box('SignBox', (2.0, 0.1, 0.3), (0, -0.46, 1.44), dark)
    text('CANRUSH', 0.24, (0, -0.53, 1.44), neon)
    box('Conditioner', (0.46, 0.34, 0.24), (0.8, 0.5, 1.8), steel)
    box('Vent', (0.26, 0.26, 0.16), (-0.7, 0.6, 1.75), dark)
    planter(-1.05, -1.05)
    planter(1.05, -1.05)
    lamp(1.66, -0.62)
elif STAGE == 4:
    box('Market', (3.2, 1.9, 1.62), (0, 0.42, 0.98), wall_paint)
    box('Parapet', (3.32, 2.02, 0.1), (0, 0.42, 1.84), trim)
    storefront(2.96, 1.08, -0.53, depth=0.46)
    for side in (-1.1, -0.46, 0.46, 1.1):
        fridge((side, -0.76, 0.2), 0.54, 0.96, 3, 3)
    box('Canopy', (1.3, 0.56, 0.06), (0, -1.26, 1.34), trim)
    for side in (-0.58, 0.58):
        cylinder('Column', 0.03, 1.12, (side, -1.5, 0.76), trim, segments=12)
    box('NeonStrip', (3.04, 0.03, 0.03), (0, -1.01, 1.4), neon, bevel=0)
    box('SignBox', (2.4, 0.12, 0.34), (0, -0.56, 1.58), dark)
    text('CANRUSH', 0.28, (0, -0.64, 1.58), neon)
    roof = price_tag('RoofTag', 1.0, tag_gold)
    roof.location = (0, 0.3, 2.42)
    for side in (-0.6, 0.6):
        box('RoofLeg', (0.04, 0.04, 0.34), (side * 0.62, 0.32, 1.98), dark, bevel=0)
    cart(1.3, -1.38)
    cart(-1.26, -1.42)
    tree(-1.96, -0.42)
    tree(1.98, -0.38)
else:
    box('Podium', (3.1, 2.0, 1.32), (0, 0.42, 0.83), wall_paint)
    box('Tower', (2.3, 1.5, 2.1), (0, 0.62, 2.54), wall_paint)
    storefront(2.9, 0.96, -0.58, depth=0.46)
    for side in (-1.08, -0.44, 0.44, 1.08):
        fridge((side, -0.82, 0.2), 0.54, 0.84, 3, 3)
    box('Podium trim', (3.18, 2.08, 0.05), (0, 0.42, 1.5), trim, bevel=0)
    # The screen: a slowly drifting holographic gradient, the same foil as the legendary can.
    screen_mat = bpy.data.materials.new('Screen')
    screen_mat.use_nodes = True
    nodes = screen_mat.node_tree.nodes
    bsdf = nodes['Principled BSDF']
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.27, 0.05, 1.0, 1)
    ramp.color_ramp.elements[1].color = (0.33, 0.9, 1.0, 1)
    mid = ramp.color_ramp.elements.new(0.45)
    mid.color = (1.0, 0.18, 0.62, 1)
    high = ramp.color_ramp.elements.new(0.72)
    high.color = (1.0, 0.72, 0.25, 1)
    coord = nodes.new('ShaderNodeTexCoord')
    shift = nodes.new('ShaderNodeMapping')
    screen_mat.node_tree.links.new(coord.outputs['Generated'], shift.inputs['Vector'])
    separate = nodes.new('ShaderNodeSeparateXYZ')
    screen_mat.node_tree.links.new(shift.outputs['Vector'], separate.inputs['Vector'])
    fract = nodes.new('ShaderNodeMath')
    fract.operation = 'PINGPONG'
    fract.inputs[1].default_value = 1.0
    screen_mat.node_tree.links.new(separate.outputs['X'], fract.inputs[0])
    screen_mat.node_tree.links.new(fract.outputs[0], ramp.inputs['Fac'])
    screen_mat.node_tree.links.new(ramp.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = 1.05
    bsdf.inputs['Base Color'].default_value = (0, 0, 0, 1)
    box('Screen', (1.96, 0.03, 1.24), (0, -0.14, 2.62), screen_mat, bevel=0)
    box('Screen back', (2.06, 0.03, 1.34), (0, -0.12, 2.62), dark, bevel=0)
    text('CANRUSH', 0.36, (0, -0.2, 2.78), white, extrude=0.03)
    label = price_tag('ScreenTag', 0.42, tag_gold)
    label.location = (0, -0.22, 2.3)
    box('Crown', (2.42, 1.62, 0.08), (0, 0.62, 3.62), trim)
    box('NeonStrip', (3.0, 0.03, 0.03), (0, -1.06, 1.26), neon, bevel=0)
    for side in (-1.15, 1.15):
        box('Edge', (0.03, 0.03, 2.1), (side, -0.13, 2.54), neon, bevel=0)
    tree(-1.98, -0.34)
    tree(2.0, -0.3)
    cart(1.3, -1.42)
    cart(-1.3, -1.46)

# ---------------------------------------------------------------- tags circling the shop from the third stage on
orbit = []
for index in range({1: 0, 2: 0, 3: 5, 4: 8, 5: 12}[STAGE]):
    tag = price_tag(f'Orbit{index}', 0.24, tag_gold)
    orbit.append(dict(obj=tag, angle=index / {3: 5, 4: 8, 5: 12}[STAGE] * math.tau, height=1.7 + (index % 3) * 0.5 + (0.9 if STAGE == 5 else 0), radius=RADIUS + 0.1 + (index % 2) * 0.16))

# ---------------------------------------------------------------- light
width, height = 512, 256
elevation = np.linspace(np.pi / 2, -np.pi / 2, height)[:, None] * np.ones((height, width))
azimuth = np.linspace(-np.pi, np.pi, width, endpoint=False)[None, :] * np.ones((height, width))
sky = np.zeros((height, width, 4), dtype=np.float32)
sky[..., 3] = 1
sky[..., :3] = np.array([0.03, 0.035, 0.05]) + np.clip(elevation / 2, 0, 1)[..., None] * np.array([0.2, 0.22, 0.28])
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
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 0.8)) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()


area('Key', (-3.4, -5.0, 5.5), 360, 3.4, (1, 0.97, 0.92))
area('Fill', (4.2, -4.0, 3.2), 120, 3.0, (0.8, 0.88, 1.0))
area('RimL', (-4.4, 3.8, 3.8), 520, 2.4, LOOK['rim'])
area('RimR', (4.4, 3.8, 3.8), 520, 2.4, LOOK['rim'])

# ---------------------------------------------------------------- camera: the same framing as the can, the shop above the middle
cam = bpy.data.cameras.new('Camera')
cam.lens = 72
cam.sensor_fit = 'VERTICAL'
cam.sensor_height = 36
cam_obj = bpy.data.objects.new('Camera', cam)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj
FIT = {1: 10.4, 2: 10.8, 3: 12.2, 4: 14.0, 5: 15.8}[STAGE]
LOOK_AT = {1: -0.08, 2: -0.02, 3: 0.04, 4: 0.16, 5: 0.74}[STAGE]
cam_obj.location = (0, -FIT, FIT * 0.44 + LOOK_AT)
cam_obj.rotation_euler = (Vector((0, 0, LOOK_AT)) - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

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
canvas = np.clip(canvas, 0, 1)
canvas += np.random.default_rng(STAGE).normal(0, 0.006, canvas.shape[:2] + (1,)).astype(np.float32)
bg_pixels = np.ones((SIZE[1], SIZE[0], 4), dtype=np.float32)
bg_pixels[..., :3] = np.clip(canvas, 0, 1)
bg_img = bpy.data.images.new(f'HuntBg{STAGE}', SIZE[0], SIZE[1], alpha=True)
bg_img.pixels.foreach_set(np.flipud(bg_pixels).ravel())
bg_img.filepath_raw = os.path.join(OUT, f'hunt-bg-{STAGE}.png')
bg_img.file_format = 'PNG'
bg_img.save()

# ---------------------------------------------------------------- render and compositing
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = SIZE
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.eevee.taa_render_samples = 32
scene.eevee.use_raytracing = True
tree_nodes = bpy.data.node_groups.new('SceneComp', 'CompositorNodeTree')
tree_nodes.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
layers = tree_nodes.nodes.new('CompositorNodeRLayers')
bg_node = tree_nodes.nodes.new('CompositorNodeImage')
bg_node.image = bpy.data.images.load(os.path.join(OUT, f'hunt-bg-{STAGE}.png'))
over = tree_nodes.nodes.new('CompositorNodeAlphaOver')
glare = tree_nodes.nodes.new('CompositorNodeGlare')
result = tree_nodes.nodes.new('NodeGroupOutput')
for key, value in (('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 1.0), ('Strength', 0.45), ('Size', 0.6)):
    if key in glare.inputs:
        glare.inputs[key].default_value = value
tree_nodes.links.new(layers.outputs['Image'], glare.inputs['Image'])
inputs = [socket for socket in over.inputs if socket.type == 'RGBA']
tree_nodes.links.new(bg_node.outputs['Image'], inputs[0])
tree_nodes.links.new(glare.outputs['Image'], inputs[1])
tree_nodes.links.new(over.outputs['Image'], result.inputs['Image'])
scene.compositing_node_group = tree_nodes
scene.render.use_compositing = True
scene.render.image_settings.file_format = 'PNG'


def pose(frame):
    """A sway, not a full turn: the front always looks at the visitor, and the last frame runs into the first."""
    t = frame / FRAMES
    turn = t * math.tau
    spin.rotation_euler = (0, 0, math.radians(20) * math.sin(turn) - math.radians(10))
    neon_strength.default_value = 4.2 * (0.82 + 0.18 * math.sin(turn * 4))
    inside_strength.default_value = 1.5 * (0.92 + 0.08 * math.sin(turn * 3 + 1))
    if STAGE == 5:
        shift.inputs['Location'].default_value[0] = t * 2
    for item in orbit:
        angle = item['angle'] + turn
        item['obj'].location = (item['radius'] * math.cos(angle), item['radius'] * math.sin(angle) * 0.86, item['height'] + 0.09 * math.sin(angle * 3))
        item['obj'].rotation_euler = (0.1, 0.25 * math.sin(angle * 2), 0.5 * math.sin(angle))


if CUTOUT:
    ring.hide_render = True
    for item in orbit:
        item['obj'].hide_render = True
        for child in item['obj'].children:
            child.hide_render = True
    pose(0)
    scene.render.use_compositing = False
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = os.path.join(OUT, f'hunt-{STAGE}-cutout.png')
    bpy.ops.render.render(write_still=True)
elif STILL:
    pose(0)
    scene.render.filepath = os.path.join(OUT, f'hunt-{STAGE}-still.png')
    bpy.ops.render.render(write_still=True)
    print('STILL', scene.render.filepath)
else:
    folder = os.path.join(OUT, f'frames-hunt-{STAGE}')
    os.makedirs(folder, exist_ok=True)
    for frame in range(FRAMES):
        pose(frame)
        scene.render.filepath = os.path.join(folder, f'{frame:04d}.png')
        bpy.ops.render.render(write_still=True)
