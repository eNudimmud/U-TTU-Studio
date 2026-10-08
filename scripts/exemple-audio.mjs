// Synthetic tones for the example cut. Not a recording of a person.
// Mono 16-bit PCM, 22 050 Hz. Durations match EXEMPLE_VOICE_SECONDS and EXEMPLE_MUSIC_SECONDS.

import { writeFileSync } from "node:fs";

const RATE = 22050;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function voice() {
  const n = Math.round(2.4 * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    const syllable = Math.sin(Math.PI * ((t * 1.6) % 1)) ** 2;
    const f = 196;
    const s = Math.sin(2 * Math.PI * f * t) * 0.55
      + Math.sin(2 * Math.PI * f * 2 * t) * 0.22
      + Math.sin(2 * Math.PI * f * 3 * t) * 0.12;
    const env = Math.min(1, t / 0.05) * Math.min(1, (2.4 - t) / 0.08);
    out[i] = s * syllable * env * 0.45;
  }
  return out;
}

function music() {
  const n = Math.round(7 * RATE);
  const out = new Float32Array(n);
  const notes = [220, 261.63, 329.63];
  for (let i = 0; i < n; i += 1) {
    const t = i / RATE;
    let s = 0;
    for (const f of notes) s += Math.sin(2 * Math.PI * f * t);
    const env = Math.min(1, t / 0.4) * Math.min(1, (7 - t) / 0.8);
    out[i] = (s / notes.length) * env * 0.28;
  }
  return out;
}

writeFileSync(new URL("../public/exemples/voix-exemple.wav", import.meta.url), wav(voice()));
writeFileSync(new URL("../public/exemples/musique-exemple.wav", import.meta.url), wav(music()));
