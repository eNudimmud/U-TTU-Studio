import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { pixelsVides } from "../src/lib/render/blank.ts";
import { createRenderClient, RenderError } from "../src/lib/render/client.ts";
import { failView } from "../src/lib/render/fail.ts";
import { followTake } from "../src/lib/render/run.ts";

// JD, 31.10: « Élargir » (Côtés) with a long consigne came back fully black twice, was charged,
// and was shown as the result with no error. A flat picture is an explicit error, never a result.
const frame = (pixel: (index: number) => [number, number, number, number], count = 64 * 64) => {
  const data = new Uint8ClampedArray(count * 4);
  for (let index = 0; index < count; index++) data.set(pixel(index), index * 4);
  return data;
};

test("an all-black, flat or transparent picture is empty", () => {
  assert.equal(pixelsVides(frame(() => [0, 0, 0, 255])), true);
  assert.equal(pixelsVides(frame(() => [2, 1, 3, 255])), true, "encoder noise on black is still black");
  assert.equal(pixelsVides(frame(() => [128, 128, 128, 255])), true, "one flat grey");
  assert.equal(pixelsVides(frame(() => [255, 255, 255, 0])), true, "fully transparent");
  assert.equal(pixelsVides(new Uint8ClampedArray()), true);
});

test("a dark scene with texture, or a black frame with one narrow beam, is a result", () => {
  let seed = 7;
  const noise = () => (seed = (seed * 1103515245 + 12345) % 2147483648) % 28;
  assert.equal(pixelsVides(frame(() => [noise(), noise() + 4, noise(), 255])), false, "night forest");
  assert.equal(pixelsVides(frame(index => (index % 64 >= 31 && index % 64 <= 32 ? [230, 230, 200, 255] : [0, 0, 0, 255]))), false, "a beam in the centre");
});

test("the empty error keeps its own translated sentence and offers retry", () => {
  const view = failView(new RenderError("empty", "Le rendu est sorti entièrement noir."));
  assert.equal(view.kind, "empty");
  assert.equal(view.message, "Le rendu est sorti entièrement noir.");
  assert.equal(view.retry, true);
});

test("every image the studio files is checked for black first, including a recovered one", () => {
  const source = readFileSync("src/components/app/studio-session.tsx", "utf8");
  for (const line of ["await writeBlob(vault, sheet, result.image);"]) {
    let at = source.indexOf(line);
    assert.ok(at > 0, line);
    while (at > 0) {
      assert.match(source.slice(at - 260, at), /imageVide\(result\.(image|video)\)/, line);
      at = source.indexOf(line, at + 1);
    }
  }
  assert.match(source, /sortie === "image" && await imageVide\(result\.video\)\) throw new RenderError\("empty"/);
  assert.match(source, /still && await imageVide\(result\.video\)\) throw new RenderError\("empty", t\("suite\.blankResult"\)\);\n\s+await writeBlob\(vault, path, result\.video\)/);
  assert.match(source, /await imageVide\(blob\)\) \{\n\s+clearPending/);
  for (const lang of ["fr", "en", "de", "es"]) {
    const m = JSON.parse(readFileSync(`messages/${lang}.json`, "utf8"));
    assert.ok(m.suite.blankResult && m.outils.costUnread, lang);
  }
});

test("a deferred cost read waits for Comfy's slow balance (≈ 1 min), so « Coût réel » gets a number", async () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  let reads = 0;
  const client = createRenderClient({
    auth: { kind: "key", key: "comfyui-0123456789abcdef" },
    fetch: async input => {
      const url = String(input);
      if (url === "/api/job/job-0123456789/status") return json({ status: "success" });
      if (url === "/api/jobs/job-0123456789") return json({ status: "completed", outputs: { "9": { images: [{ filename: "a.png", subfolder: "", type: "output" }] } } });
      if (url.startsWith("/api/view?")) return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
      if (url.startsWith("/api/billing/usage/timeseries")) {
        reads++;
        // The charge shows on the 8th read (≈ 35 s): the former 4 tries (20 s) gave up before it.
        return json({ summary: { balance: { amount_micros: reads < 8 ? 2_370_000 : 2_330_000, currency: "USD" } } });
      }
      return new Response("not found", { status: 404 });
    },
  });
  const before = await client.balance();
  reads = 0;
  const cost = await new Promise<number | null>(resolve => {
    void followTake(client, "job-0123456789", before!, () => {}, { output: "image", outputNode: "9", deferMeasure: true, sleep: async () => {}, onCost: info => resolve(info.costCredits) });
  });
  assert.ok(cost !== null && cost > 0, String(cost));
});
