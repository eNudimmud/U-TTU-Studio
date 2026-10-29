import type { Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

// Phone-sized files, built at test time (no ffmpeg in CI): real media, padded or synthesised
// to the weight a phone produces. The relay is simulated with Vercel's ~4 MB body limit.
export const RELAY_LIMIT = 4_000_000;
const MB = 1_000_000;

/** A real JPEG with bytes after its end marker, as heavy as a phone photo (decoders ignore the tail). */
export function heavyJpeg(path: string, bytes = 9 * MB) {
  const jpeg = readFileSync('public/exemples/outils/wan-gare-poster.jpg');
  writeFileSync(path, Buffer.concat([jpeg, Buffer.alloc(bytes - jpeg.length, 0x20)]));
  return path;
}

/** A real 5 s H.264 clip with a trailing mp4 `free` box, as heavy as a phone clip. */
export function heavyMp4(path: string, bytes = 25 * MB) {
  const mp4 = readFileSync('public/exemples/outils/prise-uttu-quai.mp4');
  const pad = bytes - mp4.length;
  const box = Buffer.alloc(pad);
  box.writeUInt32BE(pad, 0);
  box.write('free', 4, 'latin1');
  writeFileSync(path, Buffer.concat([mp4, box]));
  return path;
}

/** A real PCM WAV voice memo (440 Hz), 44.1 kHz stereo 16 bit: ~40 MB for 4 minutes. */
export function heavyWav(path: string, seconds = 230) {
  const rate = 44100, channels = 2, samples = rate * seconds;
  const data = Buffer.alloc(samples * channels * 2);
  for (let i = 0; i < samples; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000);
    data.writeInt16LE(v, i * 4);
    data.writeInt16LE(v, i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'latin1'); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8, 'latin1');
  head.write('fmt ', 12, 'latin1'); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * channels * 2, 28); head.writeUInt16LE(channels * 2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36, 'latin1'); head.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([head, data]));
  return path;
}

export type Sent = { name: string; type: string; bytes: number };

/** In-page relay: records every file sent to /api/upload/image and answers 413 above the limit, like Vercel. */
export async function simulateRelay(page: Page) {
  await page.addInitScript(limit => {
    const w = window as unknown as { __sent: { name: string; type: string; bytes: number }[]; __refused: number };
    w.__sent = []; w.__refused = 0;
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const file = init?.body instanceof FormData ? init.body.get('image') : null;
      if (/\/api\/upload\/image$/.test(url) && file instanceof File) {
        if (file.size > limit) { w.__refused++; return new Response('Request Entity Too Large', { status: 413 }); }
        w.__sent.push({ name: file.name, type: file.type, bytes: file.size });
      }
      return real(input, init);
    };
  }, RELAY_LIMIT);
  return {
    sent: () => page.evaluate(() => (window as unknown as { __sent: Sent[] }).__sent),
    refused: () => page.evaluate(() => (window as unknown as { __refused: number }).__refused),
  };
}
