/** Decode an actual frame, not only a filename or MIME header. No media is uploaded here. */
export async function videoSeconds(blob: Blob): Promise<number> {
  if (!blob.size || typeof document === "undefined") throw new Error("Vidéo vide ou illisible.");
  const url = URL.createObjectURL(blob), video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  try {
    return await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("La vidéo ne se décode pas dans ce navigateur.")), 20000);
      const done = () => { clearTimeout(timer); if (video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.duration) && video.duration > 0) resolve(video.duration); else reject(new Error("Vidéo vide ou illisible.")); };
      video.onloadeddata = done;
      video.onerror = () => { clearTimeout(timer); reject(new Error("Vidéo corrompue ou format non pris en charge.")); };
      video.src = url;
    });
  } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
}
