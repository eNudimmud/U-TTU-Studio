import { test } from "node:test";
import assert from "node:assert/strict";
import { clipboardKey, connectMessage, findComfyKey, needsPricing, COMFY_KEYS_URL, COMFY_LOGIN_PATH } from "../src/lib/render/connect.ts";
import { createRenderClient, getComfyAuthHeaders } from "../src/lib/render/client.ts";
import { refreshIdToken, readFirebaseUser } from "../src/lib/render/session.ts";
import { classifyComfy } from "../src/lib/comfy-proxy.ts";

const KEY = "comfyui-0123456789abcdef0123456789abcdef";

test("a Comfy key is found inside whatever was pasted", () => {
  assert.equal(findComfyKey(KEY), KEY);
  assert.equal(findComfyKey(`  ${KEY}\n`), KEY);
  assert.equal(findComfyKey(`Ta clé : "${KEY}"`), KEY);
  assert.equal(findComfyKey("comfyui-short"), null);
  assert.equal(findComfyKey("bonjour"), null);
  assert.equal(findComfyKey(""), null);
});

test("the clipboard gives a key to submit, a key to show, or nothing", () => {
  assert.deepEqual(clipboardKey(KEY), { kind: "comfy", key: KEY });
  assert.deepEqual(clipboardKey("fake-test-key-123"), { kind: "other", key: "fake-test-key-123" });
  assert.deepEqual(clipboardKey("une phrase avec des espaces"), { kind: "none" });
  assert.deepEqual(clipboardKey(""), { kind: "none" });
});

test("each connect failure has its own message, and only plan problems link to pricing", () => {
  assert.equal(connectMessage("auth"), "keyRefused");
  assert.equal(connectMessage("subscription"), "keySubscription");
  assert.equal(connectMessage("credits"), "keyCredits");
  assert.equal(connectMessage("network"), "keyNetwork");
  assert.equal(connectMessage("timeout"), "keyNetwork");
  assert.equal(connectMessage("invalid"), "keyInvalid");
  assert.equal(connectMessage(null), "keyUnchecked");
  assert.equal(connectMessage("failed"), "keyUnchecked");
  assert.ok(needsPricing("keySubscription") && needsPricing("keyCredits"));
  assert.ok(!needsPricing("keyRefused") && !needsPricing("keyNetwork"));
});

test("the key page is Comfy's own, and the login stays on this origin through the proxy", () => {
  assert.equal(new URL(COMFY_KEYS_URL).hostname, "platform.comfy.org");
  assert.equal(new URL(COMFY_KEYS_URL).pathname, "/profile/api-keys");
  assert.ok(COMFY_LOGIN_PATH.startsWith("/cloud/"));
  const route = classifyComfy(new URL(`https://u-ttu-studio.vercel.app${COMFY_LOGIN_PATH}`));
  assert.equal(route.kind, "proxy");
});

test("auth headers: X-API-Key for a key, Bearer for a session, nothing when unlinked", async () => {
  assert.deepEqual(await getComfyAuthHeaders({ kind: "key", key: KEY }), { "x-api-key": KEY });
  assert.deepEqual(await getComfyAuthHeaders({ kind: "session", token: async () => "jwt.abc" }), { authorization: "Bearer jwt.abc" });
  assert.equal(await getComfyAuthHeaders({ kind: "session", token: async () => null }), null);
  assert.equal(await getComfyAuthHeaders(null), null);
});

test("the renderer sends the session as Bearer and maps a 429 to subscription", async () => {
  const seen: Headers[] = [];
  const client = createRenderClient({ auth: { kind: "session", token: async () => "jwt.xyz" }, fetch: async (_input, init) => { seen.push(new Headers(init?.headers)); return new Response("{}", { status: 429 }); } });
  await assert.rejects(client.user(), (error: { code?: string }) => error.code === "subscription");
  assert.equal(seen[0].get("authorization"), "Bearer jwt.xyz");
  assert.equal(seen[0].get("x-api-key"), null);
});

test("an expired Comfy session is refreshed and the new refresh token kept", async () => {
  const user = readFirebaseUser({ apiKey: "AIzaTest_key-1", stsTokenManager: { refreshToken: "r1", accessToken: "old", expirationTime: 1 } });
  assert.ok(user);
  let body = "";
  const next = await refreshIdToken(user!, async (_input, init) => { body = String(init?.body); return Response.json({ id_token: "new", refresh_token: "r2", expires_in: "3600" }); });
  assert.match(body, /grant_type=refresh_token/);
  assert.match(body, /refresh_token=r1/);
  assert.equal(next?.accessToken, "new");
  assert.equal(next?.refreshToken, "r2");
  assert.ok((next?.expirationTime ?? 0) > Date.now() + 3_000_000);
  assert.equal(await refreshIdToken(user!, async () => new Response("no", { status: 400 })), null);
  assert.equal(readFirebaseUser({ apiKey: "bad key!", stsTokenManager: { refreshToken: "r" } }), null);
});
