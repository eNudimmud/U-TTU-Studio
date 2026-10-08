import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFirebaseUser, refreshIdToken } from "../src/lib/render/session.ts";
import { cleanApiKey, readInFlight, readRenderLink, sameRenderLink, saveInFlight, saveRenderLink } from "../src/lib/render/settings.ts";

function memory() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
}

describe("session du compte de rendu", () => {
  it("reads the session Comfy stored on this origin, and nothing else", () => {
    const user = readFirebaseUser({ uid: "u", apiKey: "AIzaSyExample_123", stsTokenManager: { accessToken: "id.token.sig", refreshToken: "refresh-1", expirationTime: 1_900_000_000_000 } });
    assert.deepEqual(user, { apiKey: "AIzaSyExample_123", refreshToken: "refresh-1", accessToken: "id.token.sig", expirationTime: 1_900_000_000_000 });
    assert.equal(readFirebaseUser({ apiKey: "bad key!", stsTokenManager: { refreshToken: "r" } }), null);
    assert.equal(readFirebaseUser({ stsTokenManager: { refreshToken: "r" } }), null);
    assert.equal(readFirebaseUser("nope"), null);
  });

  it("refreshes an expired session the way the web SDK does", async () => {
    let seen: { url: string; body: string } | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      seen = { url: String(input), body: String(init?.body) };
      return new Response(JSON.stringify({ id_token: "fresh.id.token", refresh_token: "refresh-2", expires_in: "3600" }), { headers: { "content-type": "application/json" } });
    };
    const fresh = await refreshIdToken({ apiKey: "AIzaSyExample_123", refreshToken: "refresh-1", accessToken: "", expirationTime: 0 }, fetchImpl);
    assert.equal(fresh?.accessToken, "fresh.id.token");
    assert.equal(fresh?.refreshToken, "refresh-2");
    assert.ok((fresh?.expirationTime ?? 0) > Date.now() + 3_000_000);
    assert.equal(seen!.url, "https://securetoken.googleapis.com/v1/token?key=AIzaSyExample_123");
    assert.equal(seen!.body, "grant_type=refresh_token&refresh_token=refresh-1");
    const refused = await refreshIdToken({ apiKey: "AIzaSyExample_123", refreshToken: "r", accessToken: "", expirationTime: 0 }, async () => new Response("{}", { status: 400 }));
    assert.equal(refused, null);
  });

  it("keeps the link and the take in flight on this device only", () => {
    const storage = memory();
    assert.deepEqual(readRenderLink(storage), { mode: "none" });
    assert.equal(cleanApiKey(" short "), null);
    assert.equal(cleanApiKey("comfyui-0123456789abcdef"), "comfyui-0123456789abcdef");
    saveRenderLink(storage, { mode: "key", key: "comfyui-0123456789abcdef" });
    const linked = readRenderLink(storage);
    assert.deepEqual(linked, { mode: "key", key: "comfyui-0123456789abcdef" });
    assert.equal(sameRenderLink(linked, { mode: "key", key: "comfyui-0123456789abcdef" }), true);
    assert.equal(sameRenderLink(linked, { mode: "key", key: "comfyui-ffffffffffffffff" }), false);
    assert.equal(sameRenderLink({ mode: "session" }, { mode: "session" }), true);
    assert.equal(sameRenderLink({ mode: "none" }, { mode: "session" }), false);
    saveRenderLink(storage, { mode: "none" });
    assert.deepEqual(readRenderLink(storage), { mode: "none" });
    assert.equal(readInFlight(storage), null);
    const flight = { jobId: "job-0123456789", at: "2026-10-03T15:30:00.000Z", sceneId: "le-quai", sceneName: "Le quai", line: "x", prompt: "p", settings: { seconds: 5, quality: "rapide", aspect: "vertical" } as const, balanceBefore: 5001 };
    saveInFlight(storage, flight);
    assert.deepEqual(readInFlight(storage), flight);
    saveInFlight(storage, null);
    assert.equal(readInFlight(storage), null);
    storage.setItem("u-ttu-tournage", JSON.stringify({ ...flight, jobId: "../../etc" }));
    assert.equal(readInFlight(storage), null);
  });
});
