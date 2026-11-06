/** Decode an actual frame, not only a filename or MIME header. No media is uploaded here. */
export async function videoSeconds(blob: Blob): Promise<number> {
  if (!blob.size || typeof document === "undefined")
    throw new Error("Vidéo vide ou illisible.");
  const url = URL.createObjectURL(blob),
    video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    return await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(new Error("La vidéo ne se décode pas dans ce navigateur.")),
        20000,
      );
      const done = () => {
        clearTimeout(timer);
        if (
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          Number.isFinite(video.duration) &&
          video.duration > 0
        )
          resolve(video.duration);
        else reject(new Error("Vidéo vide ou illisible."));
      };
      video.onloadeddata = done;
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Vidéo corrompue ou format non pris en charge."));
      };
      video.src = url;
    });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export class InvalidMediaError extends Error {}

export async function checkMedia(
  blob: Blob,
  media: "video" | "image" | "audio" | "mesh",
): Promise<number | undefined> {
  if (!blob.size) throw new InvalidMediaError("La sortie du rendu est vide.");
  if (media === "image") {
    const { imageVide } = await import("../render/blank.ts");
    if (await imageVide(blob))
      throw new InvalidMediaError("L’image est vide ou corrompue.");
    return;
  }
  if (media === "video") return videoSeconds(blob);
  if (media === "audio") {
    const context = new AudioContext();
    try {
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      if (!(decoded.duration > 0 && decoded.numberOfChannels > 0))
        throw new InvalidMediaError("La piste audio est vide.");
      return decoded.duration;
    } finally {
      await context.close();
    }
  }
  const header = new DataView(await blob.slice(0, 12).arrayBuffer());
  if (
    header.byteLength === 12 &&
    header.getUint32(0, true) === 0x46546c67 &&
    header.getUint32(4, true) === 2 &&
    header.getUint32(8, true) === blob.size
  )
    return;
  try {
    const gltf = JSON.parse(await blob.text());
    if (gltf.asset?.version === "2.0" && gltf.meshes?.length) return;
  } catch {}
  throw new InvalidMediaError("Le volume 3D est illisible.");
}
