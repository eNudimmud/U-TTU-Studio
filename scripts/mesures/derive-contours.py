"""Dérive de composition : contours du contrôle vs contours ré-estimés du rendu (Canny).
IoU des masques dilatés (tolérance 6 px à 1280x720) + couverture des contours du contrôle
+ distance moyenne (chamfer) contrôle -> rendu."""
import sys, json, cv2, numpy as np
TOL = 6
def ctrl_mask(path):
    m = cv2.imread(path, cv2.IMREAD_GRAYSCALE); m = cv2.resize(m, (1280, 720), interpolation=cv2.INTER_AREA)
    return (m > 64).astype(np.uint8)
def out_mask(path, lo=60, hi=160):
    im = cv2.imread(path); im = cv2.resize(im, (1280, 720), interpolation=cv2.INTER_AREA)
    g = cv2.GaussianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), (5, 5), 1.4)
    return (cv2.Canny(g, lo, hi) > 0).astype(np.uint8)
def metrics(ctrl, out):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*TOL+1, 2*TOL+1))
    c = cv2.dilate(ctrl, k); o = cv2.dilate(out, k)
    iou = float((c & o).sum() / max(1, (c | o).sum()))
    cover = float((ctrl & o).sum() / max(1, ctrl.sum()))
    dt = cv2.distanceTransform((1 - out).astype(np.uint8), cv2.DIST_L2, 5)
    chamfer = float(dt[ctrl > 0].mean())
    return {"iou_contours": round(iou, 3), "couverture": round(cover, 3), "chamfer_px": round(chamfer, 1)}
if __name__ == "__main__":
    pairs = json.loads(sys.argv[1])
    print(json.dumps({k: metrics(ctrl_mask(c), out_mask(o)) for k, (c, o) in pairs.items()}, indent=1))
