// Local canvas recording; always release the stream, including recorder failures.
/** Films the 3D maquette canvas for the previs. The visitor moves the camera while it records. */
export async function recordMaquette(seconds: number, onTick: (left: number) => void): Promise<File | null> {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas.u-maquette-canvas");
  if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") return null;
  const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(item => MediaRecorder.isTypeSupported(item));
  if (!type) return null;
  const stream = canvas.captureStream(25);
  const chunks: Blob[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  try {
    const recorder = new MediaRecorder(stream, { mimeType: type });
    recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
    await new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('Recording failed'));
      recorder.start(250);
      let left = seconds;
      onTick(left);
      tick = setInterval(() => onTick(Math.max(0, --left)), 1000);
      timer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, seconds * 1000);
    });
  } finally {
    clearTimeout(timer);
    clearInterval(tick);
    stream.getTracks().forEach(track => track.stop());
    onTick(0);
  }
  if (!chunks.length) return null;
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
  return new File(chunks, `uttu-previs.${ext}`, { type: type.split(";")[0] });
}
