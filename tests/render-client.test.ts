import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BALANCE_URL, RenderError, createRenderClient, executionSeconds, jobStage, videoOutput } from "../src/lib/render/client.ts";
import { followTake, runTake, type TakeRunEvent } from "../src/lib/render/run.ts";

type Call = { url: string; method: string; headers: Headers; body: unknown };

function fakeCloud(routes: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = { url: String(input), method: init?.method ?? "GET", headers: new Headers(init?.headers), body: init?.body };
    calls.push(call);
    return routes(call) ?? new Response("not found", { status: 404 });
  };
  return { calls, fetchImpl };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("client du compte de rendu", () => {
  it("sends the key on every call through this host, and reads the balance in credits", async () => {
    const { calls, fetchImpl } = fakeCloud(call => {
      if (call.url === "/api/billing/usage/timeseries?granularity=month&months=1") return json({ summary: { balance: { amount_micros: 4200, currency: "USD" } } });
      if (call.url === "/api/upload/image") return json({ name: "uttu-1.jpg", subfolder: "", type: "input" });
      if (call.url === "/api/prompt") return json({ prompt_id: "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11", number: 1, node_errors: {} });
      return undefined;
    });
    const client = createRenderClient({ auth: { kind: "key", key: "comfyui-0123456789abcdef" }, fetch: fetchImpl });
    assert.equal(await client.balance(), 8862);
    assert.equal(await client.upload(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "uttu-1.jpg"), "uttu-1.jpg");
    const upload = calls.find(call => call.url === "/api/upload/image");
    assert.ok(upload?.body instanceof FormData);
    assert.ok((upload.body as FormData).get("image") instanceof Blob);
    assert.equal((upload.body as FormData).get("type"), "input");
    assert.equal(await client.submit({ a: { class_type: "SaveVideo", inputs: {} } }, "client-1"), "0f6c1b1e-8d47-4f39-9e16-5f5d0f0b9a11");
    const prompt = calls.find(call => call.url === "/api/prompt");
    assert.deepEqual(JSON.parse(String(prompt?.body)), { prompt: { a: { class_type: "SaveVideo", inputs: {} } }, client_id: "client-1" });
    for (const call of calls) {
      assert.equal(call.headers.get("x-api-key"), "comfyui-0123456789abcdef");
      assert.equal(call.headers.get("authorization"), null);
      assert.ok(call.url.startsWith("/api/"), "everything goes through the same-origin relay");
    }
  });

  it("uses the session token, and reads the balance where Comfy's own app reads it", async () => {
    const { calls, fetchImpl } = fakeCloud(call => (call.url === BALANCE_URL ? json({ amount_micros: 1000, currency: "usd" }) : undefined));
    const client = createRenderClient({ auth: { kind: "session", token: async () => "firebase-id-token" }, fetch: fetchImpl });
    assert.equal(await client.balance(), 2110);
    assert.equal(calls[0].headers.get("authorization"), "Bearer firebase-id-token");
    const signedOut = createRenderClient({ auth: { kind: "session", token: async () => null }, fetch: fetchImpl });
    await assert.rejects(() => signedOut.user(), (error: unknown) => error instanceof RenderError && error.code === "auth");
  });

  it("turns refusals into plain reasons, node by node", async () => {
    const statuses: Record<string, Response> = {};
    const { fetchImpl } = fakeCloud(call => statuses[call.url]);
    const client = createRenderClient({ auth: { kind: "key", key: "comfyui-0123456789abcdef" }, fetch: fetchImpl });
    statuses["/api/prompt"] = json({ error: { type: "prompt_outputs_failed_validation", message: "Prompt outputs failed validation" }, node_errors: { take: { class_type: "MiniMaxH3ReferenceToVideo", errors: [{ message: "Required input is missing", details: "clip" }] } } }, 400);
    await assert.rejects(() => client.submit({}, "c"), (error: unknown) => error instanceof RenderError && error.code === "invalid" && error.detail.includes("MiniMaxH3ReferenceToVideo : Required input is missing"));
    statuses["/api/prompt"] = new Response("{}", { status: 402 });
    await assert.rejects(() => client.submit({}, "c"), (error: unknown) => error instanceof RenderError && error.code === "credits");
    statuses["/api/prompt"] = new Response("{}", { status: 429 });
    await assert.rejects(() => client.submit({}, "c"), (error: unknown) => error instanceof RenderError && error.code === "subscription");
    statuses["/api/user"] = new Response("{}", { status: 401 });
    await assert.rejects(() => client.user(), (error: unknown) => error instanceof RenderError && error.code === "auth");
  });

  it("reads job states, the saved video, and the cloud's own execution time", () => {
    for (const status of ["submitted", "queued_waiting", "pending", "waiting_to_dispatch"]) assert.equal(jobStage(status), "queue");
    assert.equal(jobStage("preparing"), "prepare");
    assert.equal(jobStage("executing"), "render");
    assert.equal(jobStage("in_progress"), "render");
    for (const status of ["success", "completed"]) assert.equal(jobStage(status), "done");
    for (const status of ["error", "non_retryable_error", "failed", "lost"]) assert.equal(jobStage(status), "failed");
    assert.equal(jobStage("cancelled"), "cancelled");
    assert.deepEqual(videoOutput({ save: { images: [{ filename: "uttu/prise_00001_.mp4", subfolder: "", type: "output" }], animated: [true] } }), { filename: "uttu/prise_00001_.mp4", subfolder: "", type: "output" });
    assert.deepEqual(videoOutput({ save: { video: [{ filename: "prise.webm" }] } }), { filename: "prise.webm", subfolder: "", type: "output" });
    assert.equal(videoOutput({ save: { images: [{ filename: "still.png" }] } }), null);
    assert.equal(executionSeconds({ status: "completed", execution_status: { messages: [["execution_start", { timestamp: 1_000_000 }], ["execution_cached", { timestamp: 1_000_500 }], ["execution_success", { timestamp: 1_245_000 }]] } }), 245);
    assert.equal(executionSeconds({ status: "completed", execution_start_time: 1_700_000_000_000, execution_end_time: 1_700_000_090_000 }), 90);
    assert.equal(executionSeconds({ status: "completed" }), null);
  });
});

describe("une prise sans quitter le studio", () => {
  function scriptedCloud(statuses: string[], cents: number[]) {
    const queue = [...statuses];
    const reads = [...cents];
    const { calls, fetchImpl } = fakeCloud(call => {
      if (call.url === "/api/upload/image") return json({ name: `in-${calls.length}.jpg` });
      if (call.url === "/api/prompt") return json({ prompt_id: "job-0123456789", number: 1, node_errors: {} });
      if (call.url === "/api/job/job-0123456789/status") return json({ status: queue.length > 1 ? queue.shift() : queue[0] });
      if (call.url === "/api/jobs/job-0123456789") {
        return json({ status: "completed", outputs: { save: { images: [{ filename: "uttu/prise_00001_.mp4", subfolder: "", type: "output" }] } }, execution_start_time: 1_759_500_000_000, execution_end_time: 1_759_500_140_000 });
      }
      if (call.url.startsWith("/api/view?")) return new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), { headers: { "content-type": "video/mp4" } });
      if (call.url.startsWith("/api/billing/usage/timeseries")) {
        const amount = reads.length > 1 ? reads.shift()! : reads[0];
        return json({ summary: { balance: { amount_micros: amount, currency: "USD" } } });
      }
      return undefined;
    });
    return { calls, client: createRenderClient({ auth: { kind: "key", key: "comfyui-0123456789abcdef" }, fetch: fetchImpl }) };
  }

  it("uploads, queues, follows, brings the video back and measures the charge", async () => {
    const { calls, client } = scriptedCloud(["submitted", "queued_waiting", "executing", "executing", "success"], [2370, 2370, 2275]);
    const events: TakeRunEvent[] = [];
    const clock = { now: 0 };
    const result = await runTake(client, {
      pictures: [{ blob: new Blob(["a"], { type: "image/jpeg" }), name: "uttu-1.jpg" }, { blob: new Blob(["b"], { type: "image/jpeg" }), name: "uttu-2.jpg" }],
      prompt: "<Picture 1> shows the same person.",
      settings: { seconds: 5, quality: "rapide", aspect: "vertical" },
      seed: 9,
      clientId: "client-1",
    }, 5001, event => events.push(event), { sleep: async ms => { clock.now += ms; }, now: () => clock.now, pollMs: 1000, measureMs: 10 });
    assert.equal(result.jobId, "job-0123456789");
    assert.equal(result.video.type, "video/mp4");
    assert.equal(result.filename, "uttu/prise_00001_.mp4");
    assert.equal(result.gpuSeconds, 140);
    assert.equal(result.balanceAfter, 4800);
    assert.equal(result.costCredits, 201);
    assert.deepEqual(events.map(event => event.stage), ["upload", "upload", "upload", "submit", "queue", "queue", "render", "render", "fetch", "measure"]);
    const sent = JSON.parse(String(calls.find(call => call.url === "/api/prompt")?.body));
    assert.deepEqual(sent.prompt.take.inputs["ref_images.ref_image_1"], ["picture_2", 0]);
    assert.equal(sent.prompt.picture_1.inputs.image, "in-1.jpg");
    assert.equal(calls.filter(call => call.url === "/api/prompt").length, 1, "one confirmed take, one queued run");
  });

  it("says when the charge is not visible yet instead of inventing one", async () => {
    const { client } = scriptedCloud(["success"], [2370]);
    const result = await followTake(client, "job-0123456789", 5001, () => {}, { sleep: async () => {}, measureTries: 3, measureMs: 1 });
    assert.equal(result.costCredits, null);
    assert.equal(result.balanceAfter, null);
  });

  it("rides out a few unreachable reads while the phone changes networks", async () => {
    const { client } = scriptedCloud(["executing", "success"], [2370, 2275]);
    let drops = 2;
    const flaky = { ...client, status: async (id: string) => { if (drops-- > 0) throw new RenderError("network", "hors ligne"); return client.status(id); } };
    const result = await followTake(flaky, "job-0123456789", 5001, () => {}, { sleep: async () => {}, measureMs: 1 });
    assert.equal(result.costCredits, 201);
    const down = { ...client, status: async () => { throw new RenderError("network", "hors ligne"); } };
    await assert.rejects(() => followTake(down, "job-0123456789", 5001, () => {}, { sleep: async () => {} }), (error: unknown) => error instanceof RenderError && error.code === "network");
  });

  it("stops on a cloud failure and on a cancel, and cancels the job it queued", async () => {
    const failing = scriptedCloud(["executing", "error"], [2370]);
    await assert.rejects(() => followTake(failing.client, "job-0123456789", 5001, () => {}, { sleep: async () => {} }), (error: unknown) => error instanceof RenderError && error.code === "failed");
    const cancelled = scriptedCloud(["executing"], [2370]);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => followTake(cancelled.client, "job-0123456789", 5001, () => {}, { sleep: async () => {}, signal: controller.signal }), (error: unknown) => error instanceof RenderError && error.code === "cancelled");
    assert.ok(cancelled.calls.some(call => call.url === "/api/queue" && JSON.parse(String(call.body)).delete[0] === "job-0123456789"));
  });
});
