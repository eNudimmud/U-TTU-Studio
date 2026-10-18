"""Tab icons and link previews from JD's logo (public/brand/uttu-mark.png, uttu-logo.png).

Same rules as make_assets.py: the logo is only scaled (premultiplied Lanczos) and padded on
graphite #0F0F11. Never cropped, never thickened, never redrawn. The SVG icon wraps the scaled
PNG as is (no tracing). Text on the previews is set beside the logo, never over it.
Run: python3 scripts/brand/make_meta.py
"""
from PIL import Image, ImageDraw, ImageFont
import base64, io, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BRAND = os.path.join(ROOT, "public/brand")
APP = os.path.join(ROOT, "src/app")
OG = os.path.join(ROOT, "public/og")
G = (15, 15, 17)
FG = (242, 240, 234)
MUTED = (163, 161, 156)
ACCENT = (201, 167, 91)
FONT = os.environ.get("GEIST_TTF", "/usr/share/fonts/truetype/sand-box/google/Geist/Geist-VariableFont_wght.ttf")

mark = Image.open(os.path.join(BRAND, "uttu-mark.png")).convert("RGBA")
lock = Image.open(os.path.join(BRAND, "uttu-logo.png")).convert("RGBA")

def scaled(img, w=None, h=None):
    if h is None: h = round(w * img.height / img.width)
    if w is None: w = round(h * img.width / img.height)
    return img.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")

def icon(size, scale):
    c = Image.new("RGBA", (size, size), G + (255,))
    t = round(size * scale)
    m = scaled(mark, w=t) if mark.width >= mark.height else scaled(mark, h=t)
    c.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return c.convert("RGB")

# Tab icons: PNG 16/32/48 next to favicon.ico, and an SVG that wraps the 256 px PNG.
for i, s in enumerate((16, 32, 48), start=1):
    icon(s, .94).save(os.path.join(APP, f"icon{i}.png"), optimize=True)
buf = io.BytesIO(); icon(256, .9).save(buf, "PNG", optimize=True)
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
       f'<image width="256" height="256" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/></svg>\n')
open(os.path.join(APP, "icon0.svg"), "w").write(svg)

def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_axes([weight])
    except Exception: pass
    return f

def wrap(draw, text, f, width):
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=f) <= width: line = test
        else: lines.append(line); line = word
    if line: lines.append(line)
    return lines

ROUTES = json.load(open(os.path.join(ROOT, "src/lib/route-meta.json")))
os.makedirs(OG, exist_ok=True)
for route in ROUTES:
    W, H = 1200, 630
    c = Image.new("RGBA", (W, H), G + (255,))
    logo = scaled(lock, h=430)
    c.alpha_composite(logo, (110, (H - logo.height) // 2))
    d = ImageDraw.Draw(c)
    x, width = 110 + logo.width + 90, W - (110 + logo.width + 90) - 80
    title_f, body_f, kick_f = font(54, 640), font(26, 420), font(18, 560)
    t_lines = wrap(d, route["ogTitle"], title_f, width)
    b_lines = wrap(d, route["description"], body_f, width)
    block = 30 + len(t_lines) * 64 + 22 + len(b_lines) * 36
    y = (H - block) // 2
    d.text((x, y), route["kicker"].upper(), font=kick_f, fill=ACCENT)
    y += 40
    for line in t_lines: d.text((x, y), line, font=title_f, fill=FG); y += 64
    y += 18
    for line in b_lines: d.text((x, y), line, font=body_f, fill=MUTED); y += 36
    out = c.convert("RGB")
    out.save(os.path.join(OG, f"{route['id']}.jpg"), quality=90, optimize=True, progressive=True)
    if route["id"] == "accueil": out.save(os.path.join(ROOT, "public/og.jpg"), quality=90, optimize=True, progressive=True)
print("ok", [r["id"] for r in ROUTES])
