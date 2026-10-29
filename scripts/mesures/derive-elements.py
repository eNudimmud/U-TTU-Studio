"""Dérive par élément : silhouette (contour du personnage) et horizon (bord du sol), séparés.
Silhouette = contours du contrôle dans la boîte du mannequin (profondeur proche) ; horizon = le reste.
Rendu : Canny (flou 2 px, 30/90). Distance moyenne contrôle -> contour rendu le plus proche (px à 1280x720)
et part des points du contrôle à moins de 12 px."""
import sys, json, cv2, numpy as np
def load(p,flag=1): return cv2.resize(cv2.imread(p,flag),(1280,720),interpolation=cv2.INTER_AREA)
def parts(edges_p, depth_p):
    e=(load(edges_p,0)>64).astype(np.uint8)
    # mannequin = pixels dorés vifs de l'aperçu couleur du cadrage (le sol reste sombre)
    hsv=cv2.cvtColor(load(depth_p.replace('-depth','-apercu')),cv2.COLOR_BGR2HSV); fig=hsv[...,2]>110
    ys,xs=np.nonzero(fig); box=(xs.min()-8,ys.min()-8,xs.max()+8,ys.max()+8)
    m=np.zeros_like(e); m[box[1]:box[3],box[0]:box[2]]=1
    return e*m, e*(1-m), box
def out(p):
    g=cv2.GaussianBlur(cv2.cvtColor(load(p),cv2.COLOR_BGR2GRAY),(0,0),2); return (cv2.Canny(g,30,90)>0).astype(np.uint8)
def score(c,o):
    dt=cv2.distanceTransform((1-o).astype(np.uint8),cv2.DIST_L2,5); v=dt[c>0]
    return {"dist_moy_px":round(float(v.mean()),1),"part_a_12px":round(float((v<=12).mean()),3)}
res={}
for name,(e,d,o) in json.loads(sys.argv[1]).items():
    s,h,box=parts(e,d); r=out(o)
    res[name]={"silhouette":score(s,r),"horizon":score(h,r),"boite_mannequin":[int(x) for x in box]}
print(json.dumps(res,indent=1))
