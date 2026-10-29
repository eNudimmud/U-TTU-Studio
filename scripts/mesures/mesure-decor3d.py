"""Mesure de dérive d'un rendu par rapport à la vue 3D (scène à 3 volumes ou capture du repérage).
- iou_contours : IoU des contours dilatés de 4 px (contours du rendu : Canny après filtre bilatéral,
  segments de moins de 60 px retirés pour ignorer fenêtres et texture).
- rappel_contours : part des contours 3D qui ont un contour du rendu à moins de 4 px.
- silhouettes (scène 3 volumes) : GrabCut libre dans une bande de ±24 px autour de chaque volume ;
  IoU de silhouette et décalage du centre (px).
- horizon : ligne sol/ciel trouvée dans les colonnes libres, écart en px."""
import cv2, numpy as np, json, sys
TOL=4
def edges_render(img):
    g=cv2.cvtColor(cv2.bilateralFilter(img,9,60,9),cv2.COLOR_BGR2GRAY)
    v=np.median(g); e=cv2.Canny(g,int(max(0,.66*v)),int(min(255,1.33*v)))
    n,lab,st,_=cv2.connectedComponentsWithStats((e>0).astype(np.uint8),8)
    keep=np.zeros_like(e)
    for i in range(1,n):
        if max(st[i,2],st[i,3])>=60: keep[lab==i]=255
    return keep
def iou_edges(ref,ren):
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*TOL+1,2*TOL+1))
    a=cv2.dilate(ref,k)>0; b=cv2.dilate(ren,k)>0
    rec=float(((ref>0)&b).sum()/max(1,(ref>0).sum()))
    return float((a&b).sum()/max(1,(a|b).sum())), rec
def horizon(img,cols,lo,hi):
    g=cv2.GaussianBlur(cv2.cvtColor(img,cv2.COLOR_BGR2GRAY).astype(np.float32),(5,5),0)
    prof=g[:,cols].mean(1); d=np.abs(np.diff(prof)); return int(lo+np.argmax(d[lo:hi]))
def main(ref_edges_path, render_path, objets_path=None):
    ren=cv2.imread(render_path); H,W=ren.shape[:2]
    ref=cv2.resize(cv2.imread(ref_edges_path,0),(W,H),interpolation=cv2.INTER_NEAREST)
    er=edges_render(ren); iou,rec=iou_edges(ref,er)
    out={"rendu":render_path,"iou_contours":round(iou,3),"rappel_contours":round(rec,3)}
    cv2.imwrite(render_path.rsplit('.',1)[0]+'-contours.png',er)
    if objets_path:
        obj=cv2.resize(cv2.imread(objets_path,0)//60,(W,H),interpolation=cv2.INTER_NEAREST)
        sil={}
        for o,name in [(2,"cube"),(3,"cylindre"),(4,"batiment")]:
            m=(obj==o).astype(np.uint8)
            k=np.ones((49,49),np.uint8)
            mask=np.full((H,W),cv2.GC_BGD,np.uint8)
            mask[cv2.dilate(m,k)>0]=cv2.GC_PR_BGD; mask[m>0]=cv2.GC_PR_FGD; mask[cv2.erode(m,k)>0]=cv2.GC_FGD
            bg=np.zeros((1,65)); fg=np.zeros((1,65))
            cv2.grabCut(ren,mask,None,bg,fg,5,cv2.GC_INIT_WITH_MASK)
            s=((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD))
            n,lab,st,_=cv2.connectedComponentsWithStats(s.astype(np.uint8),8)
            if n>1: s=lab==(1+np.argmax(st[1:,4]))
            inter=(s&(m>0)).sum(); uni=(s|(m>0)).sum()
            ys,xs=np.nonzero(m); ys2,xs2=np.nonzero(s)
            sil[name]={"iou":round(float(inter/uni),3),"decalage_centre_px":[round(float(xs2.mean()-xs.mean()),1),round(float(ys2.mean()-ys.mean()),1)]}
        out["silhouettes"]=sil
        gap=[x for x in range(W) if (obj[:,x]>=2).sum()==0]
        hz_ref=int(np.median([np.argmax(obj[:,x]==1) for x in gap]))
        hz=horizon(ren,gap,max(0,hz_ref-80),min(H-1,hz_ref+80))
        out["horizon"]={"vue_3d_px":hz_ref,"rendu_px":hz,"ecart_px":hz-hz_ref,"colonnes_libres":len(gap)}
    return out
if __name__=="__main__":
    print(json.dumps(main(*sys.argv[1:]),ensure_ascii=False))
