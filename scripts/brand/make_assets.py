"""Brand assets from JD's logo (docs/brand/uttu-logo-jd-source.png).

Rules (JD, PR #115): the complete web mark, never cropped; his original stroke, never thickened.
Only operations: alpha from luminance over the flat graphite background, crop with padding,
high-quality Lanczos downscale (2x/3x files for retina). Run: python3 scripts/brand/make_assets.py
"""
from PIL import Image
import numpy as np
import os, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs/brand/uttu-logo-jd-source.png")
OUT = os.path.join(ROOT, "public/brand")
APP = os.path.join(ROOT, "src/app")
DOCS = os.path.join(ROOT, "docs/brand")

src = np.array(Image.open(SRC).convert("RGB")).astype(np.float64)
BG = 15.0                      # flat background of the source (measured 14–16)
WHITE = 255.0                  # stroke core (measured BG + 240)
FLOOR = 3.0                    # background noise, below this the pixel is background
excess = np.clip(src - BG, 0, None)
lum = excess.max(axis=2)       # brightest channel above background (keeps gold as bright as white)
alpha = np.clip((lum - FLOOR) / (WHITE - BG - FLOOR), 0, 1)
# Keep only real ink: connected shapes whose core is clearly drawn (peak > 60 of 240).
# Drops the faint generator speckle (peaks <= 17, i.e. < 7 % opacity) without touching any stroke.
from scipy import ndimage
labels, n = ndimage.label(alpha > 0, structure=np.ones((3, 3)))
peaks = ndimage.maximum(lum, labels, range(1, n + 1))
keep = np.zeros(n + 1, bool); keep[1:] = peaks > 60
alpha = np.where(keep[labels], alpha, 0)
safe = np.where(alpha > 0, alpha, 1)[..., None]
rgb = np.clip(BG + excess / safe, 0, 255)  # un-premultiply: original colour, original antialiasing
full = Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")

def bbox(mask):
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1

# The web sits above an empty band, then the U*TTU / STUDIO text. Find that band from the data.
rows = (alpha > 0).any(axis=1)
web_rows = np.where(rows)[0]
gap_start = next(y for y in range(web_rows[0], len(rows)) if not rows[y])
web_mask = np.zeros_like(alpha, bool); web_mask[:gap_start] = alpha[:gap_start] > 0
WEB = bbox(web_mask)
LOCK = bbox(alpha > 0)
PAD_MARK, PAD_LOCK = 28, 40

def crop(img, box, pad):
    x0, y0, x1, y1 = box
    return img.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))

mark = crop(full, WEB, PAD_MARK)
lock = crop(full, LOCK, PAD_LOCK)

def lanczos_h(img, h):
    if h >= img.height:
        return img.copy()
    w = round(img.width * h / img.height)
    # resize premultiplied so thin lines keep their antialiasing without dark fringes
    pre = img.convert("RGBa").resize((w, h), Image.LANCZOS)
    return pre.convert("RGBA")

os.makedirs(OUT, exist_ok=True)
mark.save(os.path.join(OUT, "uttu-mark.png"), optimize=True)          # native size, full mark
lock.save(os.path.join(OUT, "uttu-logo.png"), optimize=True)          # native size, full lockup
made = {}
# Header: 48 px tall on mobile, 56 (studio) or 64 (home) on desktop; home hero lockup 180 px tall.
for base, img, heights in [("uttu-mark", mark, (48, 56, 64)), ("uttu-logo", lock, (180,))]:
    for h in heights:
        for k in (1, 2, 3):
            name = f"{base}-h{h}{'' if k == 1 else f'@{k}x'}.png"
            out = lanczos_h(img, h * k)
            out.save(os.path.join(OUT, name), optimize=True)
            made[name] = out.size

# Icons: the mark as is, on graphite. Thin at small sizes; that is JD's line.
G = (15, 15, 17, 255)
def icon(size, scale):
    c = Image.new("RGBA", (size, size), G)
    target = round(size * scale)
    pre = mark.convert("RGBa")
    w, h = (target, round(target * mark.height / mark.width)) if mark.width >= mark.height else (round(target * mark.width / mark.height), target)
    t = pre.resize((w, h), Image.LANCZOS).convert("RGBA")
    c.alpha_composite(t, ((size - w) // 2, (size - h) // 2))
    return c.convert("RGB")
icon(512, .80).save(os.path.join(OUT, "icon-512.png"), optimize=True)
icon(192, .80).save(os.path.join(OUT, "icon-192.png"), optimize=True)
icon(512, .62).save(os.path.join(OUT, "icon-maskable-512.png"), optimize=True)   # inside the 80 % safe zone
icon(180, .80).save(os.path.join(APP, "apple-icon.png"), optimize=True)
icon(64, .92).save(os.path.join(APP, "icon.png"), optimize=True)
ico = [icon(s, .94) for s in (16, 32, 48)]
ico[2].save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])

# Proof: nothing cut, nothing changed.
def proof(img, box, pad, label):
    a = np.array(img)[..., 3]
    border = max(a[:pad // 2].max(), a[-pad // 2:].max(), a[:, :pad // 2].max(), a[:, -pad // 2:].max())
    x0, y0, x1, y1 = box
    region = np.zeros_like(alpha, bool); region[y0 - pad:y1 + pad, x0 - pad:x1 + pad] = True
    sel = web_mask if label == "mark" else alpha > 0
    outside = float((alpha * (sel & ~region)).sum())
    # recomposite the crop over the background and compare with the source pixels
    rgba = np.array(img).astype(np.float64)
    comp = rgba[..., :3] * (rgba[..., 3:] / 255) + BG * (1 - rgba[..., 3:] / 255)
    orig = src[y0 - pad:y1 + pad, x0 - pad:x1 + pad]
    diff = np.abs(comp - orig)
    return {"box_in_source": [x0 - pad, y0 - pad, x1 + pad, y1 + pad], "content_box": list(box), "size": img.size,
            "alpha_on_outer_half_padding": int(border), "ink_outside_crop": outside,
            "recomposite_max_diff": round(float(diff.max()), 2), "recomposite_mean_diff": round(float(diff.mean()), 3)}
report = {"mark": proof(mark, WEB, PAD_MARK, "mark"), "lockup": proof(lock, LOCK, PAD_LOCK, "lockup"), "files": made}
with open(os.path.join(DOCS, "assets-proof.json"), "w") as f:
    json.dump(report, f, indent=2)
print(json.dumps({k: v for k, v in report.items() if k != "files"}, indent=2))
