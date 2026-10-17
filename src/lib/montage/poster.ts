// A poster frame for takes that arrive without one: the first decoded frame, drawn small, cached per URL.
// Local only (blob: / same-origin URLs); nothing is sent anywhere.

const cache = new Map<string, Promise<string>>();
const WIDTH = 240;

export function framePoster(url: string): Promise<string> {
  if (!url) return Promise.resolve("");
  const known = cache.get(url);
  if (known) return known;
  const job = new Promise<string>(resolve => {
    if (typeof document === "undefined") { resolve(""); return; }
    const video = document.createElement("video");
    let done = false;
    const finish = (value: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(""), 8000);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.onloadeddata = () => { video.currentTime = Math.min(0.1, (video.duration || 1) / 10); };
    video.onseeked = () => {
      try {
        const ratio = video.videoHeight / Math.max(1, video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = WIDTH;
        canvas.height = Math.max(1, Math.round(WIDTH * ratio));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL("image/jpeg", 0.7));
      } catch { finish(""); }
    };
    video.onerror = () => finish("");
    video.src = url;
  });
  cache.set(url, job);
  job.then(value => { if (!value) cache.delete(url); });
  return job;
}
