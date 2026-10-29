"""Scène 3D simple, caméra fixe : sol, cube, cylindre, bâtiment bas. Lancer de rayons analytique.
Exporte couleur (volumes gris éclairés), profondeur (proche clair, linéaire), contours (Sobel de la
profondeur, comme l'export de maquette), masque par objet (0 ciel, 1 sol, 2 cube, 3 cylindre, 4 bâtiment)."""
import numpy as np, cv2, sys, json
W,H=1024,576; FOV=55
cam=np.array([0.,2.2,-10.]); target=np.array([0.,1.5,0.])
f=(target-cam); f/=np.linalg.norm(f); r=np.cross([0,1,0],f); r/=np.linalg.norm(r); u=np.cross(f,r)
t=np.tan(np.radians(FOV)/2); ys,xs=np.mgrid[0:H,0:W]
px=(2*(xs+.5)/W-1)*t*W/H; py=(1-2*(ys+.5)/H)*t
d=f[None,None]*1+r[None,None]*px[...,None]+u[None,None]*py[...,None]; d/=np.linalg.norm(d,axis=-1,keepdims=True)
INF=1e9; dist=np.full((H,W),INF); obj=np.zeros((H,W),np.uint8); nrm=np.zeros((H,W,3))
def upd(tt,o,n):
    m=(tt>1e-3)&(tt<dist); dist[m]=tt[m]; obj[m]=o; nrm[m]=n[m] if n.ndim==3 else n
# sol
with np.errstate(divide='ignore',invalid='ignore'): tg=np.where(d[...,1]<-1e-6,-cam[1]/d[...,1],INF)
upd(tg,1,np.array([0,1.,0]))
def box(lo,hi,o):
    lo,hi=np.array(lo),np.array(hi)
    with np.errstate(divide='ignore',invalid='ignore'):
        t1=(lo-cam)/d; t2=(hi-cam)/d
    tn=np.minimum(t1,t2); tf=np.maximum(t1,t2); tnear=tn.max(-1); tfar=tf.min(-1)
    hit=(tnear<tfar)&(tfar>0); tt=np.where(hit,tnear,INF)
    ax=tn.argmax(-1); n=np.zeros((H,W,3)); s=-np.sign(np.take_along_axis(d,ax[...,None],-1))[...,0]
    for a in range(3): n[...,a]=np.where(ax==a,s,0)
    upd(tt,o,n)
def cyl(cx,cz,rad,h,o):
    ox,oz=cam[0]-cx,cam[2]-cz; a=d[...,0]**2+d[...,2]**2; b=2*(ox*d[...,0]+oz*d[...,2]); c=ox*ox+oz*oz-rad*rad
    disc=b*b-4*a*c; tt=np.where(disc>0,(-b-np.sqrt(np.maximum(disc,0)))/(2*a),INF)
    y=cam[1]+tt*d[...,1]; tt=np.where((y>=0)&(y<=h),tt,INF)
    p=cam+tt[...,None]*d; n=np.stack([(p[...,0]-cx)/rad,np.zeros((H,W)),(p[...,2]-cz)/rad],-1)
    upd(tt,o,n)
    # toit du cylindre
    with np.errstate(divide='ignore',invalid='ignore'): tc=(h-cam[1])/d[...,1]
    p=cam+tc[...,None]*d; inside=((p[...,0]-cx)**2+(p[...,2]-cz)**2<=rad*rad)&(tc>0)
    upd(np.where(inside,tc,INF),o,np.array([0,1.,0]))
box([-7.5,0,-1.5],[-4.5,3,1.5],2)        # cube 3 m
cyl(0.0,1.0,1.4,5.0,3)                    # cylindre r 1,4 m, h 5 m
box([3.5,0,-2.0],[11.5,3.6,4.0],4)       # bâtiment bas 8 x 3,6 m
L=np.array([-.5,.8,-.4]); L/=np.linalg.norm(L)
shade=np.clip((nrm*L).sum(-1),0,1)*.75+.25
col=np.zeros((H,W,3)); col[obj==0]=(235,215,200)  # ciel (BGR)
for o,g in [(1,85),(2,200),(3,215),(4,175)]: col[obj==o]=(shade[obj==o,None]*g)
far=60.; z=np.where(obj>0,np.minimum(dist,far),far)
near=4.
depth=(255*(1/np.maximum(z,near)-1/far)/(1/near-1/far)).clip(0,255).astype(np.uint8)  # disparité, proche clair
gx=cv2.Sobel(depth.astype(np.float32),cv2.CV_32F,1,0); gy=cv2.Sobel(depth.astype(np.float32),cv2.CV_32F,0,1)
objedge=cv2.morphologyEx(obj,cv2.MORPH_GRADIENT,np.ones((3,3)))>0
edges=(((np.hypot(gx,gy)>40)|objedge)*255).astype(np.uint8)
out=sys.argv[1] if len(sys.argv)>1 else '.'
cv2.imwrite(f'{out}/scene3-couleur.png',col.astype(np.uint8)); cv2.imwrite(f'{out}/scene3-depth.png',depth)
cv2.imwrite(f'{out}/scene3-edges.png',edges); cv2.imwrite(f'{out}/scene3-objets.png',obj*60)
hz=[int(np.argmax((obj[:,x]==1)) ) for x in (20,W//2,W-20)]
print(json.dumps({"camera":cam.tolist(),"cible":target.tolist(),"fov":FOV,"taille":[W,H]}))
