import { ServerResponse } from "node:http";
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from "node:zlib";
import { holdNextScripts } from "./hold-scripts.ts";

const installed = Symbol.for("u.holdScripts");

type State = {
  pass: boolean;
  decided: boolean;
  tail: string;
  decoder: TextDecoder;
  compress: "gzip" | "br" | null;
  chunks: Buffer[];
};

function bufferOf(chunk: unknown, enc: unknown): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  const encoding = typeof enc === "string" ? enc : "utf8";
  return Buffer.from(String(chunk), encoding as BufferEncoding);
}

function isHtml(res: ServerResponse): boolean {
  return String(res.getHeader("content-type") || "").includes("text/html");
}

function compressed(res: ServerResponse, buf: Buffer): "gzip" | "br" | null {
  const header = String(res.getHeader("content-encoding") || "");
  if (header.includes("br")) return "br";
  if (header.includes("gzip")) return "gzip";
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) return "gzip";
  return null;
}

function stateFor(res: ServerResponse): State {
  const host = res as ServerResponse & { __uHold?: State };
  if (!host.__uHold) {
    host.__uHold = { pass: false, decided: false, tail: "", decoder: new TextDecoder(), compress: null, chunks: [] };
  }
  return host.__uHold;
}

function callbackOf(enc: unknown, cb: unknown): (() => void) | undefined {
  if (typeof enc === "function") return enc as () => void;
  if (typeof cb === "function") return cb as () => void;
  return undefined;
}

/* Rewrite complete tags and hold a trailing "<" that the next chunk may finish. */
function consume(state: State, text: string): string {
  const buf = state.tail + text;
  const last = buf.lastIndexOf("<");
  if (last !== -1 && !buf.slice(last).includes(">")) {
    state.tail = buf.slice(last);
    return holdNextScripts(buf.slice(0, last));
  }
  state.tail = "";
  return holdNextScripts(buf);
}

function finishCompressed(state: State): Buffer {
  const raw = Buffer.concat(state.chunks);
  const html = (state.compress === "br" ? brotliDecompressSync(raw) : gunzipSync(raw)).toString("utf8");
  const out = Buffer.from(holdNextScripts(html));
  return state.compress === "br" ? brotliCompressSync(out) : gzipSync(out);
}

export function installHoldScripts() {
  const proto = ServerResponse.prototype as ServerResponse & { [installed]?: boolean };
  if (proto[installed]) return;
  proto[installed] = true;
  const origWrite = proto.write;
  const origEnd = proto.end;

  proto.write = function (this: ServerResponse, chunk: unknown, enc?: unknown, cb?: unknown) {
    const done = callbackOf(enc, cb);
    const state = stateFor(this);
    if (state.pass || chunk == null) return origWrite.call(this, chunk as never, enc as never, cb as never);
    const buf = bufferOf(chunk, enc);
    if (!state.decided) {
      state.decided = true;
      if (!isHtml(this)) {
        state.pass = true;
        return origWrite.call(this, chunk as never, enc as never, cb as never);
      }
      state.compress = compressed(this, buf);
      if (!this.headersSent && this.hasHeader("content-length")) this.removeHeader("content-length");
    }
    if (state.compress) {
      state.chunks.push(buf);
      if (done) done();
      return true;
    }
    const out = consume(state, state.decoder.decode(buf, { stream: true }));
    if (!out) {
      if (done) done();
      return true;
    }
    return origWrite.call(this, out, "utf8", done as never);
  } as ServerResponse["write"];

  proto.end = function (this: ServerResponse, chunk?: unknown, enc?: unknown, cb?: unknown) {
    const state = stateFor(this);
    const done = callbackOf(enc, cb);
    if (state.pass) return origEnd.call(this, chunk as never, enc as never, cb as never);
    const buf = chunk != null && chunk !== "" ? bufferOf(chunk, enc) : null;
    if (!state.decided) {
      state.decided = true;
      if (!buf || !isHtml(this)) return origEnd.call(this, chunk as never, enc as never, cb as never);
      state.compress = compressed(this, buf);
      if (!this.headersSent && this.hasHeader("content-length")) this.removeHeader("content-length");
    }
    state.pass = true;
    if (state.compress) {
      if (buf) state.chunks.push(buf);
      return origEnd.call(this, finishCompressed(state), done as never);
    }
    let extra = "";
    if (buf) extra = state.decoder.decode(buf);
    else if (state.decided) extra = state.decoder.decode();
    const out = consume(state, extra) + holdNextScripts(state.tail);
    state.tail = "";
    return origEnd.call(this, out, "utf8", done as never);
  } as ServerResponse["end"];
}
