import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createZip, createZipBlob, readZip } from "../src/lib/zip.ts";

describe("archive des clips", () => {
  it("writes the same bytes as the buffer zipper, and unzip accepts them", async () => {
    const date = new Date(2026, 9, 3, 12, 0, 0);
    const files = [{ name: "clip01.mp4", data: new TextEncoder().encode("video-a") }, { name: "clip01.ref_1.jpg", data: new TextEncoder().encode("photo") }];
    const blob = await createZipBlob(files.map(file => ({ name: file.name, blob: new Blob([file.data]) })), date);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual(bytes, createZip(files, date));
    assert.deepEqual(readZip(bytes).map(entry => entry.name), ["clip01.mp4", "clip01.ref_1.jpg"]);
    const dir = mkdtempSync(join(tmpdir(), "uttu-zip-"));
    try {
      const path = join(dir, "clips.zip");
      writeFileSync(path, bytes);
      const unzip = spawnSync("unzip", ["-t", path], { encoding: "utf8" });
      assert.equal(unzip.status, 0, unzip.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
