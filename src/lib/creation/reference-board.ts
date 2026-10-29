// Local contact sheet: one named reference may contain three photos; no cloud call.
export async function referenceBoard(files: readonly Blob[], name: string): Promise<Blob> {
  if (files.length < 1 || files.length > 3) throw new Error('namedRefs.photosLimit');
  if (files.length === 1) return files[0];
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const file of files) bitmaps.push(await createImageBitmap(file));
    const canvas = document.createElement('canvas');
    canvas.width = 1536; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('namedRefs.failed');
    ctx.fillStyle = '#151515'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '32px sans-serif'; ctx.fillText(name.slice(0, 40), 24, 48, 1488);
    const width = canvas.width / bitmaps.length;
    bitmaps.forEach((image, i) => {
      const scale = Math.min((width - 24) / image.width, 928 / image.height);
      const w = image.width * scale, h = image.height * scale;
      ctx.drawImage(image, i * width + (width - w) / 2, 72 + (928 - h) / 2, w, h);
    });
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('namedRefs.failed')), 'image/png'));
  } finally { bitmaps.forEach(b => b.close()); }
}
