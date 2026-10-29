"""CanRush vending machine («Банкомат»), low-poly for a mobile game.

Run: Blender -b --python build_vending.py -- <out_dir>
Writes vending-machine.blend, vending-machine.glb, textures and preview renders into <out_dir>.
Z up, the machine faces -Y. Units: metres (the machine is 1.2 x 0.8 x 1.66, plus the sign).
"""
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else os.getcwd()
os.makedirs(OUT, exist_ok=True)
RENDER = '--no-render' not in sys.argv

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
root = bpy.data.collections.new('VendingMachine')
scene.collection.children.link(root)


def srgb(hex_color, alpha=1.0):
    hex_color = hex_color.lstrip('#')
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return (*lin, alpha)


# ---------------------------------------------------------------- materials
def material(name, color, rough=0.4, metal=0.0, emit=None, strength=0.0, image=None, alpha=None, image_emits=False,
             coat=0.0, emission_image=None):
    """Principled material. `coat` — a lacquer layer (glossy body, black frame), `emission_image` — a glow mask
    (the can's bolt): both survive the glTF export (KHR_materials_clearcoat, emissive texture)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = srgb(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = 0.06
    if image is not None:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = image
        tex.interpolation = 'Linear'
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if image_emits:
            links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = strength
    if emission_image is not None:
        glow = nodes.new('ShaderNodeTexImage')
        glow.image = emission_image
        links.new(glow.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = strength
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = srgb(emit)
        bsdf.inputs['Emission Strength'].default_value = strength
    if alpha is not None:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.surface_render_method = 'BLENDED'
        bsdf.inputs['Transmission Weight'].default_value = 0.0
    return mat


# ---------------------------------------------------------------- textures (painted with numpy, packed into the file)
def canvas(w, h, color):
    img = np.zeros((h, w, 4), dtype=np.float32)
    img[...] = [*(int(color.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)), 1.0]
    return img


def grid(img):
    h, w = img.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    return xs + 0.5, ys + 0.5


def paint(img, mask, color, alpha=1.0):
    c = np.array([int(color.lstrip('#')[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)
    a = (mask.astype(np.float32) * alpha)[..., None]
    img[..., :3] = img[..., :3] * (1 - a) + c * a


def ellipse(img, cx, cy, rx, ry, angle=0.0):
    x, y = grid(img)
    x, y = x - cx, y - cy
    ca, sa = math.cos(angle), math.sin(angle)
    u, v = x * ca + y * sa, -x * sa + y * ca
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1


def polygon(img, points):
    x, y = grid(img)
    inside = np.zeros(x.shape, dtype=bool)
    n = len(points)
    for i in range(n):
        x0, y0 = points[i]
        x1, y1 = points[(i + 1) % n]
        cond = (y0 > y) != (y1 > y)
        xint = (x1 - x0) * (y - y0) / ((y1 - y0) if y1 != y0 else 1e-9) + x0
        inside ^= cond & (x < xint)
    return inside


def stroke(img, points, width):
    x, y = grid(img)
    mask = np.zeros(x.shape, dtype=bool)
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = np.clip(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0, 1)
        mask |= (x - (x0 + t * dx)) ** 2 + (y - (y0 + t * dy)) ** 2 <= (width / 2) ** 2
    return mask


# A lightning bolt in unit space (x right, y up), the brand's shape.
BOLT = [(0.35, 1.0), (0.95, 1.0), (0.6, 0.58), (0.9, 0.58), (0.15, -0.25), (0.38, 0.32), (0.08, 0.32)]


def bolt_points(cx, cy, size, angle=0.0, flip_y=True):
    out = []
    for x, y in BOLT:
        x, y = (x - 0.5) * size, (y - 0.38) * size
        ca, sa = math.cos(angle), math.sin(angle)
        x, y = x * ca - y * sa, x * sa + y * ca
        out.append((cx + x, cy - y if flip_y else cy + y))
    return out


def to_image(name, img):
    h, w = img.shape[:2]
    image = bpy.data.images.new(name, w, h, alpha=True)
    # numpy rows go top-down, Blender pixels go bottom-up.
    image.pixels.foreach_set(np.flipud(img).ravel())
    image.filepath_raw = os.path.join(OUT, f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


BODY_BLUE = '#1240f5'

# Can label: glossy black can with silver rims and a cyan bolt on both sides (u wraps around the cylinder); the
# glow map lights only the bolt, so it shines like the reference while the can stays black.
can_img = canvas(256, 256, '#06080f')
can_glow = canvas(256, 256, '#000000')
for u in (64, 192):
    paint(can_img, polygon(can_img, bolt_points(u, 128, 92, 0.12)), '#1aa9e8')
    paint(can_glow, polygon(can_glow, bolt_points(u, 128, 92, 0.12)), '#1fb8ff')
    paint(can_glow, polygon(can_glow, bolt_points(u, 128, 48, 0.12)), '#7fe3ff')
for v in (14, 242):
    paint(can_img, stroke(can_img, [(0, v), (256, v)], 14), '#c9d4e6')
can_tex = to_image('tex_can', can_img)
can_glow_tex = to_image('tex_can_glow', can_glow)

# Screen of the control panel: a tilted can with a bolt.
screen_img = canvas(128, 192, '#53d8ff')
paint(screen_img, polygon(screen_img, [(40, 40), (92, 30), (98, 150), (46, 160)]), '#1438b8')
paint(screen_img, polygon(screen_img, bolt_points(70, 96, 52, 0.15)), '#7fe6ff')
paint(screen_img, stroke(screen_img, [(43, 52), (92, 42)], 5), '#0d2680')
screen_tex = to_image('tex_screen', screen_img)

def owl_texture(img, ox, oy):
    """The mascot as on the reference: a round blue owl with ear tufts and a light outline, a white face mask, one eye
    open and one winking, an open beak, a white belly with a black bolt, black wings and feet, «!!» above."""
    ink, white, blue, rim = '#05070d', '#ffffff', '#2160ff', '#62bdff'
    def body(grow):
        return (ellipse(img, ox, oy, 172 + grow, 186 + grow) | ellipse(img, ox - 118, oy - 150, 52 + grow, 52 + grow)
                | ellipse(img, ox + 118, oy - 150, 52 + grow, 52 + grow))
    paint(img, stroke(img, [(ox - 168, oy - 262), (ox - 140, oy - 205)], 20), '#7fe0ff')
    paint(img, stroke(img, [(ox - 118, oy - 288), (ox - 102, oy - 226)], 20), '#7fe0ff')
    # Wings behind the body: the left one raised, the right one low; feather tips along the edge.
    paint(img, ellipse(img, ox - 172, oy - 55, 46, 100, 0.55), ink)
    for dx, dy in ((-215, -120), (-232, -78), (-238, -34)):
        paint(img, ellipse(img, ox + dx, oy + dy, 20, 34, 0.9), ink)
    paint(img, ellipse(img, ox + 168, oy + 78, 44, 96, -0.7), ink)
    for dx, dy in ((212, 132), (226, 92), (232, 50)):
        paint(img, ellipse(img, ox + dx, oy + dy, 18, 32, -0.9), ink)
    paint(img, body(14), rim)
    shape = body(0)
    paint(img, shape, blue)
    paint(img, ellipse(img, ox, oy + 98, 128, 98) & shape, white)                   # belly
    paint(img, polygon(img, bolt_points(ox, oy + 104, 96, 0.18)), ink)
    paint(img, ellipse(img, ox - 64, oy - 52, 72, 72) | ellipse(img, ox + 64, oy - 52, 72, 72), white)  # face mask
    paint(img, ellipse(img, ox - 58, oy - 56, 30, 36), ink)                          # open eye
    paint(img, ellipse(img, ox - 47, oy - 70, 10, 10), white)
    paint(img, stroke(img, [(ox + 32, oy - 44), (ox + 50, oy - 64), (ox + 78, oy - 66), (ox + 98, oy - 46)], 14), ink)  # wink
    paint(img, stroke(img, [(ox + 96, oy - 46), (ox + 110, oy - 40)], 8), ink)
    paint(img, polygon(img, [(ox - 20, oy - 10), (ox + 20, oy - 10), (ox, oy + 12)]), ink)  # beak
    paint(img, ellipse(img, ox, oy + 30, 24, 20), ink)                               # open mouth and tongue
    paint(img, ellipse(img, ox, oy + 37, 14, 10), '#3d8dff')
    for fx in (ox - 46, ox + 46):                                                    # feet
        paint(img, stroke(img, [(fx, oy + 180), (fx, oy + 214)], 11), ink)
        paint(img, stroke(img, [(fx - 18, oy + 226), (fx, oy + 210), (fx + 18, oy + 226)], 10), ink)


# Side panel: the body blue, big lighter bolts, the owl mascot (left side only). u: back -> front, v: bottom -> top.
def side_texture(name, owl):
    w, h = 512, 1024
    img = canvas(w, h, BODY_BLUE)
    # Big diagonal bolts in two lighter blues, overlapping like the reference's side.
    for cx, cy, size, ang, color, a in ((130, 150, 360, -0.45, '#2a7bff', 0.95), (400, 330, 300, -0.45, '#1f63ff', 0.9),
                                        (90, 560, 300, -0.45, '#2a7bff', 0.9), (360, 820, 360, -0.45, '#2a7bff', 0.95),
                                        (110, 960, 260, -0.45, '#1f63ff', 0.9)):
        paint(img, polygon(img, bolt_points(cx, cy, size, ang)), color, a)
    if owl:
        owl_texture(img, 290, 560)
    return to_image(name, img)


side_left_tex = side_texture('tex_side_left', owl=True)
side_right_tex = side_texture('tex_side_right', owl=False)

M = {
    # Lacquered blue body and glossy black front, like a toy: low roughness plus a clear coat.
    'body': material('Body', BODY_BLUE, rough=0.3, metal=0.05, coat=1.0),
    'frame': material('Frame', '#020306', rough=0.42, metal=0.0, coat=0.35),
    # The niche glows deep blue from inside; its top strip is the brightest light of the machine.
    'inner': material('Inner', '#050f33', rough=0.5, emit='#0a3cff', strength=1.2),
    'neon': material('Neon', '#5fe4ff', rough=0.3, emit='#2fd2ff', strength=6.0),
    'neon_white': material('NeonWhite', '#d6f7ff', rough=0.3, emit='#c6f4ff', strength=12.0),
    'neon_soft': material('NeonSoft', '#5fd3ff', rough=0.3, emit='#2fbfff', strength=2.5),
    'glass': material('Glass', '#9fd6ff', rough=0.02, alpha=0.05),
    'shelf': material('Shelf', '#0d1222', rough=0.25, metal=0.6),
    'tag': material('PriceTag', '#cfefff', rough=0.4, emit='#a6e6ff', strength=2.0),
    'can': material('CanLabel', '#06080f', rough=0.18, metal=0.85, image=can_tex, emission_image=can_glow_tex, strength=3.0),
    'lid': material('CanLid', '#d7e0ee', rough=0.18, metal=0.95),
    'screen': material('Screen', '#53d8ff', rough=0.3, image=screen_tex, strength=2.5, image_emits=True),
    'side_l': material('SideLeft', BODY_BLUE, rough=0.3, metal=0.05, image=side_left_tex, coat=1.0),
    'side_r': material('SideRight', BODY_BLUE, rough=0.3, metal=0.05, image=side_right_tex, coat=1.0),
    'slot': material('Slot', '#02040a', rough=0.8),
    'key': material('Key', '#0b1322', rough=0.3, metal=0.2, coat=0.5),
    'sign_back': material('SignBack', '#020306', rough=0.42, metal=0.0, coat=0.35),
}


# ---------------------------------------------------------------- mesh helpers
def link(obj):
    root.objects.link(obj)
    return obj


def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0, segments=1, open_front=False, no_front=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=segments, affect='EDGES', profile=0.5)
    if no_front:
        # A shell open at the front (the black frame closes it): the flat front face goes, the bevel stays.
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.y < -0.999], context='FACES_ONLY')
    if open_front:
        # A niche seen from the front: no front wall, the rest faces inward.
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.y < -0.9], context='FACES_ONLY')
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = bevel > 0 and segments > 1
    return link(bpy.data.objects.new(name, mesh))


def plane(name, x0, x1, z0, z1, y, mat, axis='Y', uv=True):
    """A quad facing -Y (axis 'Y'), or -X / +X ('-X', '+X') spanning (x0..x1) as y and (z0..z1)."""
    if axis == 'Y':
        verts = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    elif axis == '-X':  # left side: u runs from the back (+Y) to the front (-Y)
        verts = [(y, x1, z0), (y, x0, z0), (y, x0, z1), (y, x1, z1)]
    else:  # right side, seen from +X: u runs front (-Y) to back (+Y)
        verts = [(y, x0, z0), (y, x1, z0), (y, x1, z1), (y, x0, z1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    if uv:
        layer = mesh.uv_layers.new(name='UVMap')
        for loop, co in zip(layer.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            loop.uv = co
    mesh.materials.append(mat)
    return link(bpy.data.objects.new(name, mesh))


def bolt_mesh(name, size, depth, mat, scale_out=1.0):
    """The bolt in the XZ plane (centered), extruded along +Y by `depth`."""
    pts = [((x - 0.5) * size * scale_out, 0.0, (y - 0.38) * size * scale_out) for x, y in BOLT]
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in pts]
    face = bm.faces.new(verts)
    # The face must point -Y (towards the viewer).
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    if face.normal.y > 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bmesh.ops.triangulate(bm, faces=list(bm.faces), quad_method='BEAUTY', ngon_method='EAR_CLIP')
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    return link(bpy.data.objects.new(name, mesh))


# ---------------------------------------------------------------- body
W0, W1 = -0.60, 0.60     # x
D0, D1 = -0.40, 0.40     # y (front is D0)
H0, H1 = 0.06, 1.66      # z (feet below H0)
WIN = dict(x0=-0.48, x1=0.24, z0=0.56, z1=1.46)
FRONT = D0 - 0.03        # the black frame's face

box('Body', W0, W1, D0 + 0.02, D1, H0, H1, M['body'], bevel=0.07, segments=3, no_front=True)
for fx in (W0 + 0.08, W1 - 0.16):
    for fy in (D0 + 0.08, D1 - 0.14):
        box('Foot', fx, fx + 0.08, fy, fy + 0.06, 0.0, H0 + 0.01, M['frame'])

# Black front frame around the window, the control column and the dispenser.
fy0, fy1 = FRONT, D0 + 0.03
box('FrameLeft', -0.56, WIN['x0'], fy0, fy1, 0.10, 1.60, M['frame'], bevel=0.01)
box('FrameTop', -0.56, 0.58, fy0, fy1, WIN['z1'], 1.60, M['frame'], bevel=0.01)
box('FrameBottom', -0.56, 0.58, fy0, fy1, 0.10, WIN['z0'], M['frame'], bevel=0.01)
box('FrameRight', WIN['x1'], 0.58, fy0, fy1, WIN['z0'], WIN['z1'], M['frame'], bevel=0.01)

# The lit cabinet behind the glass (an open box) and the neon strips along its edges.
CAB_BACK = D0 + 0.36
box('Cabinet', WIN['x0'], WIN['x1'], fy1 - 0.005, CAB_BACK, WIN['z0'], WIN['z1'], M['inner'], open_front=True)
box('NeonTop', WIN['x0'] + 0.01, WIN['x1'] - 0.01, fy1 - 0.02, fy1, WIN['z1'] - 0.03, WIN['z1'] - 0.005, M['neon_white'])
box('NeonRight', WIN['x1'] - 0.025, WIN['x1'] - 0.005, fy1 - 0.02, fy1, WIN['z0'] + 0.01, WIN['z1'] - 0.01, M['neon'])
box('NeonLeft', WIN['x0'] + 0.005, WIN['x0'] + 0.02, fy1 - 0.02, fy1, WIN['z0'] + 0.01, WIN['z1'] - 0.01, M['neon_soft'])
plane('Glass', WIN['x0'], WIN['x1'], WIN['z0'], WIN['z1'], FRONT + 0.005, M['glass'], uv=False)

# ---------------------------------------------------------------- shelves and cans (one shared can mesh, 12 instances)
bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.052, depth=0.20, calc_uvs=True, location=(0, 0, 0))
can_proto = bpy.context.active_object
can_proto.name = 'CanProto'
me = can_proto.data
bm = bmesh.new()
bm.from_mesh(me)
top = [f for f in bm.faces if f.normal.z > 0.9][0]
# Lid: a slight inset with a rim — the top face is its own material.
bmesh.ops.inset_region(bm, faces=[top], thickness=0.008, depth=-0.006)
bm.to_mesh(me)
bm.free()
me.materials.append(M['can'])
me.materials.append(M['lid'])
for poly in me.polygons:
    is_cap = abs(poly.normal.z) > 0.5
    poly.material_index = 1 if is_cap else 0
    poly.use_smooth = not is_cap
for col in list(can_proto.users_collection):
    col.objects.unlink(can_proto)

xs = [WIN['x0'] + 0.09 + i * 0.18 for i in range(4)]
for row, z in enumerate((WIN['z0'] + 0.02, WIN['z0'] + 0.32, WIN['z0'] + 0.62)):
    box(f'Shelf{row}', WIN['x0'] + 0.01, WIN['x1'] - 0.01, fy1 - 0.03, CAB_BACK - 0.02, z - 0.02, z, M['shelf'])
    for col, x in enumerate(xs):
        can = bpy.data.objects.new(f'Can{row}{col}', me)
        can.location = (x, D0 + 0.17, z + 0.10)
        can.rotation_euler = (0, 0, math.radians(-78))
        link(can)
        box(f'Tag{row}{col}', x - 0.03, x + 0.03, fy1 - 0.035, fy1 - 0.03, z - 0.035, z - 0.01, M['tag'])

# ---------------------------------------------------------------- control panel
PF = FRONT - 0.005
box('ScreenBezel', 0.30, 0.54, PF, PF + 0.01, 1.10, 1.40, M['neon_soft'], bevel=0.008)
plane('Screen', 0.315, 0.525, 1.115, 1.385, PF - 0.001, M['screen'])
for i, (x, z) in enumerate(((0.40, 1.47), (0.45, 1.49))):
    bar = box(f'Hype{i}', -0.008, 0.008, PF - 0.005, PF + 0.005, -0.025, 0.025, M['neon'])
    bar.location = (x, 0, z)
    bar.rotation_euler = (0, math.radians(-20), 0)
for r in range(3):
    for c in range(3):
        x0 = 0.335 + c * 0.065
        z0 = 0.84 + r * 0.065
        box(f'Key{r}{c}', x0, x0 + 0.045, PF - 0.012, PF + 0.005, z0, z0 + 0.045, M['key'], bevel=0.005)
        plane(f'KeyLight{r}{c}', x0 + 0.014, x0 + 0.031, z0 + 0.012, z0 + 0.033, PF - 0.0125, M['neon'], uv=False)
box('CardReader', 0.32, 0.52, PF - 0.03, PF + 0.005, 0.62, 0.78, M['frame'], bevel=0.012)
box('CardReaderNeon', 0.33, 0.51, PF - 0.035, PF - 0.03, 0.63, 0.77, M['neon_soft'])
box('CardSlot', 0.35, 0.49, PF - 0.04, PF - 0.034, 0.68, 0.71, M['slot'])

# ---------------------------------------------------------------- dispenser tray
box('TrayNeon', -0.44, 0.16, PF - 0.006, PF + 0.004, 0.18, 0.44, M['neon'], bevel=0.02, segments=2)
box('TrayHole', -0.42, 0.14, PF - 0.012, PF, 0.20, 0.42, M['slot'], bevel=0.015, segments=2)
box('TrayFlap', -0.40, 0.12, PF - 0.03, PF - 0.012, 0.21, 0.26, M['shelf'])

# ---------------------------------------------------------------- bolts: the sign on top and the front decal
sign_back = bolt_mesh('SignBack', 0.50, 0.10, M['sign_back'], scale_out=1.14)
sign_back.location = (0.02, D0 + 0.10, 1.92)
sign = bolt_mesh('Sign', 0.50, 0.03, M['neon'])
sign.location = (0.02, D0 + 0.08, 1.92)
deco = bolt_mesh('FrontBolt', 0.24, 0.01, M['neon'])
deco.location = (0.44, PF - 0.012, 0.30)
deco.rotation_euler = (0, math.radians(-12), 0)

# ---------------------------------------------------------------- side panels (body-blue decals with the bolts and the owl)
plane('SideLeft', D0 + 0.08, D1 - 0.08, H0 + 0.10, H1 - 0.10, W0 - 0.001, M['side_l'], axis='-X')
plane('SideRight', D0 + 0.08, D1 - 0.08, H0 + 0.10, H1 - 0.10, W1 + 0.001, M['side_r'], axis='+X')

# ---------------------------------------------------------------- animations
# Two clips, each one Blender action with a slot per object, so glTF gets two animations: «Idle» (a 2 s loop) and
# «Dispense» (1.8 s, a can drops into the tray). Only transforms are animated — the neon pulse is the engine's job.
FPS = 30
scene.render.fps = FPS
rig = link(bpy.data.objects.new('Machine', None))          # the pivot on the floor: squash and shake from here
sign_pivot = link(bpy.data.objects.new('SignPivot', None))  # the bottom of the sign, where it sits on the roof
SIGN_REST = Vector((0.02, D0 + 0.09, H1))
sign_pivot.location = SIGN_REST
for obj in list(root.objects):
    if obj in (rig, sign_pivot):
        continue
    if obj.name in ('Sign', 'SignBack'):
        obj.location = obj.location - SIGN_REST
        obj.parent = sign_pivot
    else:
        obj.parent = rig
sign_pivot.parent = rig

shelf_can = bpy.data.objects['Can02']                      # bottom row, the one above the tray
SHELF_REST = shelf_can.location.copy()
SHELF_ROT = shelf_can.rotation_euler.copy()
drop_can = link(bpy.data.objects.new('DropCan', me))        # the can that lands in the tray (same mesh as the shelf)
drop_can.parent = rig
TRAY_IN = Vector((-0.14, PF + 0.02, 0.30))                  # behind the tray face: hidden
TRAY_OUT = Vector((-0.14, PF - 0.07, 0.30))                 # lying in the tray, in front of it
LYING = (0.0, math.radians(90), math.radians(-12))


def keys(clip, obj, frame, loc=None, rot=None, scale=None):
    data = obj.animation_data or obj.animation_data_create()
    if data.action is not clip:
        data.action = clip
    for value, path in ((loc, 'location'), (rot, 'rotation_euler'), (scale, 'scale')):
        if value is not None:
            setattr(obj, path, value)
            obj.keyframe_insert(data_path=path, frame=frame)


def rest(clip, frame):
    """Every animated object at rest, so either clip starts and ends from the same pose."""
    keys(clip, rig, frame, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1))
    keys(clip, sign_pivot, frame, loc=SIGN_REST, rot=(0, 0, 0), scale=(1, 1, 1))
    keys(clip, shelf_can, frame, loc=SHELF_REST, rot=SHELF_ROT, scale=(1, 1, 1))
    keys(clip, drop_can, frame, loc=TRAY_IN, rot=LYING, scale=(0, 0, 0))


idle = bpy.data.actions.new('Idle')
rest(idle, 0)
keys(idle, rig, 30, scale=(0.994, 0.994, 1.012))           # a slow breath from the floor
keys(idle, sign_pivot, 15, loc=SIGN_REST + Vector((0, 0, 0.025)), rot=(0, math.radians(4), 0))
keys(idle, sign_pivot, 30, loc=SIGN_REST, rot=(0, 0, 0))
keys(idle, sign_pivot, 45, loc=SIGN_REST + Vector((0, 0, 0.025)), rot=(0, math.radians(-4), 0))
rest(idle, 60)

dispense = bpy.data.actions.new('Dispense')
rest(dispense, 0)
keys(dispense, rig, 5, scale=(1.02, 1.02, 0.965))           # anticipation: crouch...
keys(dispense, rig, 9, scale=(0.99, 0.99, 1.03))            # ...and spring up
keys(dispense, rig, 12, rot=(0, 0, 0), scale=(1, 1, 1))
for frame, angle in ((14, 2.2), (16, -2.0), (18, 1.4), (20, -0.8), (22, 0.0)):  # the shake that drops the can
    keys(dispense, rig, frame, rot=(0, 0, math.radians(angle)))
keys(dispense, shelf_can, 10, loc=SHELF_REST, rot=SHELF_ROT, scale=(1, 1, 1))
keys(dispense, shelf_can, 15, loc=SHELF_REST + Vector((0, -0.07, 0.015)), rot=(math.radians(-14), 0, SHELF_ROT.z))
keys(dispense, shelf_can, 19, loc=SHELF_REST + Vector((0, -0.09, -0.10)), rot=(math.radians(-38), 0, SHELF_ROT.z))
keys(dispense, shelf_can, 23, loc=SHELF_REST + Vector((0, -0.09, -0.32)), rot=(math.radians(-70), 0, SHELF_ROT.z), scale=(1, 1, 1))
keys(dispense, shelf_can, 24, scale=(0, 0, 0))              # behind the lower panel: gone
keys(dispense, shelf_can, 42, loc=SHELF_REST, rot=SHELF_ROT, scale=(0, 0, 0))
keys(dispense, shelf_can, 48, scale=(1.12, 1.12, 1.12))     # restocked with a pop
keys(dispense, shelf_can, 52, scale=(1, 1, 1))
keys(dispense, drop_can, 24, loc=TRAY_IN, rot=LYING, scale=(0, 0, 0))
keys(dispense, drop_can, 26, scale=(1, 1, 1))
keys(dispense, drop_can, 30, loc=TRAY_OUT + Vector((0, 0, 0.04)), rot=(math.radians(20), math.radians(90), math.radians(-12)))
keys(dispense, drop_can, 34, loc=TRAY_OUT, rot=LYING)
keys(dispense, drop_can, 37, loc=TRAY_OUT + Vector((0, 0, 0.012)))
keys(dispense, drop_can, 40, loc=TRAY_OUT)
keys(dispense, drop_can, 54, loc=TRAY_OUT, rot=LYING, scale=(1, 1, 1))  # stays until the game takes it
keys(dispense, sign_pivot, 22, loc=SIGN_REST, scale=(1, 1, 1))
keys(dispense, sign_pivot, 27, loc=SIGN_REST + Vector((0, 0, 0.07)), scale=(1.22, 1.22, 1.22))  # the sign cheers
keys(dispense, sign_pivot, 33, loc=SIGN_REST, scale=(0.95, 0.95, 0.95))
keys(dispense, sign_pivot, 37, scale=(1, 1, 1))
keys(dispense, rig, 54, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1))
keys(dispense, sign_pivot, 54, loc=SIGN_REST, rot=(0, 0, 0), scale=(1, 1, 1))
keys(dispense, shelf_can, 54, loc=SHELF_REST, rot=SHELF_ROT, scale=(1, 1, 1))

# Each clip becomes an NLA track of the same name on every animated object (the glTF exporter turns tracks into
# named animations). Dispense is muted so the file plays the idle loop; the exporter still writes muted tracks.
for clip in (idle, dispense):
    clip.use_fake_user = True
for obj in (rig, sign_pivot, shelf_can, drop_can):
    data = obj.animation_data
    data.action = None
    for clip in (idle, dispense):
        track = data.nla_tracks.new()
        track.name = clip.name
        strip = track.strips.new(clip.name, 0, clip)
        strip.action_slot = next(slot for slot in clip.slots if slot.identifier == 'OB' + obj.name)
        track.mute = clip is dispense
scene.frame_start, scene.frame_end = 0, 60
scene.frame_set(0)

# ---------------------------------------------------------------- stats
depsgraph = bpy.context.evaluated_depsgraph_get()
tris = 0
for obj in root.objects:
    if obj.type == 'MESH':
        ev = obj.evaluated_get(depsgraph)
        tris += sum(len(p.vertices) - 2 for p in ev.data.polygons)
print(f'STATS objects={len(root.objects)} tris={tris}')

# ---------------------------------------------------------------- export
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'vending-machine.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'vending-machine.glb'), export_format='GLB', use_selection=False,
                          export_apply=True, export_yup=True, export_image_format='AUTO',
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_range=False,
                          export_force_sampling=True, export_optimize_animation_size=False,
                          export_optimize_animation_keep_anim_object=True)
print('EXPORTED', os.path.join(OUT, 'vending-machine.glb'))

# ---------------------------------------------------------------- preview (not saved in the .blend/.glb above)
if RENDER:
    # White studio like the reference: a bright white world, a big soft key, blue spill from both sides (the machine's
    # own glow), a shadow-catcher floor and bloom on the neon. Cycles on the GPU when there is one.
    world = bpy.data.worlds.new('Studio')
    world.use_nodes = True
    wn, wl = world.node_tree.nodes, world.node_tree.links
    # The camera sees pure white; everything else gets a dim grey world, so the lights shape the machine.
    path, mix, seen, lit = wn.new('ShaderNodeLightPath'), wn.new('ShaderNodeMixShader'), wn['Background'], wn.new('ShaderNodeBackground')
    seen.inputs['Color'].default_value = (1, 1, 1, 1)
    lit.inputs['Color'].default_value = (1, 1, 1, 1)
    lit.inputs['Strength'].default_value = 0.22
    wl.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    wl.new(lit.outputs['Background'], mix.inputs[1])
    wl.new(seen.outputs['Background'], mix.inputs[2])
    wl.new(mix.outputs['Shader'], wn['World Output'].inputs['Surface'])
    scene.world = world
    lights = (
        ('Key', (-2.6, -3.4, 3.4), 230, 1.4, (1, 1, 1)),
        ('Top', (0.3, -1.0, 4.2), 100, 2.0, (1, 1, 1)),
        ('BlueLeft', (-2.2, 1.4, 1.4), 110, 1.2, (0.12, 0.38, 1.0)),
        ('BlueRight', (2.4, 0.8, 1.0), 80, 1.2, (0.12, 0.5, 1.0)),
        ('Rim', (0.8, 3.2, 3.0), 220, 3.0, (0.85, 0.92, 1.0)),
    )
    for name, loc, energy, size, color in lights:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy = energy
        light.size = size
        light.color = color
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = (Vector((0, 0, 0.9)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.collection.objects.link(obj)
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = 'ShadowFloor'
    floor.is_shadow_catcher = True
    cam = bpy.data.cameras.new('Camera')
    cam.lens = 72
    cam_obj = bpy.data.objects.new('Camera', cam)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    scene.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for device in prefs.devices:
            device.use = True
        scene.cycles.device = 'GPU'
    except Exception as error:  # no GPU backend: the CPU still renders, just slower
        print('CYCLES CPU', error)
    scene.cycles.samples = 160
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    try:
        tree = bpy.data.node_groups.new('Bloom', 'CompositorNodeTree')
        tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        layers = tree.nodes.new('CompositorNodeRLayers')
        glare = tree.nodes.new('CompositorNodeGlare')
        out = tree.nodes.new('NodeGroupOutput')
        for key, value in (('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 2.5), ('Strength', 0.55), ('Size', 0.5)):
            if key in glare.inputs:
                glare.inputs[key].default_value = value
        tree.links.new(layers.outputs['Image'], glare.inputs['Image'])
        tree.links.new(glare.outputs['Image'], out.inputs['Image'])
        scene.compositing_node_group = tree
        scene.render.use_compositing = True
    except Exception as error:
        print('BLOOM SKIPPED', error)
    for label, loc in () if '--anim-only' in sys.argv else (('front34', (-3.0, -4.8, 2.3)), ('front', (0.0, -6.2, 1.15)), ('right34', (3.5, -4.5, 2.1))):
        cam_obj.location = loc
        cam_obj.rotation_euler = (Vector((0, 0, 1.12)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(OUT, f'preview-{label}.png')
        bpy.ops.render.render(write_still=True)
        print('RENDERED', scene.render.filepath)

    # Animation previews (--anim): Eevee frames of each clip, glued into an mp4 by ffmpeg. The shadow-catcher floor is a
    # Cycles feature, so Eevee renders without it.
    if '--anim' in sys.argv or '--anim-only' in sys.argv:
        import subprocess
        scene.render.engine = 'BLENDER_EEVEE'
        floor.hide_render = True
        scene.render.resolution_x, scene.render.resolution_y = 640, 720
        cam_obj.location = (-3.0, -4.8, 2.3)
        cam_obj.rotation_euler = (Vector((0, 0, 1.05)) - Vector(cam_obj.location)).to_track_quat('-Z', 'Y').to_euler()
        for clip, last, loops in (('Idle', 60, 2), ('Dispense', 54, 1)):
            for obj in (rig, sign_pivot, shelf_can, drop_can):
                for track in obj.animation_data.nla_tracks:
                    track.mute = track.name != clip
            frames = os.path.join(OUT, 'frames', clip)
            os.makedirs(frames, exist_ok=True)
            scene.frame_start, scene.frame_end = 0, last - 1 if loops > 1 else last
            scene.render.image_settings.file_format = 'PNG'
            scene.render.filepath = os.path.join(frames, '')
            bpy.ops.render.render(animation=True)
            video = os.path.join(OUT, f'anim-{clip.lower()}.mp4')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', str(loops - 1), '-framerate', str(FPS),
                            '-start_number', '0', '-i', os.path.join(frames, '%04d.png'), '-pix_fmt', 'yuv420p',
                            '-vcodec', 'libx264', '-crf', '20', video], check=True)
            print('VIDEO', video)
