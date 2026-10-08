import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FalError, createFalClient } from "../src/lib/fal/client.ts";

const KEY = "abcd1234:secret_key-1";

function routed(routes: (url: string, init: RequestInit) => Response): typeof fetch {
  return (async (input, init) => routes(String(input), init ?? {})) as typeof fetch;
}

const handleBody = {
  request_id: "abc12345-def",
  status_url: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def/status",
  response_url: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def",
  cancel_url: "https://queue.fal.run/minimax/h3/ref2va/trainer/requests/abc12345-def/cancel",
};

describe("client fal, depuis l’appareil", () => {
  it("reads the balance and the unit price, and names a key that cannot see the balance", async () => {
    const calls: string[] = [];
    const fal = createFalClient({
      key: KEY,
      fetch: routed((url, init) => {
        calls.push(`${init.method ?? "GET"} ${url}`);
        assert.equal(new Headers(init.headers).get("authorization"), `Key ${KEY}`);
        if (url.includes("/account/billing")) return Response.json({ username: "uttu", credits: { current_balance: 42.5, currency: "USD" } });
        if (url.includes("/models/pricing")) return Response.json({ prices: [{ endpoint_id: "minimax/h3/ref2va/trainer", unit_price: 0.015, unit: "steps", currency: "USD" }] });
        return new Response("nope", { status: 404 });
      }),
    });
    assert.deepEqual(await fal.account(), { username: "uttu", usd: 42.5 });
    assert.equal((await fal.price("minimax/h3/ref2va/trainer"))?.unitPrice, 0.015);
    const denied = createFalClient({
      key: KEY,
      fetch: routed(() => Response.json({ detail: "Forbidden" }, { status: 403 })),
    });
    await assert.rejects(denied.account(), (error: unknown) => error instanceof FalError && error.code === "scope" && /Admin/.test(error.message));
    const refused = createFalClient({
      key: KEY,
      fetch: routed(() => new Response("no", { status: 401 })),
    });
    await assert.rejects(refused.account(), (error: unknown) => error instanceof FalError && error.code === "auth");
    assert.ok(calls.every(call => call.startsWith("GET https://api.fal.ai/")));
  });

  it("uploads to the address fal gives, then queues, and never sends the key to fetch the file", async () => {
    const puts: { url: string; auth: string | null }[] = [];
    const fal = createFalClient({
      key: KEY,
      fetch: routed((url, init) => {
        const auth = new Headers(init.headers).get("authorization");
        if (url.includes("/storage/upload/initiate")) {
          assert.equal(auth, `Key ${KEY}`);
          assert.match(init.headers && new Headers(init.headers).get("x-fal-object-lifecycle") || "", /expiration_duration_seconds/);
          return Response.json({ upload_url: "https://v3.fal.media/files/put?token=1", file_url: "https://v3.fal.media/files/dataset.zip" });
        }
        if (init.method === "PUT") {
          puts.push({ url, auth });
          return new Response(null, { status: 200 });
        }
        if (init.method === "POST" && url.startsWith("https://queue.fal.run/")) {
          assert.equal(auth, `Key ${KEY}`);
          return Response.json(handleBody);
        }
        if (url.endsWith("/status?logs=1")) return Response.json({ status: "COMPLETED", metrics: { inference_time: 12.2 } });
        if (url === "https://v3.fal.media/files/out.safetensors") {
          assert.equal(auth, null);
          return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/octet-stream" } });
        }
        return new Response("nope", { status: 500 });
      }),
    });
    const url = await fal.upload(new Blob(["zip"]), "dataset.zip", { expiresIn: 3600 });
    assert.equal(url, "https://v3.fal.media/files/dataset.zip");
    assert.equal(puts[0]?.auth, null);
    const handle = await fal.submit("minimax/h3/ref2va/trainer", { training_data_url: url });
    assert.equal(handle.requestId, "abc12345-def");
    assert.deepEqual(await fal.status(handle), { state: "done", error: null, errorType: null, seconds: 12 });
    const file = await fal.download("https://v3.fal.media/files/out.safetensors");
    assert.equal(file.size, 3);
    await assert.rejects(fal.download("https://example.com/file.bin"), (error: unknown) => error instanceof FalError);
  });

  it("refuses a queue answer that points off fal", async () => {
    const fal = createFalClient({
      key: KEY,
      fetch: routed(() => Response.json({ ...handleBody, status_url: "https://evil.example/status" })),
    });
    await assert.rejects(fal.submit("minimax/h3/ref2va/trainer", {}), (error: unknown) => error instanceof FalError && /suivi/.test((error as Error).message));
  });
});
