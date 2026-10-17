from PIL import Image, ImageFilter
import numpy as np
import sys, os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC=sys.argv[1] if len(sys.argv)>1 else os.path.join(ROOT,'docs/brand/uttu-logo-jd-source.png')
OUT=os.path.join(ROOT,'public/brand/')
im=np.array(Image.open(SRC).convert('RGB')).astype(np.float64)
BG=np.array([15.,15.,15.])
# Un-composite from the flat dark background: alpha = how far the pixel is from bg toward its brightest channel.
d=np.clip(im-BG,0,None)
alpha=np.clip(d.max(axis=2)/(255-BG.max()),0,1)
# kill JPEG-ish noise in the background
alpha[alpha<0.03]=0
a=np.where(alpha>0,alpha,1)[...,None]
rgb=np.clip(BG+d/a,0,255)
rgba=np.dstack([rgb,alpha*255]).astype(np.uint8)
full=Image.fromarray(rgba,'RGBA')
def crop(img,box,pad):
    x0,y0,x1,y1=box; return img.crop((x0-pad,y0-pad,x1+pad,y1+pad))
# bboxes measured on the 1254 px source
web=(311,188,952,650); lock=(311,188,952,1026)
mark=crop(full,web,8); mark.save(os.path.join(ROOT,'docs/brand/')+'uttu-mark-full.png')
logo=crop(full,lock,24)
logo.resize((logo.width*1000//logo.width, logo.height*1000//logo.width),Image.LANCZOS).save(OUT+'uttu-logo.png',optimize=True)
m=mark.copy(); m.thumbnail((512,512),Image.LANCZOS)
# center on square transparent canvas
def square(img,size,bg=(0,0,0,0),scale=1.0):
    c=Image.new('RGBA',(size,size),bg); t=img.copy(); t.thumbnail((int(size*scale),int(size*scale)),Image.LANCZOS)
    c.alpha_composite(t,((size-t.width)//2,(size-t.height)//2)); return c
square(mark,512).save(OUT+'uttu-mark.png',optimize=True)
# Small-size mark: at 32 px the 7 px source stroke would be ~0.4 px and vanish.
# Thicken the line work (morphological max on alpha) before downscaling: same drawing, optical weight for small sizes.
def bold(img,radius):
    r,g,b,a=img.split(); a2=a.filter(ImageFilter.MaxFilter(radius))
    white=Image.new('RGBA',img.size,(250,248,245,0)); white.putalpha(a2); return white
mark_bold=bold(mark,15)   # ~ +14 px stroke at source scale
mark_bold.save(os.path.join(ROOT,'docs/brand/')+'uttu-mark-bold-src.png')
square(mark_bold,128).save(OUT+'uttu-mark-small.png',optimize=True)
# App icons: mark on graphite, rounded by the OS; maskable keeps 80% safe zone.
G=(15,15,17,255)
for size,scale,name in [(512,.72,'icon-512.png'),(192,.72,'icon-192.png'),(512,.58,'icon-maskable-512.png')]:
    src=mark if size>=192 and scale<.7 else mark_bold if size<256 else mark
    square(mark_bold if size<=192 else bold(mark,9),size,G,scale).convert('RGB').save(OUT+name,optimize=True)
square(bold(mark,9),180,G,.72).convert('RGB').save(os.path.join(ROOT,'src/app/')+'apple-icon.png',optimize=True)
# favicon: 48 px heavy version; Next serves src/app/icon.png
fav=square(bold(mark,21),256,G,.86).resize((64,64),Image.LANCZOS)
fav.convert('RGB').save(os.path.join(ROOT,'src/app/')+'icon.png',optimize=True)
print('ok', logo.size, mark.size)
# Header mark: non-square crop of the bold cut, 144 px wide (shown at 38×28).
b=bold(mark,15); b=b.crop(b.getbbox()); b.thumbnail((144,144),Image.LANCZOS); b.save(OUT+'uttu-mark-small.png',optimize=True)
