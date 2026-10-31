"""The vending machine on a painted night background: lighting, a soft shadow, bloom, the background composited in.

Run: Blender -b vending-machine.blend --python render_scene.py -- <out_dir> [--scene night|halloween] [--still-only]
Reads <scene>-bg.png from <out_dir>, writes <scene>-still.png and, without --still-only, <scene>-idle.mp4 and
<scene>-dispense.mp4. A background must be 1000×972: the machine stands where its path is in both.
"""
import math
import os
import subprocess
import sys

import bpy
from mathutils import Quaternion, Vector

OUT = sys.argv[sys.argv.index('--') + 1]
STILL_ONLY = '--still-only' in sys.argv
NAME = sys.argv[sys.argv.index('--scene') + 1] if '--scene' in sys.argv else 'night'
BG = os.path.join(OUT, f'{NAME}-bg.png')
scene = bpy.context.scene

# Lights follow the background: name, location, energy, size, colour.
LIGHTS = {
    # A cold moon behind on the right (a rim on the machine), warm pumpkins low on the left, a violet fill.
    'halloween': (
        ('Moon', (3.2, 3.0, 4.2), 900, 1.2, (0.62, 0.78, 1.0)),
        ('Front', (-1.6, -4.0, 2.6), 160, 2.5, (0.45, 0.4, 1.0)),
        ('Pumpkins', (-2.6, -1.6, 0.4), 220, 0.8, (1.0, 0.45, 0.08)),
        ('VioletLeft', (-2.6, 1.2, 1.8), 220, 1.5, (0.55, 0.25, 1.0)),
    ),
    # The big moon high on the right, the cabin's warm windows low on the right, the violet sky on the left.
    'night': (
        ('Moon', (3.2, 3.0, 4.2), 1100, 1.2, (0.55, 0.85, 1.0)),
        ('Front', (-1.6, -4.0, 2.6), 160, 2.5, (0.42, 0.42, 1.0)),
        ('Cabin', (2.6, -2.2, 0.5), 120, 0.8, (1.0, 0.55, 0.15)),
        ('VioletLeft', (-2.6, 1.2, 1.8), 240, 1.5, (0.45, 0.25, 1.0)),
    ),
}[NAME]

# ---------------------------------------------------------------- night lighting
# The background's light, and a dim violet world for the rest. The machine's own neon stays the brightest thing in the frame.
world = bpy.data.worlds.new('Night')
world.use_nodes = True
background = world.node_tree.nodes['Background']
background.inputs['Color'].default_value = (0.09, 0.05, 0.32, 1)
background.inputs['Strength'].default_value = 0.6
scene.world = world
for name, loc, energy, size, color in LIGHTS:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.size, light.color = energy, size, color
    obj = bpy.data.objects.new(name, light)
    obj.location = loc
    obj.rotation_euler = (Vector((0, 0, 0.9)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(obj)

# A soft blob shadow on the ground (Eevee has no shadow catcher): black with a radial falloff in alpha.
bpy.ops.mesh.primitive_plane_add(size=1, location=(0.0, 0.05, 0.002))
blob = bpy.context.active_object
blob.name = 'BlobShadow'
blob.scale = (2.0, 1.6, 1)
import numpy as np
size = 256
ys, xs = np.mgrid[0:size, 0:size]
r = np.hypot((xs + 0.5) / size - 0.5, (ys + 0.5) / size - 0.5) * 2
pixels = np.zeros((size, size, 4), dtype=np.float32)
pixels[..., 3] = np.clip(1 - r, 0, 1) ** 1.6 * 0.85
blob_img = bpy.data.images.new('BlobShadow', size, size, alpha=True)
blob_img.pixels.foreach_set(pixels.ravel())
shadow = bpy.data.materials.new('BlobShadow')
shadow.use_nodes = True
sn, sl = shadow.node_tree.nodes, shadow.node_tree.links
bsdf = sn['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0, 0, 0, 1)
bsdf.inputs['Roughness'].default_value = 1.0
bsdf.inputs['Specular IOR Level'].default_value = 0.0
tex = sn.new('ShaderNodeTexImage')
tex.image = blob_img
sl.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
shadow.surface_render_method = 'BLENDED'
blob.data.materials.append(shadow)

# ---------------------------------------------------------------- camera: the machine stands on the path, lower middle
cam = bpy.data.cameras.new('Camera')
cam.lens = 56
cam.shift_y = 0.12
cam_obj = bpy.data.objects.new('Camera', cam)
scene.collection.objects.link(cam_obj)
scene.camera = cam_obj
cam_obj.location = (-3.7, -5.7, 1.5)
cam_obj.rotation_euler = (Vector((0.1, 0, 1.15)) - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

# ---------------------------------------------------------------- render and compositing
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 1000, 972
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
tree = bpy.data.node_groups.new('SceneComp', 'CompositorNodeTree')
tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
layers = tree.nodes.new('CompositorNodeRLayers')
bg_node = tree.nodes.new('CompositorNodeImage')
bg_node.image = bpy.data.images.load(BG)
over = tree.nodes.new('CompositorNodeAlphaOver')
glare = tree.nodes.new('CompositorNodeGlare')
out = tree.nodes.new('NodeGroupOutput')
for key, value in (('Type', 'Bloom'), ('Quality', 'High'), ('Threshold', 1.6), ('Strength', 0.7), ('Size', 0.55)):
    if key in glare.inputs:
        glare.inputs[key].default_value = value
# Bloom only on the machine's light, then the machine over the background.
tree.links.new(layers.outputs['Image'], glare.inputs['Image'])
inputs = [s for s in over.inputs if s.type == 'RGBA']
tree.links.new(bg_node.outputs['Image'], inputs[0])
tree.links.new(glare.outputs['Image'], inputs[1])
tree.links.new(over.outputs['Image'], out.inputs['Image'])
scene.compositing_node_group = tree
scene.render.use_compositing = True
scene.render.image_settings.file_format = 'PNG'

animated = [bpy.data.objects[name] for name in ('Machine', 'SignPivot', 'Can02', 'DropCan')]


def play(clip):
    for obj in animated:
        for track in obj.animation_data.nla_tracks:
            track.mute = track.name != clip


play('Idle')
scene.frame_set(0)
scene.render.filepath = os.path.join(OUT, f'{NAME}-still.png')
bpy.ops.render.render(write_still=True)
print('STILL', scene.render.filepath)

# ---------------------------------------------------------------- the dispense burst (video only, not in the game model)
# Like the streak fire's flash on the site: when the can lands in the tray a flash lights the scene, two shock rings
# run out, rays stab around, ~30 sparks fly out in a fan and fall under gravity, the machine's neon flares, the
# camera shakes — then small stars keep twinkling around the tray. Deterministic (seeded), so renders repeat.
LAND = 27                                   # the frame the can appears in the tray (Dispense: 26–34)
BURST_END = 84                              # the clip holds its last pose, the afterglow keeps going


def emissive(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Strength'].default_value = strength
    return mat


def key(obj, frame, **values):
    for path, value in values.items():
        setattr(obj, path, value)
        obj.keyframe_insert(data_path=path, frame=frame)


def mesh_object(name, verts, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def add_dispense_vfx():
    import random
    rng = random.Random(7)
    origin = Vector((-0.14, -0.53, 0.32))
    facing = (cam_obj.location - origin).to_track_quat('Z', 'Y')   # rings and rays face the camera
    hidden = (0, 0, 0)
    cyan, white, orange, blue = (0.15, 0.85, 1.0), (1.0, 1.0, 1.0), (1.0, 0.45, 0.05), (0.2, 0.45, 1.0)
    mats = {'cyan': emissive('VfxCyan', cyan, 7), 'white': emissive('VfxWhite', white, 6),
            'orange': emissive('VfxOrange', orange, 8), 'blue': emissive('VfxBlue', blue, 6)}

    # The flash: a light that floods the machine and the ground for a moment.
    flash = bpy.data.lights.new('BurstFlash', 'POINT')
    flash.color = (0.55, 0.9, 1.0)
    flash.shadow_soft_size = 0.3
    flash_obj = bpy.data.objects.new('BurstFlash', flash)
    flash_obj.location = origin + Vector((0, -0.25, 0.1))
    scene.collection.objects.link(flash_obj)
    for frame, energy in ((LAND - 1, 0), (LAND + 1, 320), (LAND + 4, 160), (LAND + 14, 25), (LAND + 24, 0)):
        flash.energy = energy
        flash.keyframe_insert('energy', frame=frame)

    # Shock rings: flat annuli that run out and thin away; the second one later and slower.
    seg = 40
    ring_verts = [(math.cos(a) * r, math.sin(a) * r, 0) for r in (0.975, 1.0) for a in (2 * math.pi * i / seg for i in range(seg))]
    ring_faces = [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
    for index, (delay, size, life, mat) in enumerate(((0, 0.9, 9, 'white'), (3, 1.35, 13, 'cyan'))):
        ring = mesh_object(f'BurstRing{index}', ring_verts, ring_faces, mats[mat])
        ring.location = origin
        ring.rotation_mode = 'QUATERNION'
        ring.rotation_quaternion = facing
        key(ring, LAND + delay - 1, scale=hidden)
        key(ring, LAND + delay, scale=(0.08, 0.08, 1))
        key(ring, LAND + delay + life * 0.6, scale=(size * 0.85, size * 0.85, 1))
        key(ring, LAND + delay + life, scale=(size, size, 1))
        key(ring, LAND + delay + life + 1, scale=hidden)

    # Rays: thin spikes around the burst, a quick stab and a slow turn.
    rays = bpy.data.objects.new('BurstRays', None)
    rays.location = origin
    rays.rotation_mode = 'QUATERNION'
    rays.rotation_quaternion = facing
    scene.collection.objects.link(rays)
    for i in range(12):
        angle = 2 * math.pi * i / 12 + rng.uniform(-0.12, 0.12)
        length = rng.uniform(0.55, 1.0)
        ray = mesh_object(f'BurstRay{i}', [(-0.018, 0.12, 0), (0.018, 0.12, 0), (0, 0.12 + length, 0)], [(0, 1, 2)],
                          mats['white' if i % 3 == 0 else 'cyan'])
        ray.parent = rays
        ray.rotation_euler = (0, 0, angle)
        key(ray, LAND - 1, scale=hidden)
        key(ray, LAND + 1, scale=(1, 0.2, 1))
        key(ray, LAND + 4, scale=(1.2, 1, 1))
        key(ray, LAND + 12, scale=(0.4, 1.15, 1))
        key(ray, LAND + 15, scale=hidden)
    rays.keyframe_insert('rotation_quaternion', frame=LAND)
    rays.rotation_quaternion = facing @ Quaternion((0, 0, 1), 0.5)   # a slow half-radian turn while they fade
    rays.keyframe_insert('rotation_quaternion', frame=LAND + 15)

    # Sparks: stretched along their flight, a fan towards the camera and up, falling with gravity, shrinking out.
    spark_verts = [(0, 0, -1), (0.35, 0, 0), (0, 0.35, 0), (-0.35, 0, 0), (0, -0.35, 0), (0, 0, 1)]
    spark_faces = [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)]
    gravity = Vector((0, 0, -5.5))
    fps = scene.render.fps
    for i in range(44):
        color = rng.choices(('cyan', 'white', 'blue', 'orange'), weights=(5, 3, 2, 2))[0]
        spark = mesh_object(f'Spark{i}', spark_verts, spark_faces, mats[color])
        spark.rotation_mode = 'QUATERNION'
        side = rng.uniform(-1, 1)
        direction = Vector((side * 1.3, -rng.uniform(0.6, 1.4), rng.uniform(0.4, 1.6))).normalized()
        velocity = direction * rng.uniform(1.6, 3.4)
        start = LAND + rng.randint(0, 3)
        life = rng.randint(14, 26)
        size = rng.uniform(0.022, 0.042)
        key(spark, start - 1, scale=hidden, location=origin)
        for step in range(0, life + 1, 2):
            t = step / fps
            pos = origin + velocity * t + gravity * (0.5 * t * t)
            vel = velocity + gravity * t
            fade = (1 - step / life) ** 0.7
            stretch = min(5.0, 1.0 + vel.length * 1.2)
            spark.location = pos
            spark.rotation_quaternion = vel.to_track_quat('Z', 'Y')
            spark.scale = (size * fade, size * fade, size * fade * stretch)
            for path in ('location', 'rotation_quaternion', 'scale'):
                spark.keyframe_insert(path, frame=start + step)
        key(spark, start + life + 1, scale=hidden)

    # Afterglow: small four-point stars popping in and out around the tray until the end.
    star_verts = [(0, 1, 0), (0.22, 0.22, 0), (1, 0, 0), (0.22, -0.22, 0), (0, -1, 0), (-0.22, -0.22, 0), (-1, 0, 0), (-0.22, 0.22, 0)]
    for i in range(14):
        star = mesh_object(f'Twinkle{i}', star_verts, [tuple(range(8))], mats['white' if i % 2 else 'cyan'])
        star.rotation_mode = 'QUATERNION'
        star.rotation_quaternion = facing
        star.location = origin + Vector((rng.uniform(-0.42, 0.42), rng.uniform(-0.12, 0.02), rng.uniform(-0.16, 0.30)))
        size = rng.uniform(0.018, 0.04)
        key(star, 0, scale=hidden)
        frame = LAND + 6 + rng.randint(0, 10)
        while frame < BURST_END - 6:
            key(star, frame, scale=hidden)
            key(star, frame + 4, scale=(size, size, size))
            key(star, frame + 9, scale=hidden)
            frame += rng.randint(12, 22)

    # The machine's neon flares with the burst; the camera takes the hit.
    neon = bpy.data.materials['Neon'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
    base = neon.default_value
    for frame, value in ((LAND - 1, base), (LAND + 1, base * 3.2), (LAND + 10, base * 1.4), (LAND + 22, base)):
        neon.default_value = value
        neon.keyframe_insert('default_value', frame=frame)
    rest = cam_obj.location.copy()
    for frame, offset in ((LAND - 1, (0, 0, 0)), (LAND + 1, (0.06, 0.0, -0.05)), (LAND + 3, (-0.05, 0.0, 0.04)),
                          (LAND + 5, (0.03, 0.0, -0.02)), (LAND + 7, (-0.015, 0.0, 0.01)), (LAND + 9, (0, 0, 0))):
        cam_obj.location = rest + Vector(offset)
        cam_obj.keyframe_insert('location', frame=frame)
    for obj in animated:  # the clip ends at 54; its last pose holds through the afterglow
        for track in obj.animation_data.nla_tracks:
            for strip in track.strips:
                strip.extrapolation = 'HOLD_FORWARD'


if not STILL_ONLY:
    clips = (('Dispense', BURST_END, 1),) if '--dispense-only' in sys.argv else (('Idle', 60, 3), ('Dispense', BURST_END, 1))
    for clip, last, loops in clips:
        if clip == 'Dispense':
            add_dispense_vfx()
        play(clip)
        frames = os.path.join(OUT, f'frames-{NAME}', clip)
        os.makedirs(frames, exist_ok=True)
        scene.frame_start, scene.frame_end = 0, last - 1 if loops > 1 else last
        scene.render.filepath = os.path.join(frames, '')
        bpy.ops.render.render(animation=True)
        video = os.path.join(OUT, f'{NAME}-{clip.lower()}.mp4')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-stream_loop', str(loops - 1), '-framerate', str(scene.render.fps),
                        '-start_number', '0', '-i', os.path.join(frames, '%04d.png'), '-vf', 'scale=1000:-2',
                        '-pix_fmt', 'yuv420p', '-vcodec', 'libx264', '-crf', '19', video], check=True)
        print('VIDEO', video)
