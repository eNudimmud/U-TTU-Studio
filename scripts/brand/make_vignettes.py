#!/usr/bin/env python3
"""U*TTU Studio tool thumbnails v2: one premium series from generated stills (Imagine), 0 Comfy credit.
Stills: 640x400 + 1280x800 webp. Animated: 640x400 webm (VP9) + mp4 (H.264), 3 s silent loops, poster = still.
Needs Pillow, numpy, opencv-python (cut-out masks) and ffmpeg (libvpx-vp9, libx264).
Usage: python3 scripts/brand/make_vignettes.py scripts/brand/vignettes-sources public/exemples/vignettes [ids...]"""
import math, os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps

SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2]); ONLY = set(sys.argv[3:])
OUT.mkdir(parents=True, exist_ok=True)
GOLD = (214, 178, 102); GOLD_HI = (240, 210, 140); INK = (12, 12, 14)
FPS, DUR = 24, 3.0
NF = int(FPS * DUR)

def src(name):
    for ext in (".webp", ".jpg", ".png"):
        p = SRC / f"{name}{ext}"
        if p.exists(): return Image.open(p).convert("RGB")
    raise FileNotFoundError(name)

def lift(im, target=0.50):
    """Brighten dark stills so they read on the dark UI (never dark, unreadable pictures)."""
    a = np.asarray(im).astype(np.float32) / 255
    lum = (a @ np.array([.2126, .7152, .0722])).mean()
    if lum < target:
        g = math.log(target) / math.log(max(lum, 1e-3))
        a = np.clip(a ** max(g, .55), 0, 1)
    return Image.fromarray((a * 255).round().astype(np.uint8))

def fit(im, W, H, fx=.5, fy=.5, zoom=1.0):
    """Cover-crop to WxH, focus point (fx, fy) in 0..1, optional zoom."""
    w, h = im.size; s = max(W / w, H / h) * zoom
    nw, nh = w * s, h * s
    x = min(max(fx * nw - W / 2, 0), nw - W); y = min(max(fy * nh - H / 2, 0), nh - H)
    return im.resize((max(W, round(nw)), max(H, round(nh))), Image.LANCZOS).crop((round(x), round(y), round(x) + W, round(y) + H))

def vignette_shade(im, k=.28):
    """Soft bottom/edge shade so overlays read; keeps the centre bright."""
    W, H = im.size
    y = np.linspace(0, 1, H)[:, None]; x = np.linspace(-1, 1, W)[None, :]
    m = 1 - k * (np.clip((y - .62) / .38, 0, 1) ** 1.6) - .10 * (x ** 4)
    a = np.asarray(im).astype(np.float32) * m[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def rr(d, box, r, **kw): d.rounded_rectangle(box, r, **kw)

def inset(base, im, box, s, fx=.5, fy=.5):
    x0, y0, x1, y1 = box
    th = fit(im, x1 - x0, y1 - y0, fx, fy)
    m = Image.new("L", th.size, 0); rr(ImageDraw.Draw(m), (0, 0, th.size[0] - 1, th.size[1] - 1), 6 * s, fill=255)
    sh = Image.new("L", base.size, 0); rr(ImageDraw.Draw(sh), (x0 - 2 * s, y0 + 3 * s, x1 + 2 * s, y1 + 6 * s), 8 * s, fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(6 * s)); base.paste(Image.new("RGB", base.size, INK), (0, 0), sh)
    base.paste(th, (x0, y0), m)
    rr(ImageDraw.Draw(base), (x0, y0, x1 - 1, y1 - 1), 6 * s, outline=GOLD, width=max(1, round(1.5 * s)))

def divider(im, x, s):
    d = ImageDraw.Draw(im); W, H = im.size
    d.rectangle((x - s, 0, x + s - 1, H), fill=(250, 240, 220))
    r = 13 * s; cy = H // 2
    d.ellipse((x - r, cy - r, x + r, cy + r), fill=(250, 244, 230), outline=GOLD, width=2 * s)
    for sgn in (-1, 1):
        cx = x + sgn * 5 * s
        d.polygon([(cx, cy - 4 * s), (cx, cy + 4 * s), (cx + sgn * 4 * s, cy)], fill=(40, 34, 24))

def wipe(a, b, t):
    """Before a (left) / after b (right); split at t in 0..1."""
    W, H = a.size; x = round(W * t)
    out = a.copy(); out.paste(b.crop((x, 0, W, H)), (x, 0)); return out, x

def checker(W, H, s, c1=(46, 46, 52), c2=(30, 30, 34)):
    q = 14 * s; yy, xx = np.mgrid[0:H, 0:W]
    m = ((xx // q + yy // q) % 2).astype(bool)
    a = np.where(m[..., None], np.array(c1, np.uint8), np.array(c2, np.uint8))
    return Image.fromarray(a.astype(np.uint8))

def cutout_mask(im):
    """Subject mask on a plain light studio backdrop (GrabCut seeded by colour distance)."""
    import cv2
    a = np.asarray(im); h, w = a.shape[:2]
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    dist = np.linalg.norm(a.astype(np.float32) - bg, axis=2)
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    mask[dist > 38] = cv2.GC_PR_FGD; mask[dist > 70] = cv2.GC_FGD; mask[dist < 10] = cv2.GC_BGD
    bgm, fgm = np.zeros((1, 65)), np.zeros((1, 65))
    cv2.grabCut(cv2.cvtColor(a, cv2.COLOR_RGB2BGR), mask, None, bgm, fgm, 4, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if n > 1:
        keep = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA]); m = np.where(lab == keep, 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=2)
    alpha = cv2.GaussianBlur(m, (0, 0), 1.4).astype(np.float32) / 255
    # inside the soft edge, pixels that are close to the backdrop colour become transparent (hair gaps)
    band = cv2.distanceTransform(m, cv2.DIST_L2, 5) < 28  # outer 28 px of the subject (hair gaps, fly-aways)
    soft = np.clip((dist - 16) / 40, 0, 1) ** .8
    alpha = np.where(band, np.minimum(alpha, soft), alpha)
    # colour decontamination: remove the backdrop spill from semi-transparent pixels
    A = alpha[..., None]; F = (a.astype(np.float32) - (1 - A) * bg) / np.maximum(A, .45)
    F = np.where(A > .02, np.minimum(np.clip(F, 0, 255), a), a)  # light backdrop: removing spill can only darken
    return Image.fromarray((alpha * 255).astype(np.uint8)), Image.fromarray(F.astype(np.uint8))

def wave_env(n, seed, kind="voice"):
    r = np.random.default_rng(seed); x = np.arange(n)
    if kind == "voice":
        env = np.abs(np.sin(x / 3.1)) * .55 + .45 * r.random(n)
        gaps = (np.sin(x / 9.5 + seed) > .75); env[gaps] *= .18
    elif kind == "music":
        env = .55 + .35 * np.sin(x / 2.2) * np.sin(x / 7.0 + seed) + .1 * r.random(n)
    elif kind == "fx":
        env = .08 + .06 * r.random(n)
        for p in r.choice(n, max(3, n // 9), replace=False): env[p:p + 4] += np.array([1, .7, .4, .2])[:len(env[p:p + 4])]
    return np.clip(env, .06, 1)

def waveform(im, box, env, s, phase=0.0, color=GOLD, played=None, bar=3, gap=2):
    d = ImageDraw.Draw(im); x0, y0, x1, y1 = box; cy = (y0 + y1) / 2; hh = (y1 - y0) / 2
    step = (bar + gap) * s; n = int((x1 - x0) // step)
    for i in range(n):
        v = env[int(i + phase) % len(env)]
        x = x0 + i * step; c = color
        if played is not None and x > x0 + played * (x1 - x0): c = (235, 228, 214)
        d.rounded_rectangle((x, cy - v * hh, x + bar * s, cy + v * hh), radius=bar * s // 2, fill=c)

def eq_bars(im, box, t, s, n=18, seed=3):
    d = ImageDraw.Draw(im); x0, y0, x1, y1 = box; r = np.random.default_rng(seed)
    ph = r.random(n) * 6.28; fr = 1.5 + r.random(n) * 2.5; w = (x1 - x0) / n
    for i in range(n):
        v = .25 + .75 * abs(math.sin(ph[i] + 2 * math.pi * t * fr[i] / 1.0 * (DUR / 3)))
        v = .25 + .75 * (.5 + .5 * math.sin(ph[i] + 2 * math.pi * round(fr[i]) * t))
        bx = x0 + i * w
        d.rounded_rectangle((bx + w * .18, y1 - v * (y1 - y0), bx + w * .82, y1), radius=max(1, int(w * .2)), fill=GOLD)

def scrim(im, y0, k=.62):
    """Dark gradient band at the bottom for waveforms/timeline legibility."""
    W, H = im.size; a = np.asarray(im).astype(np.float32)
    y = np.arange(H)[:, None]; m = np.clip((y - y0) / (H - y0), 0, 1) ** 1.2 * k
    a = a * (1 - m[..., None]) + np.array(INK) * m[..., None]
    return Image.fromarray(a.astype(np.uint8))

def timeline(im, s, t, marks=()):
    d = ImageDraw.Draw(im); W, H = im.size; y = H - 16 * s; x0, x1 = 18 * s, W - 18 * s
    d.rounded_rectangle((x0, y - s, x1, y + s), s, fill=(255, 255, 255, 90) if im.mode == "RGBA" else (120, 116, 108))
    xe = x0 + (x1 - x0) * t
    d.rounded_rectangle((x0, y - s, xe, y + s), s, fill=GOLD)
    d.ellipse((xe - 5 * s, y - 5 * s, xe + 5 * s, y + 5 * s), fill=GOLD_HI)
    for m in marks:
        xm = x0 + (x1 - x0) * m; d.rectangle((xm - s, y - 7 * s, xm + s, y + 7 * s), fill=(250, 244, 230))

def dashed_rect(im, box, s, color=GOLD, dash=8, w=2):
    d = ImageDraw.Draw(im); x0, y0, x1, y1 = box; L = dash * s
    for x in range(int(x0), int(x1), 2 * L):
        d.line((x, y0, min(x + L, x1), y0), fill=color, width=w * s); d.line((x, y1, min(x + L, x1), y1), fill=color, width=w * s)
    for y in range(int(y0), int(y1), 2 * L):
        d.line((x0, y, x0, min(y + L, y1)), fill=color, width=w * s); d.line((x1, y, x1, min(y + L, y1)), fill=color, width=w * s)

def chip(im, xy, text, s):
    from PIL import ImageFont
    f = ImageFont.truetype("/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf", 15 * s)
    try: f.set_variation_by_axes([14, 650])
    except Exception: pass
    d = ImageDraw.Draw(im); x, y = xy; tw = d.textlength(text, font=f)
    rr(d, (x, y, x + tw + 20 * s, y + 26 * s), 13 * s, fill=(14, 14, 16), outline=GOLD, width=max(1, s))
    d.text((x + 10 * s, y + 4 * s), text, font=f, fill=GOLD_HI)

def ease(t): return t * t * (3 - 2 * t)
def pingpong(t, hold=.18):
    """0→1→0 over the loop with holds at both ends (wipes)."""
    u = (t % 1.0)
    if u < hold / 2 or u > 1 - hold / 2: return 0.0 if (u < .25 or u > .75) else 1.0
    a = (u - hold / 2) / (1 - hold)
    return ease(min(1, max(0, (1 - abs(2 * a - 1)) * 1.6)))

# ---------------------------------------------------------------- per-tool recipes
# Each recipe: frame(W, H, s, t) -> Image ; t in [0,1) loop phase ; still = frame(..., t=None)
R = {}
def tool(id, animated=False):
    def deco(fn): R[id] = (fn, animated); return fn
    return deco

def plain(name, fx=.5, fy=.5, target=.48):
    return lambda W, H, s, t: vignette_shade(fit(lift(src(name), target), W, H, fx, fy), .18)

R["img-klein"] = (plain("img-klein", .45), False)
R["img-qwen"] = (plain("img-qwen"), False)
R["img-flux3"] = (plain("img-flux3"), False)
R["img-ideogram"] = (lambda W, H, s, t: fit(src("img-ideogram"), W, H, .5, .3), False)
R["img-gpt"] = (plain("img-gpt"), False)
R["img-seedream"] = (plain("img-seedream", .44, .35), False)
R["img-nano"] = (plain("img-nano", .42, .3, .46), False)
R["fluid"] = None

@tool("img-refs")
def _(W, H, s, t):
    im = vignette_shade(fit(lift(src("img-refs")), W, H, .62, .5), .3)
    h = 84 * s; w = round(h * 1.0); y = H - h - 14 * s
    inset(im, src("ref-uttu-portrait"), (14 * s, y, 14 * s + w, y + h), s, .62, .38)
    inset(im, src("ref-canyon"), (22 * s + w, y, 22 * s + 2 * w, y + h), s, .7, .5)
    return im

@tool("img-360", True)
def _(W, H, s, t):
    pano = lift(src("img-360"), .5); pw, ph = pano.size
    sc = H / ph; pano = pano.resize((round(pw * sc), H), Image.LANCZOS); pw = pano.size[0]
    strip = Image.new("RGB", (pw * 2, H)); strip.paste(pano, (0, 0)); strip.paste(ImageOps.mirror(pano), (pw, 0))
    off = 0 if t is None else round(t * pw)
    # soft seam: mirrored tiling keeps the loop continuous
    im = strip.crop((off, 0, off + W, H)) if off + W <= 2 * pw else strip.crop((0, 0, W, H))
    im = vignette_shade(im, .22); chip(im, (14 * s, 14 * s), "360°", s); return im

def pair_wipe(a_name, b_name, fx=.5, fy=.5, pos=.5, ta=.48, tb=.48, prep_a=None):
    def fn(W, H, s, t):
        a = fit(lift(src(a_name), ta), W, H, fx, fy); b = fit(lift(src(b_name), tb), W, H, fx, fy)
        if prep_a: a = prep_a(a, s)
        k = pos if t is None else .12 + .76 * pingpong(t)
        im, x = wipe(a, b, k); divider(im, x, s); return im
    return fn

R["img-croquis"] = (pair_wipe("img-croquis-avant", "img-croquis-final", ta=.0, tb=.5), True)
R["ret-modifier"] = (pair_wipe("ret-modifier-avant", "ret-modifier-apres", .55), True)
R["ret-eclairer"] = (pair_wipe("ret-eclairer-avant", "ret-eclairer-apres", .5, .35), True)
R["maquette"] = (pair_wipe("maquette-blockout", "maquette-rendu", ta=.0), True)
R["vid-effacer"] = (pair_wipe("vid-effacer-avant", "vid-effacer-apres", .5, .6, ta=.0, tb=.0), True)

def degrade(a, s):
    W, H = a.size; small = a.resize((W // (9 * 1), H // (9 * 1)), Image.BILINEAR).resize((W, H), Image.NEAREST)
    return small.filter(ImageFilter.GaussianBlur(1.0 * s))
R["ret-finaliser"] = (pair_wipe("ret-finaliser", "ret-finaliser", .45, ta=.5, prep_a=degrade), True)
R["vid-finaliser"] = (pair_wipe("vid-finaliser", "vid-finaliser", .6, .4, ta=.5, prep_a=degrade), True)

def expand(name, fx=.5, fy=.5, frac=(.42, .52), vertical=False):
    def fn(W, H, s, t):
        full = fit(lift(src(name)), W, H, fx, fy)
        if vertical: fw, fh = round(H * 9 / 16), H
        else: fw, fh = round(W * frac[0]), round(H * frac[1])
        k = 1.0 if t is None else pingpong(t, .30)
        cw, ch = fw + (W - fw) * k, fh + (H - fh) * k
        x0, y0 = (W - cw) / 2, (H - ch) / 2
        dark = ImageEnhance.Brightness(full).enhance(.22).filter(ImageFilter.GaussianBlur(3 * s))
        dark = Image.blend(dark, full, .0)
        im = Image.blend(dark, full, .0 if t is not None else 1.0) if t is not None else full.copy()
        if t is not None:
            im = dark.copy(); im.paste(full.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))), (round(x0), round(y0)))
        bx = ((W - fw) / 2, (H - fh) / 2, (W + fw) / 2, (H + fh) / 2)
        dashed_rect(im, bx, s); return im
    return fn
R["ret-elargir"] = (expand("ret-elargir", .5, .5, (.36, .44)), True)
R["vid-recadrer"] = (expand("vid-recadrer", .5, .45, vertical=True), True)

def cutout(name, fx=.5, fy=.5):
    cache = {}
    def fn(W, H, s, t):
        key = (W, H)
        if key not in cache:
            full = src(name); m, fg = cutout_mask(full)
            cache[key] = (fit(full, W, H, fx, fy), fit(m.convert("RGB"), W, H, fx, fy).convert("L"), fit(fg, W, H, fx, fy))
        im0, m, fg = cache[key]
        cut = checker(W, H, s); cut.paste(fg, (0, 0), m)
        k = .5 if t is None else .12 + .76 * pingpong(t)
        im, x = wipe(im0, cut, k); divider(im, x, s); return im
    return fn
R["ret-detourer"] = (cutout("ret-detourer", .5, .3), True)
R["vid-detourer"] = (cutout("vid-detourer", .5, .45), True)

def video_clip(name, fx=.5, fy=.5):
    frames = {}
    def fn(W, H, s, t):
        p = SRC / f"{name}.mp4"
        if (W, H) not in frames:
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
            pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip().splitlines()[0].split(",")
            vw, vh = int(pr[0]), int(pr[1]); n = len(raw) // (vw * vh * 3)
            frames[(W, H)] = [Image.frombytes("RGB", (vw, vh), raw[i * vw * vh * 3:(i + 1) * vw * vh * 3]) for i in range(n)]
        fr = frames[(W, H)]; n = len(fr)
        if t is None: im = fit(lift(src(name)), W, H, fx, fy)
        else:
            # seamless loop: last 0.6 s cross-fades into the first frames
            L = min(n, NF); xf = int(.6 * FPS); i = int(t * L)
            a = fr[i]
            if i >= L - xf: a = Image.blend(fr[i], fr[i - (L - xf)], (i - (L - xf)) / xf)
            im = fit(lift(a), W, H, fx, fy)
        im = scrim(im, int(H * .72), .5); timeline(im, s, .35 if t is None else t); return im
    return fn
R["vid-wan"] = (video_clip("vid-wan", .45), True)
R["vid-texte"] = (video_clip("vid-texte"), True)

def still_video(name, fx=.5, fy=.5, prog=.4, extra=None, target=.48):
    def fn(W, H, s, t):
        im = fit(lift(src(name), target), W, H, fx, fy); im = scrim(im, int(H * .7), .55)
        if extra: extra(im, W, H, s)
        timeline(im, s, prog); return im
    return fn

def refs_extra(*refs):
    def ex(im, W, H, s):
        h = 74 * s; x = 14 * s; y = H - h - 32 * s
        for nm, fx, fy, zz in refs:
            r = src(nm)
            if zz: r = fit(r, r.size[0], r.size[1], fx, fy, zz)
            inset(im, r, (x, y, x + h, y + h), s, fx, fy); x += h + 8 * s
    return ex
R["vid-h3-refs"] = (still_video("vid-h3-refs", .5, .35, extra=refs_extra(("ref-uttu-portrait", .62, .38, 0))), False)
R["vid-vidu"] = (still_video("vid-vidu", .5, .35, extra=refs_extra(("vid-vidu", .33, .2, 3.2), ("vid-vidu", .6, .72, 3.0), ("ref-mars", .5, .5, 0))), False)
R["vid-fluidifier"] = (still_video("vid-fluidifier", .5, .45), False)
R["3d-ouvert"] = (plain("3d-ouvert", .5, .5), False)
R["reperage"] = (plain("reperage", .5, .45), False)

@tool("vid-mouvement")
def _(W, H, s, t):
    im = fit(lift(src("vid-mouvement"), .46), W, H, .62, .5); im = scrim(im, int(H * .7), .5)
    # pose stick figure (the motion to copy), traced from the still, drawn in an inset
    P = {"head": (672, 82), "neck": (672, 140), "ls": (612, 158), "rs": (742, 150), "le": (565, 200), "lw": (528, 148),
         "re": (800, 212), "rw": (836, 262), "lh": (640, 270), "rh": (705, 268), "lk": (562, 372), "la": (552, 492),
         "rk": (760, 400), "ra": (800, 525)}
    h = 96 * s; w = 96 * s; x0, y0 = 14 * s, H - h - 32 * s
    box = Image.new("RGB", (w, h), (18, 18, 20)); d = ImageDraw.Draw(box)
    xs = [p[0] for p in P.values()]; ys = [p[1] for p in P.values()]
    sc = min((w - 20 * s) / (max(xs) - min(xs)), (h - 20 * s) / (max(ys) - min(ys)))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    q = {k: (w / 2 + (v[0] - cx) * sc, h / 2 + (v[1] - cy) * sc) for k, v in P.items()}
    for a, b in [("neck", "ls"), ("neck", "rs"), ("ls", "le"), ("le", "lw"), ("rs", "re"), ("re", "rw"), ("neck", "lh"), ("neck", "rh"), ("lh", "rh"),
                 ("lh", "lk"), ("lk", "la"), ("rh", "rk"), ("rk", "ra")]:
        d.line((*q[a], *q[b]), fill=GOLD, width=3 * s)
    for k, (x, y) in q.items():
        r = (7 if k == "head" else 2.6) * s; d.ellipse((x - r, y - r, x + r, y + r), fill=GOLD_HI if k != "head" else None, outline=GOLD, width=2 * s)
    inset(im, box, (x0, y0, x0 + w, y0 + h), s)
    ImageDraw.Draw(im).line((x0 + w + 8 * s, y0 + h / 2, x0 + w + 24 * s, y0 + h / 2), fill=GOLD, width=2 * s)
    timeline(im, s, .4); return im

@tool("vid-raccord", True)
def _(W, H, s, t):
    a = fit(lift(src("vid-raccord-debut")), W, H); b = fit(lift(src("vid-raccord-fin")), W, H)
    k = .5 if t is None else pingpong(t, .3)
    im = Image.blend(a, b, k) if t is not None else wipe(a, b, .5)[0]
    im = scrim(im, int(H * .7), .5)
    th = 58 * s; y = H - th - 30 * s
    inset(im, src("vid-raccord-debut"), (14 * s, y, 14 * s + round(th * 1.6), y + th), s)
    inset(im, src("vid-raccord-fin"), (W - 14 * s - round(th * 1.6), y, W - 14 * s, y + th), s)
    if t is None: divider(im, W // 2, s)
    timeline(im, s, .5 if t is None else k, marks=(0, 1)); return im

@tool("vid-prolonger", True)
def _(W, H, s, t):
    z = 1.0 if t is None else 1.0 + .10 * t
    im = fit(lift(src("vid-prolonger")), W, H, .45, .5, z); im = scrim(im, int(H * .7), .55)
    d = ImageDraw.Draw(im); y = H - 16 * s; x0, x1 = 18 * s, W - 18 * s; xm = x0 + (x1 - x0) * .55
    p = .82 if t is None else .25 + .73 * t
    d.rounded_rectangle((x0, y - s, x1, y + s), s, fill=(120, 116, 108))
    d.rounded_rectangle((x0, y - s, x0 + (x1 - x0) * min(p, .55), y + s), s, fill=(235, 228, 214))
    if p > .55: d.rounded_rectangle((xm, y - 2 * s, x0 + (x1 - x0) * p, y + 2 * s), 2 * s, fill=GOLD)
    d.rectangle((xm - s, y - 8 * s, xm + s, y + 8 * s), fill=(250, 244, 230))
    xe = x0 + (x1 - x0) * p; d.ellipse((xe - 5 * s, y - 5 * s, xe + 5 * s, y + 5 * s), fill=GOLD_HI)
    return im

def clip_frames(name):
    p = SRC / f"{name}.mp4"
    pr = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)], capture_output=True, text=True).stdout.strip().splitlines()[0].split(",")
    vw, vh = int(pr[0]), int(pr[1])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    return [Image.frombytes("RGB", (vw, vh), raw[i * vw * vh * 3:(i + 1) * vw * vh * 3]) for i in range(len(raw) // (vw * vh * 3))]

def talk(name, fx, fy, side="left", seed=1, target=.5, kind="voice", clip=None):
    env = wave_env(400, seed, kind); cache = {}
    def fn(W, H, s, t):
        if t is None or clip is None: base = src(name)
        else:
            if "f" not in cache: cache["f"] = clip_frames(clip)
            fr = cache["f"]; base = fr[int(t * (len(fr) - 1))]
        im = fit(lift(base, target), W, H, fx, fy); im = scrim(im, int(H * .55), .72)
        ph = 0 if t is None else t * 60
        waveform(im, (18 * s, H - 70 * s, W - 18 * s, H - 18 * s), env, s, ph)
        return im
    return fn
R["vid-parler"] = (talk("vid-parler", .62, .35, seed=4, target=.5, clip="vid-parler-clip"), True)
R["vid-levres"] = (talk("vid-levres", .35, .35, seed=9, clip="vid-levres-clip"), True)
R["son-voix-ouverte"] = (talk("son-voix", .4, .45, seed=2), True)
R["son-bruitage-ouvert"] = (talk("son-bruitage", .5, .45, seed=5, target=.46, kind="fx"), True)

@tool("son-dialogue", True)
def _(W, H, s, t):
    im = fit(lift(src("son-dialogue")), W, H, .5, .4); im = scrim(im, int(H * .55), .72)
    e1 = wave_env(400, 11); e2 = wave_env(400, 12)
    turn = 0 if t is None else (t * 2) % 2
    n = (W - 36 * s) // (5 * s); mid = 18 * s + (W - 36 * s) / 2
    w1 = e1.copy(); w2 = e2.copy()
    ph = 0 if t is None else t * 60
    # two speakers: gold = left speaker, ivory = right speaker; they take turns
    a1 = 1.0 if t is None or turn < 1 else .25; a2 = .35 if t is None else (1.0 if turn >= 1 else .25)
    waveform(im, (18 * s, H - 66 * s, mid - 6 * s, H - 20 * s), w1 * a1, s, ph)
    waveform(im, (mid + 6 * s, H - 66 * s, W - 18 * s, H - 20 * s), w2 * a2, s, ph + 7, color=(240, 232, 216))
    return im

@tool("son-musique-ouverte", True)
def _(W, H, s, t):
    im = fit(lift(src("son-musique"), .5), W, H, .5, .45); im = scrim(im, int(H * .5), .72)
    eq_bars(im, (18 * s, H - 84 * s, W - 18 * s, H - 18 * s), 0.13 if t is None else t, s, n=22); return im

@tool("son-musique-video", True)
def _(W, H, s, t):
    im = fit(lift(src("son-musique-video")), W, H, .4, .45); im = scrim(im, int(H * .55), .7)
    eq_bars(im, (18 * s, H - 70 * s, W - 18 * s, H - 26 * s), 0.21 if t is None else t, s, n=26, seed=8)
    timeline(im, s, .45 if t is None else t); return im

# ---------------------------------------------------------------- render
def save_still(id, fn):
    for (W, H, s, suf) in ((640, 400, 1, ""), (1280, 800, 2, "@2x")):
        im = fn(W, H, s, None)
        im.save(OUT / f"{id}{suf}.webp", "WEBP", quality=82 if s == 1 else 76, method=6)

NF_BY = {"vid-parler": 96, "vid-levres": 96}  # 4 s generated talking clips (first frame = last frame)
VP9_CRF = {"vid-wan": 46, "vid-texte": 46}
X264_CRF = {"vid-wan": 29, "vid-texte": 28}

def save_anim(id, fn):
    W, H = 640, 400
    tmp = OUT / f".{id}.rgb"
    with open(tmp, "wb") as f:
        nf = NF_BY.get(id, NF)
        for i in range(nf): f.write(fn(W, H, 1, i / nf).tobytes())
    base = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", str(tmp)]
    subprocess.run(base + ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", str(VP9_CRF.get(id, 38)), "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", "-an", str(OUT / f"{id}.webm")], check=True)
    subprocess.run(base + ["-c:v", "libx264", "-preset", "slow", "-crf", str(X264_CRF.get(id, 27)), "-profile:v", "main", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(OUT / f"{id}.mp4")], check=True)
    tmp.unlink()

if __name__ == "__main__":
    for id, v in R.items():
        if v is None or (ONLY and id not in ONLY): continue
        fn, anim = v
        save_still(id, fn)
        if anim: save_anim(id, fn)
        print(id, "anim" if anim else "still", flush=True)
