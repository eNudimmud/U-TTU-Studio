// Browser helpers for « Et ensuite ? »: read a source as a File, read a video's length,
// grab a take's last frame for Prolonger. Nothing here sends anything.

const TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  wav: "audio/wav", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", flac: "audio/flac",
};

/** The MIME type from a path or URL, else the fallback. */
export function typeFromName(name: string, fallback = ""): string {
  const ext = name.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? fallback;
}

/** Reads what is on screen as a File. The vault copy is never touched. */
export async function sourceFile(url: string, name: string, kind: "image" | "video" | "audio"): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const blob = await response.blob();
  const fallback = kind === 'audio' ? 'audio/wav' : kind === 'image' ? 'image/png' : 'video/mp4';
  const type = blob.type && blob.type.startsWith(`${kind}/`) ? blob.type : typeFromName(name, fallback);
  const ext = Object.entries(TYPES).find(([, value]) => value === type)?.[0] ?? (kind === 'audio' ? 'wav' : kind === 'image' ? 'png' : 'mp4');
  return new File([blob], `${name.replace(/\.[a-z0-9]+$/i, "") || "source"}.${ext}`, { type });
}

/** Seconds of a video, or null when it cannot be read. */
export function videoSeconds(url: string): Promise<number | null> {
  return new Promise(resolve => {
    if (typeof document === "undefined" || !url) { resolve(null); return; }
    const video = document.createElement("video");
    const timer = window.setTimeout(() => resolve(null), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => { window.clearTimeout(timer); resolve(Number.isFinite(video.duration) ? video.duration : null); };
    video.onerror = () => { window.clearTimeout(timer); resolve(null); };
    video.src = url;
  });
}

/** Width and height of a picture or a video, or null when it cannot be read. */
export function mediaSize(url: string, kind: "image" | "video"): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    if (typeof document === "undefined" || !url) { resolve(null); return; }
    const timer = window.setTimeout(() => resolve(null), 8000);
    const done = (width: number, height: number) => { window.clearTimeout(timer); resolve(width > 0 && height > 0 ? { width, height } : null); };
    if (kind === "image") {
      const image = new Image();
      image.onload = () => done(image.naturalWidth, image.naturalHeight);
      image.onerror = () => done(0, 0);
      image.src = url;
      return;
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight);
    video.onerror = () => done(0, 0);
    video.src = url;
  });
}

/** The last frame of a take as a PNG, for Prolonger. Null when the browser cannot read it. */
export function lastFrame(url: string, name = "derniere-image"): Promise<File | null> {
  return new Promise(resolve => {
    if (typeof document === "undefined" || !url) { resolve(null); return; }
    const video = document.createElement("video");
    let done = false;
    const finish = (file: File | null) => { if (done) return; done = true; window.clearTimeout(timer); video.removeAttribute("src"); video.load(); resolve(file); };
    const timer = window.setTimeout(() => finish(null), 12000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => { video.currentTime = Math.max(0, (video.duration || 0) - 0.05); };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width) { finish(null); return; }
        context.drawImage(video, 0, 0);
        canvas.toBlob(blob => finish(blob ? new File([blob], `${name}.png`, { type: "image/png" }) : null), "image/png");
      } catch { finish(null); }
    };
    video.onerror = () => finish(null);
    video.src = url;
  });
}

/** Seconds of an audio file, or null when it cannot be read. */
export function audioSeconds(url: string): Promise<number | null> {
  return new Promise(resolve => {
    if (typeof document === "undefined" || !url) { resolve(null); return; }
    const audio = document.createElement("audio");
    const timer = window.setTimeout(() => resolve(null), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { window.clearTimeout(timer); resolve(Number.isFinite(audio.duration) ? audio.duration : null); };
    audio.onerror = () => { window.clearTimeout(timer); resolve(null); };
    audio.src = url;
  });
}

