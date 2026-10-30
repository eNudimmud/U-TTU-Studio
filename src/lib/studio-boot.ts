// F14 · The /studio home is in the server HTML. Before its first paint, this inline script reads what
// only the browser knows: a stage address (#personnage, #prise, #outils/x) shows the splash instead of
// the home, and a saved render link hides « Relier mon compte ». CSS reads the marks while the home is
// early; the studio drops them once it is ready. It reads the link's mode only, never a key's value.

import { RENDER_LINK_KEY } from "./render/settings.ts";

export const BOOT_MARKS = ["data-u-deep", "data-u-linked"] as const;

/** A hash the early home answers itself: none, « # », « #outils », « #outils/tous ». */
export const HOME_HASH = /^(#|#outils|#outils\/tous)?$/;

export const STUDIO_BOOT = `(function(){try{var d=document.documentElement;if(!${HOME_HASH}.test(location.hash))d.setAttribute("${BOOT_MARKS[0]}","");var l=JSON.parse(localStorage.getItem(${JSON.stringify(RENDER_LINK_KEY)})||"null");if(l&&(l.mode==="session"||(l.mode==="key"&&typeof l.key==="string"&&l.key.trim())))d.setAttribute("${BOOT_MARKS[1]}","")}catch(e){}})();`;
