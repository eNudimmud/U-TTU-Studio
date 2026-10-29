"""Central Park : ligne du sol (haut de la pelouse / du sol) dans les colonnes 600–1000, en px sur 576.
Vue 3D : premier rang où le sol gris remplace le ciel clair. Rendu : premier rang à majorité d'herbe (verte)."""
import cv2,numpy as np,sys,json
def ground_top(img,is3d):
    img=cv2.resize(img,(1024,576)); c=img[:,600:1000]
    if is3d:
        g=cv2.cvtColor(c,cv2.COLOR_BGR2GRAY).astype(float); m=g<215
    else:
        h=cv2.cvtColor(c,cv2.COLOR_BGR2HSV); m=(h[...,0]>=30)&(h[...,0]<=90)&(h[...,1]>60)
        # pelouse = vert clair (V élevé) ; les arbres sont plus sombres
        m&=h[...,2]>110
    frac=m.mean(1)
    rows=np.nonzero(frac>0.6)[0]
    for r in rows:
        if frac[r:r+20].min()>0.6: return int(r)
    return None
ref=ground_top(cv2.imread('cp/capture.png'),True); out={"vue_3d":ref}
for p in sys.argv[1:]:
    v=ground_top(cv2.imread(p),False); out[p]={"sol_px":v,"ecart_px":None if v is None else v-ref}
print(json.dumps(out,ensure_ascii=False,indent=0))
