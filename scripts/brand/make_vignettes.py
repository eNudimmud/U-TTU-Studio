"""Tool thumbnails (16:10, 480x300) cut from the house renders already in public/exemples.
Nothing is generated: each thumbnail is a crop of a real example render. Run from the repo root.
The Uttu portrait crops come from the canon portrait in git history (1f89d6c^), cropped so the
background banner and drawing stay out of frame."""
import io, subprocess
from pathlib import Path
from PIL import Image

EX = Path("public/exemples")
OUT = EX / "vignettes"
W, H = 480, 300

def src(name):
    if name.startswith("git:"):
        return Image.open(io.BytesIO(subprocess.check_output(["git", "show", name[4:]]))).convert("RGB")
    if ".mp4" in name:
        path, at = name.rsplit("@", 1) if "@" in name else (name, "1.5")
        raw = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-ss", at, "-i", str(EX / path), "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"])
        return Image.open(io.BytesIO(raw)).convert("RGB")
    return Image.open(EX / name).convert("RGB")

def cut(im, box):
    """box = (cx, cy, zoom) in 0..1 coordinates: centre of the 16:10 window and its width share."""
    cx, cy, share = box
    w = im.width * share
    h = w * H / W
    if h > im.height:
        h = im.height; w = h * W / H
    x0 = min(max(cx * im.width - w / 2, 0), im.width - w)
    y0 = min(max(cy * im.height - h / 2, 0), im.height - h)
    return im.crop((round(x0), round(y0), round(x0 + w), round(y0 + h))).resize((W, H), Image.LANCZOS)

PLANCHE = "git:1f89d6c^:public/exemples/cast-uttu-planche.webp"
MAP = {
    # Créer
    "img-klein": ("decor-quai-nuit.webp", (.5, .5, 1)),
    "reperage": ("apres-decor-photo.webp", (.3, .42, .5)),
    "img-qwen": ("decor-piece.webp", (.5, .5, 1)),
    "img-flux3": ("decor-gare.webp", (.5, .5, 1)),
    "img-ideogram": ("decor-rue-pluie.webp", (.35, .45, .7)),
    "img-gpt": ("decor-couloir.webp", (.5, .5, 1)),
    "img-seedream": ("cast-vieil-homme.webp", (.25, .3, .5)),
    "img-refs": ("cast-coursiere.webp", (.5, .5, 1)),
    "img-360": ("decor-toit-aube.webp", (.5, .5, 1)),
    "img-croquis": ("apres-decor-texte.webp", (.5, .5, 1)),
    # Retoucher
    "ret-modifier": ("apres-cast-texte.webp", (.5, .5, 1)),
    "ret-finaliser": ("apres-cast-planche.webp", (.84, .45, .32)),
    "ret-elargir": ("apres-decor-photo.webp", (.5, .5, 1)),
    "ret-detourer": ("cast-dj.webp", (.5, .5, 1)),
    "ret-eclairer": ("apres-decor-heure.webp", (.5, .5, 1)),
    # Vidéo
    "vid-wan": ("outils/plan-exemple.mp4@1.5", (.5, .5, 1)),
    "vid-texte": ("decor-rue-pluie.webp", (.8, .6, .55)),
    "vid-raccord": ("decor-toit-aube.webp", (.25, .65, .5)),
    "vid-h3-refs": ("cast-coursiere.webp", (.13, .3, .3)),
    "vid-vidu": ("apres-cast-planche.webp", (.5, .5, 1)),
    "vid-prolonger": ("decor-gare.webp", (.8, .55, .5)),
    "vid-parler": ("cast-vieil-homme.webp", (.1, .32, .32)),
    "vid-finaliser": ("decor-couloir.webp", (.5, .45, .45)),
    "vid-recadrer": ("apres-decor-texte.webp", (.3, .6, .55)),
    "vid-detourer": ("apres-cast-texte.webp", (.13, .45, .3)),
    "vid-levres": ("cast-dj.webp", (.14, .55, .34)),
    "vid-effacer": ("apres-decor-heure.webp", (.65, .55, .5)),
    "vid-fluidifier": ("outils/plan-exemple.mp4@2.9", (.6, .6, .55)),
    "vid-mouvement": ("apres-cast-planche.webp", (.3, .5, .55)),
    # 3D: Uttu's turnaround, front views only.
    "3d-ouvert": (PLANCHE, (.3, .5, .62)),
}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    cache = {}
    for tool, (name, box) in MAP.items():
        im = cache.setdefault(name, src(name))
        cut(im, box).save(OUT / f"{tool}.webp", quality=82, method=6)
    portrait = src("git:1f89d6c^:public/images/uttu-canon-portrait.webp")
    Path("public/images").mkdir(exist_ok=True)
    portrait.crop((20, 250, 620, 1150)).save("public/images/uttu-portrait.webp", quality=84, method=6)
    portrait.crop((20, 300, 620, 675)).save("public/images/uttu-portrait-large.webp", quality=84, method=6)
    print(len(MAP), "vignettes")

main()
