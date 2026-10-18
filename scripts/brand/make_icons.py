"""App, tab and home-screen icons from JD's web mark (public/brand/uttu-mark.png).

The mark is only scaled (premultiplied Lanczos) and centred on Obsidian #0F0F11: never cropped,
never thickened, never redrawn. File names carry a version (ICON_V) so installed apps and
browser caches fetch the new files; bump it whenever the icons change.

Safe zones (the whole web stays inside, corners and tips included):
- maskable 512: the mark's bounding box fits inside the 80 % circle Android masks with
  (box diagonal <= 0.8 x side), with a small extra margin;
- "any" icons and apple-touch: the box fits inside the iOS / Android squircle corners.
Run: python3 scripts/brand/make_icons.py
"""
import base64, io, math, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BRAND = os.path.join(ROOT, "public/brand")
APP = os.path.join(ROOT, "src/app")
ICON_V = "v3"
G = (15, 15, 17, 255)

mark = Image.open(os.path.join(BRAND, "uttu-mark.png")).convert("RGBA")
box = mark.getbbox()
mark = mark.crop(box) if box else mark  # trims only fully transparent padding: no ink is touched
ratio = mark.height / mark.width
DIAG = math.hypot(1, ratio)

def icon(size, share):
    """share = width of the mark as a share of the side."""
    c = Image.new("RGBA", (size, size), G)
    w = max(1, round(size * share)); h = max(1, round(w * ratio))
    t = mark.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
    c.alpha_composite(t, ((size - w) // 2, (size - h) // 2))
    return c.convert("RGB")

MASKABLE = round(0.76 / DIAG, 3)   # inside the 80 % circle, with a margin
ANY = round(0.90 / DIAG, 3)        # inside a squircle and a circle launcher mask
TAB = 0.92                         # tabs are square, unmasked

if __name__ == "__main__":
    made = {}
    for name, size, share in [(f"icon-{ICON_V}-192.png", 192, ANY), (f"icon-{ICON_V}-512.png", 512, ANY), (f"icon-{ICON_V}-maskable-512.png", 512, MASKABLE)]:
        icon(size, share).save(os.path.join(BRAND, name), optimize=True); made[name] = share
    icon(180, ANY).save(os.path.join(APP, "apple-icon.png"), optimize=True)
    icon(64, TAB).save(os.path.join(APP, "icon.png"), optimize=True)
    for i, s in enumerate((16, 32, 48), start=1):
        icon(s, TAB).save(os.path.join(APP, f"icon{i}.png"), optimize=True)
    ico = [icon(s, TAB) for s in (16, 32, 48)]
    ico[2].save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
    buf = io.BytesIO(); icon(256, 0.9).save(buf, "PNG", optimize=True)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
           f'<image width="256" height="256" href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"/></svg>\n')
    open(os.path.join(APP, "icon0.svg"), "w").write(svg)
    print("ratio", round(ratio, 3), "maskable", MASKABLE, "any", ANY, made)
