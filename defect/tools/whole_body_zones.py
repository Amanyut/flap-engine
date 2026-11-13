"""Adds head, neck, trunk, groin/perineum and upper-limb zones to the Defect Mapper bodies.

Reads defect/body_<g>.v1.bin (lower-limb zones already set, from the standing pose in Blender) and labels every
other skin vertex from the displayed star pose, using landmarks found on the mesh itself:
  eyes (the eye shells), nose tip (most anterior point), chin (where the midline profile drops below the face),
  axilla / wrist / knuckles (thickness of the arm along its length), and stature fractions for the trunk.
Unlabelled leftovers take the zone of their neighbours. Writes defect/body_<g>.v2.bin and updates body_meta.json
(zone names + short codes).   Run:  python whole_body_zones.py <defect folder>
"""
import sys, json, os
import numpy as np

D = sys.argv[1]
meta = json.load(open(os.path.join(D, 'body_meta.json')))

LEG = ["thigh.prox.ant", "thigh.prox.med", "thigh.prox.lat", "thigh.prox.post", "thigh.mid.ant", "thigh.mid.med", "thigh.mid.lat", "thigh.mid.post",
       "thigh.dist.ant", "thigh.dist.med", "thigh.dist.lat", "thigh.dist.post", "knee.ant", "knee.med", "knee.lat", "knee.post",
       "leg.prox.ant", "leg.prox.med", "leg.prox.lat", "leg.prox.post", "leg.mid.ant", "leg.mid.med", "leg.mid.lat", "leg.mid.post",
       "leg.dist.ant", "leg.dist.med", "leg.dist.lat", "leg.dist.post", "ankle.ant", "ankle.med", "ankle.lat", "heel.post",
       "foot.dorsum", "sole.heel", "sole.mid", "sole.fore", "toes"]
NEW = [
    ("scalp.ant", "Scalp – frontal"), ("scalp.vertex", "Scalp – vertex (crown)"), ("scalp.post", "Scalp – occipital"), ("temple", "Temple"),
    ("forehead.central", "Forehead – central"), ("forehead.lat", "Forehead – lateral"),
    ("eyelid.upper", "Upper eyelid"), ("eyelid.lower", "Lower eyelid"),
    ("nose.dorsum", "Nose – dorsum"), ("nose.sidewall", "Nose – sidewall"), ("nose.tip", "Nose – tip"), ("nose.ala", "Nose – ala"),
    ("cheek.med", "Cheek – medial (infraorbital)"), ("cheek.lat", "Cheek – lateral (zygomatic / preauricular)"), ("cheek.buccal", "Cheek – buccal / jowl"),
    ("lip.upper", "Upper lip"), ("lip.lower", "Lower lip"), ("chin", "Chin"),
    ("ear.upper", "Ear – upper third (helix)"), ("ear.middle", "Ear – middle third"), ("ear.lobule", "Ear – lobule"),
    ("neck.ant", "Neck – anterior"), ("neck.lat", "Neck – lateral"), ("neck.post", "Neck – posterior (nape)"),
    ("chest.upper", "Chest – upper (infraclavicular)"), ("chest.sternal", "Chest – sternal (midline)"), ("chest.breast", "Chest – pectoral / breast"),
    ("chest.lat", "Chest – lateral"), ("axilla", "Axilla"),
    ("abdomen.upper", "Abdomen – upper"), ("abdomen.lower", "Abdomen – lower"), ("flank", "Flank"),
    ("back.upper", "Back – upper (scapular)"), ("back.mid", "Back – middle (thoracic)"), ("back.lower", "Back – lower (lumbar)"),
    ("sacrum", "Sacral region"), ("buttock", "Buttock"), ("groin", "Groin"), ("pubis", "Mons pubis / suprapubic"), ("perineum", "Perineum / genitalia"),
    ("shoulder", "Shoulder"),
    ("arm.prox.ant", "Arm, proximal half – anterior"), ("arm.prox.post", "Arm, proximal half – posterior"),
    ("arm.dist.ant", "Arm, distal half – anterior"), ("arm.dist.post", "Arm, distal half – posterior"),
    ("elbow.ant", "Elbow – antecubital fossa"), ("elbow.post", "Elbow – olecranon"),
    ("forearm.prox.volar", "Forearm, proximal half – volar"), ("forearm.prox.dorsal", "Forearm, proximal half – dorsal"),
    ("forearm.dist.volar", "Forearm, distal half – volar"), ("forearm.dist.dorsal", "Forearm, distal half – dorsal"),
    ("wrist.volar", "Wrist – volar"), ("wrist.dorsal", "Wrist – dorsal"),
    ("hand.dorsum", "Hand – dorsum"), ("palm", "Palm"), ("thumb", "Thumb"),
    ("fingers.dorsal", "Fingers – dorsal"), ("fingers.volar", "Fingers – volar"), ("fingertips", "Fingertips"),
]
CODES = ["unmapped"] + LEG + [c for c, _ in NEW]
NAMES = meta["zones"][:1 + len(LEG)] + [nm for _, nm in NEW]
Z = {c: i for i, c in enumerate(CODES)}


def load(g):
    m = meta["bodies"][g]; n = m["vertices"]
    raw = open(os.path.join(D, f"body_{g}.v1.bin"), "rb").read()
    p = np.frombuffer(raw, "<i2", n * 3).reshape(-1, 3) * m["posScale"]
    off = n * 3 * 2 * 5
    skin = np.frombuffer(raw, "<u2", m["skinTris"] * 3, off).reshape(-1, 3); off += m["skinTris"] * 6
    eyes = np.frombuffer(raw, "<u2", m["eyeTris"] * 3, off).reshape(-1, 3); off += m["eyeTris"] * 6
    zone = np.frombuffer(raw, np.uint8, n, off).copy()
    return m, n, raw, p, skin, eyes, zone, off


def label(g):
    m, n, raw, p, skin, eyes, zone, zoff = load(g)
    sv = np.unique(skin)
    x, y, z = p[:, 0], p[:, 1], p[:, 2]; ax = np.abs(x)
    sole = y[sv].min(); top = y[sv].max(); H = top - sole
    f = lambda frac: sole + frac * H
    crotch = sole + meta["bodies"][g]["landmarks"]["crotch"] * H
    # --- head landmarks ---
    ev = np.unique(eyes)
    eye_y = y[ev].mean(); eye_z = z[ev].mean(); eye_x = ax[ev].mean()
    face = sv[(y[sv] > eye_y - 0.2) & (ax[sv] < 0.03)]
    tip = face[np.argmax(z[face])]; tip_y, tip_z = y[tip], z[tip]
    mid = sv[(ax[sv] < 0.006)]
    chin_y = None
    for yy in np.arange(tip_y, tip_y - 0.2, -0.002):
        s = mid[np.abs(y[mid] - yy) < 0.003]
        if len(s) and z[s].max() < tip_z - 0.06: chin_y = yy; break
    Dh = eye_y - chin_y
    mouth_y = eye_y - 0.60 * Dh; subnasale_y = eye_y - 0.43 * Dh; brow_y = eye_y + 0.15 * Dh; hair_y = eye_y + 0.62 * Dh
    ring = sv[np.abs(y[sv] - eye_y) < 0.01]; ring = ring[ax[ring] < 0.12]
    hcz = (z[ring].max() + z[ring].min()) / 2
    skull = sv[np.abs(y[sv] - (brow_y + 0.02)) < 0.006]; skull_hw = ax[skull][ax[skull] < 0.12].max()
    neck_y = f(0.818)
    # --- arm landmarks (per side), from the thickness of the arm along x ---
    arm = {}
    for side in (-1, 1):
        a = sv[(np.sign(x[sv]) == side) & (y[sv] > sole + 0.6 * H)]
        ft = ax[a].max(); xs = np.arange(0.10, ft, 0.005); th = []; zt = []; ym = []; zm = []
        for xx in xs:
            s = a[np.abs(ax[a] - xx) < 0.004]
            th.append(y[s].max() - y[s].min() if len(s) else 0); zt.append(z[s].max() - z[s].min() if len(s) else 0)
            ym.append((y[s].max() + y[s].min()) / 2 if len(s) else 0); zm.append(np.median(z[s]) if len(s) else 0)
        th = np.array(th); zt = np.array(zt); ym = np.array(ym); zm = np.array(zm)
        axilla = xs[np.argmax(th < 0.08 * H)]
        L = ft - axilla
        rng = (xs > axilla + 0.55 * L) & (xs < axilla + 0.82 * L)
        wrist = xs[rng][np.argmin(th[rng])]
        hand = xs > wrist; palm_x = xs[hand][np.argmax(zt[hand])]
        after = (xs > palm_x) & (th < 0.62 * th[xs == palm_x][0])
        mcp = xs[after][0] if after.any() else wrist + 0.4 * (ft - wrist)
        elbow = axilla + 0.33 * L
        armpit = a[np.abs(ax[a] - axilla) < 0.006]
        arm[side] = dict(axilla=axilla, L=L, wrist=wrist, mcp=mcp, elbow=elbow, ft=ft, armpit_y=y[armpit].min(),
                         xs=xs, ym=ym, zm=zm)

    todo = sv[zone[sv] == 0]
    for v in todo:
        X, Y, Zv, AX = x[v], y[v], z[v], ax[v]
        side = 1 if X >= 0 else -1; A = arm[side]
        # ---------- upper limb ----------
        if AX > A["axilla"] + 0.01 and Y > A["armpit_y"] - 0.03:
            t = (AX - A["axilla"]) / A["L"]
            yc = np.interp(AX, A["xs"], A["ym"]); zcl = np.interp(AX, A["xs"], A["zm"])
            if AX > A["mcp"]:
                zone[v] = Z["fingertips"] if AX > A["ft"] - 0.022 else (Z["fingers.dorsal"] if Y > yc + 0.0 else Z["fingers.volar"])
                # the thumb lies forward of the palm
                if Zv > zcl + 0.035 and AX < A["mcp"] + 0.06: zone[v] = Z["thumb"]
            elif AX > A["wrist"] + 0.012:
                if Zv > zcl + 0.04: zone[v] = Z["thumb"]
                else: zone[v] = Z["hand.dorsum"] if Y > yc else Z["palm"]
            elif AX > A["wrist"] - 0.018:
                zone[v] = Z["wrist.dorsal"] if Y > yc else Z["wrist.volar"]
            elif AX > A["elbow"] + 0.025:
                prox = AX < (A["elbow"] + A["wrist"]) / 2
                dors = Y > yc
                zone[v] = Z["forearm.%s.%s" % ("prox" if prox else "dist", "dorsal" if dors else "volar")]
            elif AX > A["elbow"] - 0.025:
                zone[v] = Z["elbow.ant"] if Zv > 0 else Z["elbow.post"]
            else:
                prox = t < 0.165
                zone[v] = Z["arm.%s.%s" % ("prox" if prox else "dist", "ant" if Zv > 0 else "post")]
            continue
        # ---------- head ----------
        az = np.degrees(np.arctan2(AX, Zv - hcz))
        head_floor = chin_y if az < 55 else (mouth_y - 0.005 if az < 115 else subnasale_y - 0.02)
        if Y > head_floor and AX < 0.13:
            # ear
            if AX > skull_hw - 0.003 and subnasale_y - 0.012 < Y < brow_y + 0.012 and hcz - 0.06 < Zv < hcz + 0.02:
                lo, hi = subnasale_y - 0.012, brow_y + 0.012; r = (Y - lo) / (hi - lo)
                zone[v] = Z["ear.lobule"] if r < 0.3 else Z["ear.middle"] if r < 0.62 else Z["ear.upper"]
                continue
            if az >= 120 and Y > subnasale_y: zone[v] = Z["scalp.post"]; continue
            if Y >= hair_y + 0.45 * (top - hair_y): zone[v] = Z["scalp.vertex"]; continue
            if Y >= hair_y: zone[v] = Z["scalp.ant"] if az < 70 else Z["temple"]; continue
            if az >= 68:
                zone[v] = Z["temple"] if Y >= brow_y else (Z["scalp.post"] if az >= 120 else Z["cheek.lat"])
                continue
            if Y >= brow_y:
                zone[v] = Z["temple"] if az > 55 else (Z["forehead.central"] if AX < 0.026 else Z["forehead.lat"]); continue
            # nose (protrudes in front of the face)
            if AX < 0.022 and subnasale_y - 0.004 < Y < eye_y + 0.012 and Zv > tip_z - 0.04:
                if np.sqrt(X * X + (Y - tip_y) ** 2 + (Zv - tip_z) ** 2) < 0.013: zone[v] = Z["nose.tip"]
                elif Y < tip_y + 0.008 and AX > 0.008: zone[v] = Z["nose.ala"]
                elif AX < 0.008: zone[v] = Z["nose.dorsum"]
                else: zone[v] = Z["nose.sidewall"]
                continue
            # eyelids
            if np.hypot(AX - eye_x, Y - eye_y) < 0.021 and Zv > eye_z - 0.025:
                zone[v] = Z["eyelid.upper"] if Y > eye_y else Z["eyelid.lower"]; continue
            # lips and chin
            if AX < 0.25 * Dh and mouth_y - 0.15 * Dh < Y < subnasale_y:
                zone[v] = Z["lip.upper"] if Y >= mouth_y else Z["lip.lower"]; continue
            if Y <= mouth_y - 0.15 * Dh and AX < 0.32 * Dh:
                zone[v] = Z["chin"]; continue
            # cheeks
            if Y > subnasale_y - 0.01 and AX < eye_x + 0.025: zone[v] = Z["cheek.med"]
            elif az > 48: zone[v] = Z["cheek.lat"]
            else: zone[v] = Z["cheek.buccal"]
            continue
        # ---------- neck ----------
        if Y > neck_y and AX < 0.075:
            zone[v] = Z["neck.ant"] if az < 60 else (Z["neck.lat"] if az < 120 else Z["neck.post"]); continue
        # ---------- trunk ----------
        tz = sv[np.abs(y[sv] - Y) < 0.01]; tz = tz[ax[tz] < 0.09]
        zc = (z[tz].max() + z[tz].min()) / 2 if len(tz) else 0
        az = np.degrees(np.arctan2(AX, Zv - zc))
        if Y > neck_y - 0.01 or (AX > A["axilla"] - 0.05 and Y > A["armpit_y"] + 0.01):
            zone[v] = Z["shoulder"]; continue
        if AX > A["axilla"] - 0.07 and A["armpit_y"] - 0.08 < Y < A["armpit_y"] + 0.012 and 55 < az < 125:
            zone[v] = Z["axilla"]; continue
        if Y < crotch + 0.045 * H and AX < 0.055 * H:
            zone[v] = Z["perineum"]; continue
        if az < 55:
            if Y > f(0.76): zone[v] = Z["chest.sternal"] if AX < 0.035 * H else Z["chest.upper"]
            elif Y > f(0.67): zone[v] = Z["chest.sternal"] if AX < 0.022 * H else Z["chest.breast"]
            elif Y > f(0.60): zone[v] = Z["abdomen.upper"]
            elif Y > f(0.53): zone[v] = Z["abdomen.lower"]
            else: zone[v] = Z["pubis"] if AX < 0.06 * H else Z["groin"]
        elif az < 125:
            zone[v] = Z["chest.lat"] if Y > f(0.64) else (Z["flank"] if Y > f(0.5) else Z["buttock"] if Zv < zc else Z["groin"])
        else:
            if Y > f(0.72): zone[v] = Z["back.upper"]
            elif Y > f(0.63): zone[v] = Z["back.mid"]
            elif Y > f(0.54): zone[v] = Z["back.lower"]
            elif AX < 0.045 * H and Y > f(0.47): zone[v] = Z["sacrum"]
            else: zone[v] = Z["buttock"]

    # leftovers take their neighbours' zone
    adj = [[] for _ in range(n)]
    for a, b, c in skin: adj[a] += [b, c]; adj[b] += [a, c]; adj[c] += [a, b]
    for _ in range(20):
        left = [v for v in sv if zone[v] == 0]
        if not left: break
        for v in left:
            nb = [zone[w] for w in adj[v] if zone[w]]
            if nb: zone[v] = max(set(nb), key=nb.count)
    out = raw[:zoff] + zone.tobytes()
    open(os.path.join(D, f"body_{g}.v2.bin"), "wb").write(out)
    counts = np.bincount(zone[sv], minlength=len(CODES))
    print(g, "landmarks: eye_y %.3f chin %.3f mouth %.3f tip %.3f skull_hw %.3f neck %.3f" % (eye_y, chin_y, mouth_y, tip_y, skull_hw, neck_y),
          {s: {k: round(float(v), 3) for k, v in arm[s].items() if np.ndim(v) == 0} for s in arm})
    print("  unlabelled:", int(counts[0]), " smallest zones:", sorted([(int(counts[i]), CODES[i]) for i in range(1, len(CODES))])[:6])
    return counts


for g in ("male", "female"):
    c = label(g)
    meta["bodies"][g]["zoneCounts"] = {CODES[i]: int(c[i]) for i in range(len(CODES)) if c[i]}
meta["zones"] = NAMES; meta["codes"] = CODES
json.dump(meta, open(os.path.join(D, "body_meta.json"), "w"), separators=(",", ":"))
print("zones:", len(CODES))
