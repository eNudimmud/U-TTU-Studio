// Client-side previs: films the maquette canvas with MediaRecorder. Nothing is uploaded here.

/** Films the 3D maquette canvas for the previs. The visitor moves the camera while it records. */
export async function recordMaquette(seconds: number, onTick: (left: number) => void): Promise<File | null> {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas.u-maquette-canvas");
  if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") return null;
  const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(item => MediaRecorder.isTypeSupported(item));
  if (!type) return null;
  const stream = canvas.captureStream(25);
  const recorder = new MediaRecorder(stream, { mimeType: type });
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
  const done = new Promise<void>(resolve => { recorder.onstop = () => resolve(); });
  recorder.start(250);
  for (let left = seconds; left > 0; left--) {
    onTick(left);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  recorder.stop();
  await done;
  stream.getTracks().forEach(track => track.stop());
  onTick(0);
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
  return new File(chunks, `uttu-previs.${ext}`, { type: type.split(";")[0] });
}

