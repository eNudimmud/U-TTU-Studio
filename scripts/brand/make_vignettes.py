"""U*TTU — tool card thumbnails, « ce que tu donnes → ce que tu obtiens » (0 credit, nothing generated).

Run from the repo root:  python3 scripts/brand/make_vignettes.py [id ...]
Needs Pillow and ffmpeg. Writes public/exemples/vignettes/<id>.webp (640x400, ~20-50 KB).

Sources, all already in the repo:
  - public/exemples/*.webp        house renders made on Comfy Cloud (see docs/CREDITS.md for model per file)
  - public/exemples/outils/plan-exemple.mp4   the sample clip (a camera push on a still, NOT a video-model render)
  - public/images/uttu-portrait.webp          the canon Uttu portrait
  - scripts/brand/vignettes-sources/*.webp    real captures of the studio (repérage 3D « Trait », maquette PRISE)
                                              and avant-decor-heure.webp = git 3079a0b^:public/exemples/decor-rue-pluie.webp,
                                              the true input of apres-decor-heure (replaced in #109)

Honesty rule: the big picture is a real output of the card's own model only where we have one
(img-klein, img-seedream, img-nano, ret-modifier, reperage, maquette). Every other card shows its real
INPUT plus a gold sign of what the tool does (viewfinder, ▶ + timeline, dashed frame, waveform…), never a
fake result. Those cards wait for real Comfy renders (see SOURCES_A_VENIR below).

Style: result fills the frame with dark edges (#0f0f11); the input sits bottom-left, gold edge + gold arrow;
retouch = before | after wipe; gold is the only accent; no words in the image.
Drawn at 2x then downscaled (anti-aliasing)."""
import io, math, random, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

EX = Path("public/exemples")
SRC = Path("scripts/brand/vignettes-sources")
OUT = EX / "vignettes"
S = 2
W, H = 640 * S, 400 * S
GOLD = (201, 167, 91)
GOLD_HI = (226, 196, 128)
BG = (15, 15, 17)
CARD = (24, 24, 28)
PAPER = (236, 233, 226)
INSET = (22 * S, H - 146 * S, 212 * S, H - 24 * S)          # bottom-left input card
CHIP = (214 * S, H - 85 * S)                                  # gold arrow, right edge of the input
CLIP = EX / "outils/plan-exemple.mp4"

# Cards whose picture stays a sign until a real Comfy render of that very tool exists.
SOURCES_A_VENIR = {
    "img-qwen", "img-flux3", "img-ideogram", "img-gpt", "img-refs", "img-360", "img-croquis",
    "ret-finaliser", "ret-elargir", "ret-detourer", "ret-eclairer",
    "vid-wan", "vid-texte", "vid-raccord", "vid-h3-refs", "vid-vidu", "vid-prolonger", "vid-parler", "vid-finaliser",
    "vid-recadrer", "vid-detourer", "vid-levres", "vid-effacer", "vid-fluidifier", "vid-mouvement",
    "3d-ouvert", "son-voix-ouverte", "son-dialogue", "son-musique-ouverte", "son-bruitage-ouvert", "son-musique-video",
}

# ── sources ────────────────────────────────────────────────────────────────
def img(name):
    path = SRC / name if (SRC / name).exists() else EX / name
    if name.startswith("images/"):
        path = Path("public") / name
    return Image.open(path).convert("RGB")

_frames = {}
def frame(at):
    if at not in _frames:
        raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-ss", str(at), "-i", str(CLIP), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"])
        _frames[at] = Image.open(io.BytesIO(raw)).convert("RGB")
    return _frames[at]

def crop_box(im, box):
    """box in 0..1 of the source: (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    return im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))

def cover(im, w, h, cx=.5, cy=.5, zoom=1.0):
    r = max(w / im.width, h / im.height) * zoom
    im = im.resize((max(w, round(im.width * r)), max(h, round(im.height * r))), Image.LANCZOS)
    x = min(max(round(cx * im.width - w / 2), 0), im.width - w)
    y = min(max(round(cy * im.height - h / 2), 0), im.height - h)
    return im.crop((x, y, x + w, y + h))

def sketch(im):
    """The repérage « Trait » capture as a pencil drawing: dark lines on paper."""
    g = ImageOps.grayscale(im)
    g = ImageEnhance.Contrast(g).enhance(1.4)
    return ImageOps.colorize(g, black=(40, 38, 44), white=PAPER)

# ── drawing helpers ────────────────────────────────────────────────────────
def vignetting(im, strength=.55):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse((-W * .25, -H * .35, W * 1.25, H * 1.35), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(W * .12))
    return Image.composite(im, Image.blend(im, Image.new("RGB", (W, H), BG), strength), m)

def background(im, cx=.5, cy=.5, zoom=1.0, bright=1.0, sat=1.0, strength=.4):
    im = cover(im, W, H, cx, cy, zoom)
    if bright != 1: im = ImageEnhance.Brightness(im).enhance(bright)
    if sat != 1: im = ImageEnhance.Color(im).enhance(sat)
    return vignetting(im, strength).convert("RGBA")

def stage():
    """Dark studio floor for cards that have no result picture yet: soft light + faint grid."""
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    for x in range(0, W, 40 * S): d.line((x, 0, x, H), fill=(22, 22, 26), width=S)
    for y in range(0, H, 40 * S): d.line((0, y, W, y), fill=(22, 22, 26), width=S)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W * .25, H * .0, W * 1.05, H * .95), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(90 * S))
    im = Image.composite(Image.new("RGB", (W, H), (34, 33, 38)), im, glow)
    return vignetting(im, .5).convert("RGBA")

def rounded(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m

def shadow(base, box, r, blur=18, alpha=150):
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(box, r, fill=(0, 0, 0, alpha))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))

def paste_card(base, im, box, r=10 * S, border=GOLD, bw=2 * S, fit=True):
    x0, y0, x1, y1 = [round(v) for v in box]
    shadow(base, (x0 + 4, y0 + 8, x1 + 4, y1 + 8), r)
    card = (cover(im, x1 - x0, y1 - y0) if fit else im.resize((x1 - x0, y1 - y0), Image.LANCZOS)).convert("RGBA")
    base.paste(card, (x0, y0), rounded(card.size, r))
    if border: ImageDraw.Draw(base).rounded_rectangle((x0, y0, x1, y1), r, outline=border, width=bw)

def photo(im):
    """An image given as input: a photo with a white margin."""
    return ImageOps.expand(cover(im, 360, 226), border=12, fill=PAPER)

def arrow_chip(base, cx, cy, rad=20 * S, direction="right"):
    d = ImageDraw.Draw(base)
    d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=GOLD)
    a = rad * .42
    if direction == "right":
        d.line([(cx - a * 1.1, cy), (cx + a * .9, cy)], fill=BG, width=4 * S)
        d.line([(cx - a * .1, cy - a), (cx + a * .9, cy), (cx - a * .1, cy + a)], fill=BG, width=4 * S, joint="curve")
    else:  # ‹ › handle of a wipe
        for s in (-1, 1):
            d.line([(cx + s * a * .3, cy - a), (cx + s * a * 1.15, cy), (cx + s * a * .3, cy + a)], fill=BG, width=4 * S, joint="curve")

def given(base, im, box=INSET, chip=CHIP):
    paste_card(base, im, box)
    if chip: arrow_chip(base, *chip)

def lines_glyph(size=(190 * S, 122 * S), shares=(1, .82, .58), first_gold=True):
    """A written consigne without words: grey lines, the first in gold."""
    w, h = size
    im = Image.new("RGB", size, CARD)
    d = ImageDraw.Draw(im)
    lh = h / (len(shares) + 1.6)
    th = max(2 * S, min(4 * S, lh * .16))
    for i, share in enumerate(shares):
        y = lh * (1 + i) + lh * .2
        d.rounded_rectangle((w * .14, y - th, w * .14 + w * .72 * share, y + th), th, fill=GOLD if (i == 0 and first_gold) else (200, 200, 208))
    return im

def paragraph_glyph():
    return lines_glyph(shares=(.7, 1, .96, 1, .9, .98, .62))

def checklist_glyph(size=(190 * S, 122 * S)):
    w, h = size
    im = Image.new("RGB", size, CARD)
    d = ImageDraw.Draw(im)
    for i, share in enumerate((.9, .7, .8)):
        y = h * (.26 + i * .25)
        d.line([(w * .13, y), (w * .17, y + 6 * S), (w * .25, y - 7 * S)], fill=GOLD, width=3 * S, joint="curve")
        d.rounded_rectangle((w * .32, y - 4 * S, w * .32 + w * .56 * share, y + 4 * S), 4 * S, fill=(200, 200, 208))
    return im

def wave_glyph(size=(190 * S, 122 * S), seed=4, col=GOLD):
    im = Image.new("RGB", size, CARD)
    waveform(im, (size[0] * .12, size[1] * .5, size[0] * .88), size[1] * .3, n=22, seed=seed, col=col, glow=False)
    return im

def strip_glyph(frames, size=(190 * S, 122 * S)):
    """A video given as input: three frames on a film strip."""
    w, h = size
    im = Image.new("RGB", size, (8, 8, 10))
    d = ImageDraw.Draw(im)
    fw = (w - 16 * S) / 3
    for i, f in enumerate(frames):
        x = round(4 * S + i * (fw + 4 * S))
        im.paste(cover(f, round(fw), round(h * .62)), (x, round(h * .19)))
    for x in range(6 * S, w, 14 * S):
        d.rounded_rectangle((x, 5 * S, x + 7 * S, 13 * S), 2 * S, fill=(70, 70, 78))
        d.rounded_rectangle((x, h - 13 * S, x + 7 * S, h - 5 * S), 2 * S, fill=(70, 70, 78))
    return im

def map_glyph(size=(190 * S, 122 * S)):
    w, h = size
    tile = Image.new("RGB", size, (22, 22, 26))
    td = ImageDraw.Draw(tile)
    rng = random.Random(3)
    for _ in range(9):
        y = rng.randint(0, h); td.line((0, y, w, y + rng.randint(-60, 60) * S), fill=(60, 60, 68), width=rng.choice([2, 3, 5]) * S)
    for _ in range(7):
        x = rng.randint(0, w); td.line((x, 0, x + rng.randint(-60, 60) * S, h), fill=(60, 60, 68), width=rng.choice([2, 3]) * S)
    td.ellipse((w * .5 - 10 * S, h * .5 - 10 * S, w * .5 + 10 * S, h * .5 + 10 * S), fill=GOLD)
    return tile

def waveform(base, span, amp_max, n=74, seed=7, col=GOLD, glow=True, regular=False, env=None):
    x0, cy, x1 = span
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = random.Random(seed)
    step = (x1 - x0) / n
    for i in range(n):
        t = i / (n - 1)
        e = env(t) if env else .35 + .65 * math.sin(math.pi * min(1, t * 1.15)) ** .6
        a = e * ((.7 + .3 * math.sin(t * 40)) if regular else (.45 + .55 * rng.random())) * amp_max
        x = x0 + i * step
        d.rounded_rectangle((x, cy - a, x + step * .52, cy + a), max(1, int(step * .26)), fill=col + (235,))
    if base.mode != "RGBA":
        base.paste(layer, (0, 0), layer); return
    if glow: base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(10 * S)))
    base.alpha_composite(layer)

def viewfinder(base, box, col=GOLD, arm=34 * S, w=4 * S):
    """The frame the result will fill: four gold corners."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(base)
    for (x, y, sx, sy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        d.line([(x, y + sy * arm), (x, y), (x + sx * arm, y)], fill=col, width=w, joint="curve")

def dashed_rect(base, box, col=GOLD, w=3 * S, dash=14 * S, gap=10 * S):
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(base)
    for (a, b, horiz, fixed) in ((x0, x1, True, y0), (x0, x1, True, y1), (y0, y1, False, x0), (y0, y1, False, x1)):
        p = a
        while p < b:
            q = min(p + dash, b)
            d.line((p, fixed, q, fixed) if horiz else (fixed, p, fixed, q), fill=col, width=w)
            p = q + gap

def dashed_ellipse(base, box, col=GOLD, w=3 * S, n=40):
    x0, y0, x1, y1 = box
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    d = ImageDraw.Draw(base)
    for i in range(n):
        if i % 2: continue
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        pts = [(cx + rx * math.cos(a0 + (a1 - a0) * k / 6), cy + ry * math.sin(a0 + (a1 - a0) * k / 6)) for k in range(7)]
        d.line(pts, fill=col, width=w)

def hatch(base, box, col=(201, 167, 91, 60), step=16 * S):
    x0, y0, x1, y1 = [round(v) for v in box]
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for k in range(-(y1 - y0), x1 - x0, step):
        d.line((x0 + k, y1, x0 + k + (y1 - y0), y0), fill=col, width=2 * S)
    m = Image.new("L", base.size, 0)
    ImageDraw.Draw(m).rectangle((x0, y0, x1, y1), fill=255)
    base.paste(Image.alpha_composite(base, layer), (0, 0), m)

def checker(size, cell=18 * S):
    im = Image.new("RGB", size, (40, 40, 46))
    d = ImageDraw.Draw(im)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2: d.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(58, 58, 66))
    return im

def play(base, cx=None, cy=None, r=34 * S, timeline=True, at=.62, t0=246 * S):
    """The video sign: ▶ and a timeline bar along the bottom."""
    cx = int(W * .66) if cx is None else cx
    cy = int(H * .44) if cy is None else cy
    d = ImageDraw.Draw(base)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(15, 15, 17, 160), outline=GOLD, width=2 * S)
    d.polygon([(cx - r * .3, cy - r * .45), (cx + r * .5, cy), (cx - r * .3, cy + r * .45)], fill=GOLD)
    if timeline:
        y = H - 26 * S
        d.rounded_rectangle((t0, y - 3 * S, W - 28 * S, y + 3 * S), 3 * S, fill=(255, 255, 255, 70))
        px = t0 + int((W - 28 * S - t0) * at)
        d.rounded_rectangle((t0, y - 3 * S, px, y + 3 * S), 3 * S, fill=GOLD)
        d.ellipse((px - 8 * S, y - 8 * S, px + 8 * S, y + 8 * S), fill=GOLD_HI)

def picture_mark(base, box, col=GOLD):
    """An image placeholder (sun + hills) inside a viewfinder: « une image ici »."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    d = ImageDraw.Draw(base)
    r = min(w, h) * .1
    d.ellipse((x0 + w * .66 - r, y0 + h * .26 - r, x0 + w * .66 + r, y0 + h * .26 + r), fill=col)
    d.polygon([(x0 + w * .08, y0 + h * .86), (x0 + w * .38, y0 + h * .4), (x0 + w * .56, y0 + h * .66), (x0 + w * .68, y0 + h * .52), (x0 + w * .92, y0 + h * .86)], outline=col, width=5 * S)

def sparkle(base, cx, cy, r, col=GOLD_HI):
    d = ImageDraw.Draw(base)
    k = r * .22
    d.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=col)

def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf", "/Library/Fonts/Georgia Bold.ttf", "C:/Windows/Fonts/georgiab.ttf"):
        if Path(path).exists(): return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)

def finish(base, name):
    im = base.convert("RGB").resize((W // S, H // S), Image.LANCZOS)
    im.save(OUT / f"{name}.webp", quality=82, method=6)
    print(f"{name:22s} {(OUT / f'{name}.webp').stat().st_size // 1024:3d} KB{'  (sign, waits for a render)' if name in SOURCES_A_VENIR else ''}")

VF = (250 * S, 46 * S, W - 40 * S, H - 64 * S)   # viewfinder for cards without a result yet

# ── CRÉER ──────────────────────────────────────────────────────────────────
def t2i_real(name, src, cx=.5, cy=.5, zoom=1.0):
    """Text → image with a real render of that very model (file name or an already-cropped Image)."""
    base = background(src if isinstance(src, Image.Image) else img(src), cx, cy, zoom, strength=.35)
    given(base, lines_glyph())
    finish(base, name)

def t2i_sign(name, glyph, mark):
    base = stage()
    viewfinder(base, VF)
    mark(base)
    given(base, glyph)
    finish(base, name)

def mark_picture(base): picture_mark(base, (300 * S, 80 * S, W - 80 * S, H - 96 * S))

def mark_detailed(base):
    picture_mark(base, (300 * S, 66 * S, W - 80 * S, H - 160 * S))
    d = ImageDraw.Draw(base)
    for i, share in enumerate((1, .86, .66)):   # legible text inside the picture
        y = H - 140 * S + i * 22 * S
        d.rounded_rectangle((300 * S, y, 300 * S + 260 * S * share, y + 9 * S), 5 * S, fill=(200, 200, 208))

def mark_quality(base):
    mark_picture(base)
    sparkle(base, 300 * S, 92 * S, 26 * S)
    sparkle(base, 338 * S, 136 * S, 13 * S)

def mark_letters(base):
    d = ImageDraw.Draw(base)
    f = font(190 * S)
    cx, cy = (VF[0] + VF[2]) / 2, (VF[1] + VF[3]) / 2
    d.text((cx, cy + 6 * S), "Aa", font=f, fill=GOLD, anchor="mm")
    d.rounded_rectangle((cx - 120 * S, VF[3] - 44 * S, cx + 120 * S, VF[3] - 36 * S), 4 * S, fill=(200, 200, 208, 200))

def mark_checked(base):
    mark_picture(base)
    d = ImageDraw.Draw(base)
    cx, cy, r = 300 * S, 96 * S, 26 * S
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD)
    d.line([(cx - r * .45, cy), (cx - r * .1, cy + r * .38), (cx + r * .5, cy - r * .38)], fill=BG, width=4 * S, joint="curve")

def img_refs():
    base = stage()
    viewfinder(base, VF)
    mark_picture(base)
    paste_card(base, photo(crop_box(img("cast-coursiere.webp"), (.02, .05, .24, .95))), (22 * S, 40 * S, 150 * S, 230 * S), r=8 * S)
    given(base, photo(img("decor-rue-pluie.webp")))
    finish(base, "img-refs")

def img_360():
    base = stage()
    d = ImageDraw.Draw(base)
    x0, y0, x1, y1 = VF
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for k in range(1, 6):                      # equirectangular meridians
        a = (x1 - x0) / 2 * k / 5.4
        d.arc((cx - a, y0 + 14 * S, cx + a, y1 - 14 * S), 0, 360, fill=GOLD + (120 + 20 * k,), width=2 * S)
    for k in (-2, -1, 0, 1, 2):                # parallels
        y = cy + k * (y1 - y0) * .18
        d.line((x0 + 20 * S, y, x1 - 20 * S, y), fill=GOLD + (150,), width=2 * S)
    d.line((cx, y0 + 14 * S, cx, y1 - 14 * S), fill=GOLD, width=3 * S)
    viewfinder(base, VF)
    given(base, lines_glyph())
    finish(base, "img-360")

def img_croquis():
    base = stage()
    sk = sketch(img("reperage-trait.webp"))
    inner = cover(sk, VF[2] - VF[0] - 40 * S, VF[3] - VF[1] - 40 * S)
    lines = ImageOps.invert(ImageOps.grayscale(inner)).point(lambda v: min(255, int(v * 1.4)))
    layer = Image.new("RGBA", inner.size, GOLD + (0,))
    layer.putalpha(lines.point(lambda v: int(v * .55)))
    base.alpha_composite(layer, (VF[0] + 20 * S, VF[1] + 20 * S))
    viewfinder(base, VF)
    given(base, sk)
    finish(base, "img-croquis")

# ── RETOUCHER ──────────────────────────────────────────────────────────────
def ret_modifier():
    """Real Comfy pair: the rain street (Seedream 4.5, version before #109) → same street at dawn (Nano Banana 2.1 edit)."""
    before = ImageEnhance.Brightness(cover(img("avant-decor-heure.webp"), W, H, .5, .55)).enhance(.92)
    after = cover(img("apres-decor-heure.webp"), W, H, .5, .55)
    split = int(W * .46)
    base = after.copy()
    base.paste(before.crop((0, 0, split, H)), (0, 0))
    base = vignetting(base, .35).convert("RGBA")
    ImageDraw.Draw(base).rectangle((split - S, 0, split + S, H), fill=GOLD)
    arrow_chip(base, split, H // 2, rad=32 * S, direction="wipe")
    finish(base, "ret-modifier")

def ret_finaliser():
    base = stage()
    face = crop_box(img("cast-vieil-homme.webp"), (.02, .1, .2, .55))
    small = (40 * S, 150 * S, 260 * S, 360 * S)
    big = (40 * S, 40 * S, 600 * S, 360 * S)
    dashed_rect(base, big)
    d = ImageDraw.Draw(base)
    for (ax, ay) in ((600 * S, 40 * S),):     # « ×2 » arrow from the small corner to the big one
        d.line([(272 * S, 138 * S), (ax - 18 * S, ay + 18 * S)], fill=GOLD, width=4 * S)
        d.polygon([(ax - 8 * S, ay + 8 * S), (ax - 40 * S, ay + 14 * S), (ax - 14 * S, ay + 40 * S)], fill=GOLD)
    paste_card(base, face, small)
    finish(base, "ret-finaliser")

def ret_elargir():
    base = stage()
    hatch(base, (30 * S, 30 * S, W - 30 * S, H - 30 * S))
    inner = (150 * S, 92 * S, W - 150 * S, H - 92 * S)
    paste_card(base, img("decor-toit-aube.webp"), inner, r=4 * S, border=None)
    dashed_rect(base, (30 * S, 30 * S, W - 30 * S, H - 30 * S))
    d = ImageDraw.Draw(base)
    for (x, y, dx, dy) in ((inner[0] - 14 * S, H // 2, -1, 0), (inner[2] + 14 * S, H // 2, 1, 0), (W // 2, inner[1] - 14 * S, 0, -1), (W // 2, inner[3] + 14 * S, 0, 1)):
        d.line((x, y, x + dx * 60 * S, y + dy * 36 * S), fill=GOLD, width=4 * S)
        tx, ty = x + dx * 72 * S, y + dy * 46 * S
        d.polygon([(tx, ty), (tx - dx * 14 * S - dy * 10 * S, ty - dy * 14 * S - dx * 10 * S), (tx - dx * 14 * S + dy * 10 * S, ty - dy * 14 * S + dx * 10 * S)], fill=GOLD)
    finish(base, "ret-elargir")

def cutout_sign(base, im, ell):
    """Checkerboard (transparent) around a dashed gold ellipse on the subject — the cut is not drawn."""
    ch = checker((W, H)).convert("RGBA")
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).ellipse(ell, fill=255)
    base.paste(ch, (0, 0), ImageOps.invert(m).point(lambda v: int(v * .78)))
    dashed_ellipse(base, ell)

def ret_detourer():
    base = background(crop_box(img("cast-dj.webp"), (.78, .02, .98, .7)), .5, .2, strength=.25)
    cutout_sign(base, None, (W * .2, H * .02, W * .8, H * 1.3))
    finish(base, "ret-detourer")

def ret_eclairer():
    base = background(crop_box(img("cast-vieil-homme.webp"), (0, .02, .2, .6)), .5, .45, bright=.8, strength=.35)
    d = ImageDraw.Draw(base)
    cx, cy, r = W - 108 * S, 104 * S, 30 * S                 # gold light source + rays
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GOLD)
    for k in range(10):
        a = 2 * math.pi * k / 10
        d.line((cx + math.cos(a) * r * 1.5, cy + math.sin(a) * r * 1.5, cx + math.cos(a) * r * 2.2, cy + math.sin(a) * r * 2.2), fill=GOLD, width=4 * S)
    d.arc((W * .18, H * .02, W - 60 * S, H * 1.3), 200, 330, fill=GOLD + (150,), width=3 * S)   # the light's path
    finish(base, "ret-eclairer")

# ── VIDÉO ──────────────────────────────────────────────────────────────────
def vid_still(name, src, inset_im, cx=.5, cy=.5, **kw):
    """Image(s) → shot: the given picture fills the frame, ▶ + timeline say « it will move »."""
    base = background(src, cx, cy, bright=.85, strength=.35)
    play(base, **kw)
    if inset_im is not None: given(base, inset_im)
    return base

def vid_wan():
    still = img("decor-quai-nuit.webp")
    finish(vid_still("vid-wan", still, photo(still)), "vid-wan")

def vid_texte():
    base = stage()
    viewfinder(base, VF)
    play(base, cx=(VF[0] + VF[2]) // 2, cy=(VF[1] + VF[3]) // 2)
    given(base, lines_glyph())
    finish(base, "vid-texte")

def vid_raccord():
    base = stage()
    a, b = (40 * S, 70 * S, 290 * S, 226 * S), (350 * S, 70 * S, 600 * S, 226 * S)
    paste_card(base, img("decor-rue-pluie.webp"), a)
    paste_card(base, img("apres-decor-heure.webp"), b)
    d = ImageDraw.Draw(base)
    d.arc((165 * S, 120 * S, 475 * S, 340 * S), 20, 160, fill=GOLD, width=5 * S)
    arrow_chip(base, 320 * S, 330 * S)
    play(base, cx=W // 2, cy=148 * S, r=28 * S, t0=40 * S)
    finish(base, "vid-raccord")

def refs_video(name, refs):
    base = stage()
    viewfinder(base, VF)
    play(base, cx=(VF[0] + VF[2]) // 2, cy=(VF[1] + VF[3]) // 2)
    y = 40 * S
    for im in refs[:-1]:
        paste_card(base, photo(im), (22 * S, y, 150 * S, y + 96 * S), r=8 * S)
        y += 108 * S
    given(base, photo(refs[-1]))
    finish(base, name)

def vid_prolonger():
    base = stage()
    fw, fh, y = 132 * S, 84 * S, 140 * S
    for i, at in enumerate((0, 1, 2, 2.9)):
        paste_card(base, frame(at), (24 * S + i * (fw + 8 * S), y, 24 * S + i * (fw + 8 * S) + fw, y + fh), r=6 * S, border=None)
    x = 24 * S + 4 * (fw + 8 * S)
    for k in range(2):
        dashed_rect(base, (x + k * (fw + 8 * S), y, x + k * (fw + 8 * S) + fw, y + fh), w=2 * S)
    arrow_chip(base, x - 4 * S, y + fh // 2)
    play(base, cx=W // 2, cy=72 * S, r=26 * S, t0=40 * S, at=.7)
    finish(base, "vid-prolonger")

def vid_parler():
    face = crop_box(img("cast-vieil-homme.webp"), (0, .02, .2, .6))
    base = vid_still("vid-parler", face, None, cy=.4)
    waveform(base, (300 * S, 300 * S, W - 40 * S), 26 * S, n=40, seed=11)
    paste_card(base, photo(face), (22 * S, 40 * S, 150 * S, 136 * S), r=8 * S)
    given(base, wave_glyph())
    finish(base, "vid-parler")

def vid_finaliser():
    base = stage()
    dashed_rect(base, (40 * S, 40 * S, 600 * S, 360 * S))
    play(base, cx=440 * S, cy=150 * S)
    d = ImageDraw.Draw(base)
    d.line([(272 * S, 228 * S), (582 * S, 58 * S)], fill=GOLD, width=4 * S)
    d.polygon([(592 * S, 48 * S), (560 * S, 54 * S), (586 * S, 80 * S)], fill=GOLD)
    paste_card(base, frame(1.5), (40 * S, 220 * S, 264 * S, 360 * S))
    finish(base, "vid-finaliser")

def vid_recadrer():
    base = stage()
    hatch(base, (40 * S, 40 * S, W - 40 * S, H - 40 * S))
    tall = (W // 2 - 90 * S, 40 * S, W // 2 + 90 * S, H - 40 * S)
    paste_card(base, cover(frame(1.5), 180, 320, .55), tall, r=4 * S, border=None)
    dashed_rect(base, (40 * S, 40 * S, W - 40 * S, H - 40 * S))
    ImageDraw.Draw(base).rectangle(tall, outline=GOLD, width=3 * S)
    play(base, cx=W // 2, cy=H // 2, r=28 * S, timeline=False)
    finish(base, "vid-recadrer")

def vid_detourer():
    base = background(frame(1.5), .5, .5, strength=.3)
    cutout_sign(base, None, (W * .06, H * .3, W * .5, H * 1.1))
    play(base, cx=int(W * .74), cy=int(H * .4))
    finish(base, "vid-detourer")

def vid_levres():
    face = crop_box(img("cast-vieil-homme.webp"), (0, .02, .2, .6))
    base = background(face, .5, .4, bright=.85, strength=.35)
    dashed_ellipse(base, (W * .42, H * .5, W * .62, H * .66))       # the mouth
    play(base, cx=int(W * .8), cy=int(H * .3), r=28 * S)
    given(base, wave_glyph(seed=21))
    finish(base, "vid-levres")

def vid_effacer():
    base = background(frame(1.5), .5, .5, strength=.3)
    dashed_ellipse(base, (W * .1, H * .38, W * .42, H * .98))        # the object to remove: the bollard
    play(base, cx=int(W * .7), cy=int(H * .4))
    finish(base, "vid-effacer")

def vid_fluidifier():
    base = stage()
    for i, (at, alpha) in enumerate(((0, .35), (1.4, .6), (2.9, 1))):
        box = (50 * S + i * 70 * S, 60 * S + i * 30 * S, 50 * S + i * 70 * S + 380 * S, 60 * S + i * 30 * S + 238 * S)
        layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        paste_card(layer, frame(at), box, r=6 * S, border=GOLD if i == 2 else None)
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
        base.alpha_composite(layer)
    play(base, cx=int(W * .62), cy=int(H * .55), r=28 * S, timeline=False)
    finish(base, "vid-fluidifier")

def vid_mouvement():
    hero = crop_box(img("cast-coursiere.webp"), (.0, .02, .25, .98))
    base = background(hero, .5, .35, bright=.75, strength=.4)
    d = ImageDraw.Draw(base)
    for k, a in enumerate((.6, .8, 1)):            # motion arcs
        d.arc((W * .52, H * .12 + k * 22 * S, W * .98, H * .7 + k * 22 * S), 230, 330, fill=GOLD + (int(255 * a),), width=4 * S)
    play(base, cx=int(W * .8), cy=int(H * .62), r=28 * S)
    given(base, strip_glyph([frame(0), frame(1.4), frame(2.9)]))
    finish(base, "vid-mouvement")

# ── 3D ─────────────────────────────────────────────────────────────────────
def troisd_ouvert():
    base = stage()
    d = ImageDraw.Draw(base)
    cx, cy = 430 * S, 196 * S
    for k in range(6):                         # wire sphere: meridians + parallels
        rx = 120 * S * abs(math.cos(math.pi * k / 6))
        d.ellipse((cx - rx, cy - 120 * S, cx + rx, cy + 120 * S), outline=GOLD + (200,), width=2 * S)
    for k in (-2, -1, 0, 1, 2):
        y = cy + k * 44 * S
        rx = math.sqrt(max(0, (120 * S) ** 2 - (k * 44 * S) ** 2))
        d.ellipse((cx - rx, y - rx * .18, cx + rx, y + rx * .18), outline=GOLD + (150,), width=2 * S)
    d.ellipse((cx - 170 * S, 318 * S, cx + 170 * S, 362 * S), outline=GOLD, width=3 * S)   # turntable
    d.arc((cx - 190 * S, 300 * S, cx + 190 * S, 380 * S), 20, 70, fill=GOLD, width=4 * S)
    given(base, photo(cover(img("images/uttu-portrait.webp"), 600, 380, .5, .3)))
    finish(base, "3d-ouvert")

def reperage():
    view = ImageOps.colorize(ImageOps.grayscale(ImageOps.invert(img("reperage-trait.webp"))), black=BG, white=(214, 208, 196), mid=(92, 90, 96))
    base = background(view, .5, .5, 1.08, strength=.45)
    d = ImageDraw.Draw(base)
    px, py, r = int(W * .5), int(H * .44), 26 * S
    d.ellipse((px - 46 * S, py + 30 * S, px + 46 * S, py + 50 * S), outline=GOLD + (170,), width=2 * S)
    d.polygon([(px - r * .82, py - r * .2), (px, py + 40 * S), (px + r * .82, py - r * .2)], fill=GOLD)
    d.ellipse((px - r, py - r * 1.8, px + r, py + r * .2), fill=GOLD)
    d.ellipse((px - r * .38, py - r * 1.18, px + r * .38, py - r * .42), fill=BG)
    given(base, map_glyph())
    finish(base, "reperage")

def maquette():
    """Real capture of the PRISE maquette (two stand-ins on the quay décor); the gold corners = the camera frame."""
    base = background(img("maquette.webp"), .5, .5, strength=.3)
    viewfinder(base, (150 * S, 40 * S, W - 150 * S, H - 40 * S))
    finish(base, "maquette")

# ── SON ────────────────────────────────────────────────────────────────────
def sound(name, src, glyph, **wave):
    base = background(src, .5, .5, bright=.42, strength=.5)
    waveform(base, (150 * S, int(H * .42), W - 34 * S), 112 * S, **wave)
    given(base, glyph)
    finish(base, name)

def son_dialogue():
    base = background(img("decor-piece.webp"), .5, .5, bright=.42, strength=.5)
    waveform(base, (150 * S, int(H * .3), W - 34 * S), 62 * S, n=60, seed=3, env=lambda t: 1 if (t * 4) % 2 < 1 else .08)
    waveform(base, (150 * S, int(H * .58), W - 34 * S), 62 * S, n=60, seed=5, col=(200, 200, 208), env=lambda t: .08 if (t * 4) % 2 < 1 else 1)
    given(base, lines_glyph(shares=(.8, .6, .9, .5)))
    finish(base, "son-dialogue")

def son_musique_video():
    base = background(frame(1.5), .5, .5, bright=.45, strength=.5)
    waveform(base, (150 * S, int(H * .42), W - 34 * S), 100 * S, regular=True, env=lambda t: .5 + .5 * abs(math.sin(t * math.pi * 6)))
    given(base, strip_glyph([frame(0), frame(1.4), frame(2.9)]))
    finish(base, "son-musique-video")

CARDS = {
    "img-klein": lambda: t2i_real("img-klein", "decor-gare.webp"),
    "img-qwen": lambda: t2i_sign("img-qwen", paragraph_glyph(), mark_detailed),
    "img-flux3": lambda: t2i_sign("img-flux3", lines_glyph(), mark_quality),
    "img-ideogram": lambda: t2i_sign("img-ideogram", lines_glyph(shares=(.5, 1, .7)), mark_letters),
    "img-gpt": lambda: t2i_sign("img-gpt", checklist_glyph(), mark_checked),
    "img-seedream": lambda: t2i_real("img-seedream", "decor-piece.webp", .6, .5),
    "img-nano": lambda: t2i_real("img-nano", "apres-decor-texte.webp"),
    "img-refs": img_refs, "img-360": img_360, "img-croquis": img_croquis,
    "ret-modifier": ret_modifier, "ret-finaliser": ret_finaliser, "ret-elargir": ret_elargir,
    "ret-detourer": ret_detourer, "ret-eclairer": ret_eclairer,
    "vid-wan": vid_wan, "vid-texte": vid_texte, "vid-raccord": vid_raccord,
    "vid-h3-refs": lambda: refs_video("vid-h3-refs", [crop_box(img("cast-coursiere.webp"), (.02, .05, .24, .95)), img("decor-quai-nuit.webp")]),
    "vid-vidu": lambda: refs_video("vid-vidu", [img("decor-gare.webp"), crop_box(img("cast-dj.webp"), (0, 0, .3, .7))]),
    "vid-prolonger": vid_prolonger, "vid-parler": vid_parler, "vid-finaliser": vid_finaliser,
    "vid-recadrer": vid_recadrer, "vid-detourer": vid_detourer, "vid-levres": vid_levres,
    "vid-effacer": vid_effacer, "vid-fluidifier": vid_fluidifier, "vid-mouvement": vid_mouvement,
    "3d-ouvert": troisd_ouvert, "reperage": reperage, "maquette": maquette,
    "son-voix-ouverte": lambda: sound("son-voix-ouverte", crop_box(img("cast-vieil-homme.webp"), (0, 0, .26, .9)), lines_glyph(), seed=9, env=lambda t: .3 + .7 * abs(math.sin(t * math.pi * 3.2))),
    "son-dialogue": son_dialogue,
    "son-musique-ouverte": lambda: sound("son-musique-ouverte", img("decor-toit-aube.webp"), lines_glyph(), regular=True, env=lambda t: .45 + .55 * math.sin(math.pi * t) ** 2),
    "son-bruitage-ouvert": lambda: sound("son-bruitage-ouvert", img("decor-rue-pluie.webp"), lines_glyph(), seed=7),
    "son-musique-video": son_musique_video,
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name in (sys.argv[1:] or CARDS):
        CARDS[name]()
