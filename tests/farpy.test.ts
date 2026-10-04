import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { describe, it } from "node:test";
import { cleanBlenderKey } from "../src/lib/render/blender-link.ts";
import {
  FARPY_LEGAL, filmDownload, filmGate, filmStartBody, filmState, inspectBlend, readFilmQuote, startRender,
} from "../src/lib/render/farpy.ts";
import { pngFromZip, pngsFromZip } from "../src/lib/render/zip-png.ts";

const quote = { uploadId: "up_1", quoteId: "Q1", priceCents: 1, frameCount: 1 };

function zip(files: { name: string; data: Uint8Array; method: 0 | 8 }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const data = file.method === 8 ? deflateRawSync(file.data) : file.data;
    const local = new Uint8Array(30 + name.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, file.method, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    locals.push(local);
    const central = new Uint8Array(46 + name.length);
    const directory = new DataView(central.buffer);
    directory.setUint32(0, 0x02014b50, true);
    directory.setUint16(10, file.method, true);
    directory.setUint32(20, data.length, true);
    directory.setUint32(24, file.data.length, true);
    directory.setUint16(28, name.length, true);
    directory.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length;
  }
  const directory = concat(centrals);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, files.length, true);
  tail.setUint16(10, files.length, true);
  tail.setUint32(12, directory.length, true);
  tail.setUint32(16, offset, true);
  return concat([...locals, directory, end]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

describe("Farpy", () => {
  it("accepts only a job key, and keeps it out of the vault shape", () => {
    assert.equal(cleanBlenderKey("  farpy_agent_abc12345  "), "farpy_agent_abc12345");
    assert.equal(cleanBlenderKey("farpy_live_abc12345"), null);
    assert.equal(cleanBlenderKey("farpy_agent_"), null);
  });

  it("reads the quote inspect returned, and refuses to invent one", () => {
    assert.deepEqual(readFilmQuote({ upload_id: "up_1", quote: { quote_id: "Q1", price_cents: 7, frame_count: 1 } }), {
      uploadId: "up_1", quoteId: "Q1", priceCents: 7, frameCount: 1,
    });
    assert.throws(() => readFilmQuote({ upload_id: "up_1", quote_id: "Q1" }));
    assert.equal(filmGate(null).allowed, false);
    assert.doesNotMatch(filmGate(null).line, /\d/);
    assert.match(filmGate(quote).line, /0,01 \$/);
    assert.equal(filmGate(quote).allowed, true);
    assert.deepEqual(filmStartBody(quote), { quote_id: "Q1", legal_acceptance: FARPY_LEGAL });
  });

  it("inspects without starting, and start is the only spend call", async () => {
    const calls: string[] = [];
    const send = async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      if (url.endsWith("/start")) {
        assert.equal(init.body, JSON.stringify({ quote_id: "Q1", legal_acceptance: FARPY_LEGAL }));
        return new Response(JSON.stringify({ job_id: "job_9" }), { status: 200 });
      }
      assert.equal(init.body instanceof FormData, true);
      const auth = new Headers(init.headers).get("Authorization");
      assert.equal(auth, "Bearer farpy_agent_abc12345");
      return new Response(JSON.stringify({ upload_id: "up_1", quote: { quote_id: "Q1", price_cents: "1", frame_count: 1 } }), { status: 200 });
    };
    const quoted = await inspectBlend("farpy_agent_abc12345", new Blob(["blend"]), "lieu.blend", undefined, send);
    assert.deepEqual(quoted, quote);
    assert.deepEqual(calls, ["POST https://farpy.com/node/v1/uploads/inspect"]);
    assert.equal(await startRender("farpy_agent_abc12345", quoted, undefined, send), "job_9");
    assert.equal(calls[1], "POST https://farpy.com/node/v1/uploads/up_1/start");
  });

  it("names a finished job and the PNG inside its zip", async () => {
    assert.equal(filmState({ status: "completed" }), "done");
    assert.equal(filmState({ state: "failed" }), "failed");
    assert.equal(filmState({ status: "canceled" }), "cancelled");
    assert.equal(filmState({ status: "rendering" }), "running");
    assert.equal(filmDownload({ download_url: "https://farpy.com/out.zip" }), "https://farpy.com/out.zip");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const archive = zip([
      { name: "note.txt", data: new Uint8Array([1]), method: 0 },
      { name: "frame.png", data: png, method: 8 },
    ]);
    assert.deepEqual(await pngFromZip(archive), png);
    assert.deepEqual(await pngFromZip(png), png);
    assert.equal(await pngFromZip(zip([{ name: "clip.mp4", data: new Uint8Array([1, 2]), method: 0 }])), null);
    const second = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5]);
    const frames = await pngsFromZip(zip([
      { name: "frame_5.png", data: second, method: 0 },
      { name: "frame_1.png", data: png, method: 0 },
    ]));
    assert.equal(frames.length, 2);
    assert.deepEqual(frames[0], png);
    assert.deepEqual(frames[1], second);
  });
});
