"""Blender (headless) export of the TBSA app's processed bodies for the Flapendium Defect Mapper.

For each gender, from Processed/<G>_Body.fbx (shape keys Basis = Normal star pose, Very_Lean..Very_Obese star,
Rest_* standing pose) it writes defect/body_<g>.bin:
    Int16 positions of the Normal star pose (x3, quantised)
    Int16 deltas for Very_Lean, Lean, Obese, Very_Obese (star pose, x3 each, quantised)
    Uint16 skin triangle indices, Uint16 eye triangle indices
    Uint8 zone id per vertex (lower-limb zones; 0 = not mapped yet)
and a shared defect/body_meta.json with array sizes, quantisation scales and the fitting tables
(volume/height^3, area/height^2, height per mass step), computed exactly like BodyMorphBuilder.cs.
Coordinates are converted to Y-up, metres, body facing +Z.
Run:  blender -b -P export_bodies.py -- <output folder>
"""
import bpy, os, sys, json
import numpy as np

SRC = r"C:\Users\Dr. Amanyu\TBSA test3\Assets\Models\Adult\Processed"
OUT = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUT, exist_ok=True)
LEVELS = ["Very_Lean", "Lean", "Normal", "Obese", "Very_Obese"]
STEPS = 80

ZONES = ["unmapped",
         "Thigh, proximal third - anterior", "Thigh, proximal third - medial", "Thigh, proximal third - lateral", "Thigh, proximal third - posterior",
         "Thigh, middle third - anterior", "Thigh, middle third - medial", "Thigh, middle third - lateral", "Thigh, middle third - posterior",
         "Thigh, distal third - anterior", "Thigh, distal third - medial", "Thigh, distal third - lateral", "Thigh, distal third - posterior",
         "Knee - anterior (patellar)", "Knee - medial", "Knee - lateral", "Knee - posterior (popliteal fossa)",
         "Leg, proximal third - anterior (pretibial)", "Leg, proximal third - medial", "Leg, proximal third - lateral", "Leg, proximal third - posterior (calf)",
         "Leg, middle third - anterior (pretibial)", "Leg, middle third - medial", "Leg, middle third - lateral", "Leg, middle third - posterior (calf)",
         "Leg, distal third - anterior (pretibial)", "Leg, distal third - medial", "Leg, distal third - lateral", "Leg, distal third - posterior (Achilles)",
         "Ankle - anterior", "Ankle - medial malleolus", "Ankle - lateral malleolus", "Heel - posterior",
         "Foot - dorsum", "Sole - heel (weight-bearing)", "Sole - midfoot (instep)", "Sole - forefoot", "Toes"]
Z = {name: i for i, name in enumerate(ZONES)}


def to_yup(a):  # Blender (x, y, z) Z-up, facing -Y  ->  (x, z, -y) Y-up, facing +Z
    return np.stack([a[:, 0], a[:, 2], -a[:, 1]], axis=1)


WORLD = None
def shape(me, name):
    kb = me.shape_keys.key_blocks[name]
    a = np.empty(len(me.vertices) * 3); kb.data.foreach_get("co", a)
    a = a.reshape(-1, 3) @ WORLD[:3, :3].T + WORLD[:3, 3]
    return to_yup(a)


def measure(p, tris):
    h = p[:, 1].max() - p[:, 1].min()
    a, b, c = p[tris[:, 0]], p[tris[:, 1]], p[tris[:, 2]]
    vol = abs(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6.0)
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1).sum() * 0.5
    return h, vol, area


def vertex_normals(p, tris):
    n = np.zeros_like(p)
    fn = np.cross(p[tris[:, 1]] - p[tris[:, 0]], p[tris[:, 2]] - p[tris[:, 0]])
    for k in range(3): np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def lower_limb_zones(rest, normals, skin_verts):
    """Zones from the standing (rest) pose of the Normal body; vertex order is shared by every mass level."""
    zone = np.zeros(len(rest), np.uint8)
    y = rest[:, 1]; ymin = y[skin_verts].min(); H = y[skin_verts].max() - ymin
    yr = (y - ymin) / H                                   # 0 = sole, 1 = vertex of the head
    x, zc = rest[:, 0], rest[:, 2]
    # crotch: lowest midline skin point above knee level
    mid = skin_verts[(np.abs(x[skin_verts]) < 0.012 * H) & (yr[skin_verts] > 0.35) & (yr[skin_verts] < 0.6)]
    crotch = yr[mid].min()
    ankle, knee = 0.045, 0.285                            # malleoli and knee-joint level, fraction of stature
    knee_lo, knee_hi = knee - 0.028, knee + 0.028
    ankle_lo, ankle_hi = ankle - 0.02, ankle + 0.025
    legs = skin_verts[yr[skin_verts] < crotch]
    for side in (-1, 1):
        sv = legs[np.sign(x[legs]) == side]
        if len(sv) == 0: continue
        # centre line of the limb: centroid of thin horizontal slices
        bins = np.linspace(0, crotch, 60)
        idx = np.clip(np.digitize(yr[sv], bins) - 1, 0, len(bins) - 2)
        cx = np.zeros(len(bins) - 1); cz = np.zeros(len(bins) - 1)
        for b in range(len(bins) - 1):
            m = sv[idx == b]
            if len(m): cx[b] = x[m].mean(); cz[b] = zc[m].mean()
        # quadrant around the centre line: anterior (+z), lateral (away from midline), posterior, medial
        dx = (x[sv] - cx[idx]) * side; dz = zc[sv] - cz[idx]
        ang = np.degrees(np.arctan2(dx, dz))                # 0 = anterior, +90 = lateral, -90 = medial
        quad = np.where(np.abs(ang) <= 50, 0, np.where(np.abs(ang) >= 135, 3, np.where(ang > 0, 2, 1)))  # 0 ant 1 med 2 lat 3 post
        r = yr[sv]
        nrm = normals[sv]
        # --- foot (below the ankle band) ---
        foot = r < ankle_lo
        fz = zc[sv]; heel_z = fz[foot].min() if foot.any() else 0; toe_z = fz[foot].max() if foot.any() else 1
        flen = max(toe_z - heel_z, 1e-6); fpos = (fz - heel_z) / flen    # 0 heel .. 1 toe tip
        plantar = nrm[:, 1] < -0.55
        for i, v in enumerate(sv):
            q = quad[i]
            if r[i] < ankle_lo:
                if fpos[i] > 0.80: zone[v] = Z["Toes"]
                elif plantar[i] or r[i] < 0.006:
                    zone[v] = Z["Sole - heel (weight-bearing)"] if fpos[i] < 0.3 else Z["Sole - midfoot (instep)"] if fpos[i] < 0.62 else Z["Sole - forefoot"]
                elif fpos[i] < 0.16: zone[v] = Z["Heel - posterior"]
                else: zone[v] = Z["Foot - dorsum"]
            elif r[i] < ankle_hi:
                zone[v] = [Z["Ankle - anterior"], Z["Ankle - medial malleolus"], Z["Ankle - lateral malleolus"], Z["Heel - posterior"]][q]
            elif r[i] < knee_lo:
                third = min(2, int((r[i] - ankle_hi) / ((knee_lo - ankle_hi) / 3)))   # 0 distal, 1 middle, 2 proximal
                base = [25, 21, 17][third]
                zone[v] = base + q
            elif r[i] < knee_hi:
                zone[v] = [Z["Knee - anterior (patellar)"], Z["Knee - medial"], Z["Knee - lateral"], Z["Knee - posterior (popliteal fossa)"]][q]
            else:
                third = min(2, int((r[i] - knee_hi) / ((crotch - knee_hi) / 3)))   # 0 distal, 1 middle, 2 proximal
                base = [9, 5, 1][third]
                zone[v] = base + q
    return zone, {"crotch": float(crotch), "knee": knee, "ankle": ankle}


meta = {"zones": ZONES, "levels": LEVELS, "steps": STEPS, "bodies": {}}
for g in ("Male", "Female"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, f"{g}_Body.fbx"))
    ob = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
    me = ob.data
    WORLD = np.array(ob.matrix_world); scale = 1.0
    n = len(me.vertices)
    keys = [k.name for k in me.shape_keys.key_blocks]

    # triangles, split into skin (most triangles) and eyes
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    tri = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get("vertices", tri); tri = tri.reshape(-1, 3)
    mat = np.empty(nt, np.int32); me.loop_triangles.foreach_get("material_index", mat)
    counts = np.bincount(mat)
    skin_mat = int(np.argmax(counts))
    skin = tri[mat == skin_mat]; eyes = tri[mat != skin_mat]
    skin_verts = np.unique(skin)

    base = shape(me, "Basis") * scale
    star = {lv: (base if lv == "Normal" else shape(me, lv) * scale) for lv in LEVELS}
    rest = {lv: shape(me, "Rest_" + lv) * scale for lv in LEVELS}

    # fitting tables (same maths as BodyMorphBuilder.Load)
    def rest_at(mass):
        xx = (np.clip(mass, -1, 1) + 1) / 0.5; k0 = min(int(xx), 3); f = xx - k0
        return rest[LEVELS[k0]] * (1 - f) + rest[LEVELS[k0 + 1]] * f
    vr, ar, mh = [], [], []
    for i in range(STEPS + 1):
        h, v, a = measure(rest_at(-1 + i * 2 / STEPS), skin)
        mh.append(h); vr.append(v / h ** 3); ar.append(a / h ** 2)

    zone, marks = lower_limb_zones(rest["Normal"], vertex_normals(rest["Normal"], skin), skin_verts)

    # quantise
    ext = np.abs(base).max() * 1.02
    pscale = ext / 32767.0
    deltas = [star[lv] - base for lv in ("Very_Lean", "Lean", "Obese", "Very_Obese")]
    dext = max(np.abs(d).max() for d in deltas) * 1.02
    dscale = dext / 32767.0
    parts = [np.round(base / pscale).astype('<i2')] + [np.round(d / dscale).astype('<i2') for d in deltas] + \
            [skin.astype('<u2'), eyes.astype('<u2'), zone.astype(np.uint8)]
    path = os.path.join(OUT, f"body_{g.lower()}.bin")
    with open(path, 'wb') as fh:
        for p in parts: fh.write(np.ascontiguousarray(p).tobytes())
    meta["bodies"][g.lower()] = {
        "vertices": n, "skinTris": int(len(skin)), "eyeTris": int(len(eyes)),
        "posScale": float(pscale), "deltaScale": float(dscale),
        "volumeRatio": [round(float(v), 8) for v in vr], "areaRatio": [round(float(v), 7) for v in ar], "meshHeight": [round(float(v), 6) for v in mh],
        "landmarks": marks, "zoneCounts": {ZONES[i]: int(c) for i, c in enumerate(np.bincount(zone, minlength=len(ZONES))) if c},
        "noseZ": float(base[skin_verts][:, 2].max()), "headTopY": float(base[skin_verts][:, 1].max()),
    }
    print(g, "verts", n, "skin tris", len(skin), "eye tris", len(eyes), "keys", keys, "scale", scale,
          "height(normal rest)", round(mh[STEPS // 2], 4), "bin", os.path.getsize(path))

with open(os.path.join(OUT, "body_meta.json"), "w") as fh:
    json.dump(meta, fh, separators=(",", ":"))
print("done")
