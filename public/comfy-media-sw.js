// Thumbnails are <img> and <video>. They cannot send Authorization, and
// Comfy's host-only session cookie is not always present on this host.
// /api/view accepts a Firebase bearer (WWW-Authenticate: Bearer) and then
// 302s to a signed storage URL. This worker adds that bearer, then lets the
// element load the signed URL itself so the token never follows the redirect.

let token = "";

function openDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("comfy-media", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function remember(value) {
  token = value;
  const database = await openDb();
  await new Promise((resolve, reject) => {
    const tx = database.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, "token");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function remembered() {
  if (token) return token;
  try {
    const database = await openDb();
    token = await new Promise((resolve) => {
      const request = database.transaction("kv", "readonly").objectStore("kv").get("token");
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : "");
      request.onerror = () => resolve("");
    });
  } catch {
    token = "";
  }
  return token;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "comfy-token") return;
  const next = typeof event.data.token === "string" ? event.data.token : "";
  event.waitUntil(remember(next).then(() => {
    event.source?.postMessage({ type: "comfy-token-ack", has: Boolean(next) });
  }));
});

function mediaPath(pathname) {
  return pathname === "/api/view"
    || pathname === "/api/viewvideo"
    || pathname.startsWith("/api/assets/")
    || pathname.startsWith("/api/s/");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET" && event.request.method !== "HEAD") return;
  if (!mediaPath(url.pathname)) return;
  if (event.request.headers.has("authorization")) return;
  event.respondWith(load(event.request));
});

async function load(request) {
  const current = await remembered();
  // No token: replay the <img>/<video> request. Its no-cors mode follows the
  // storage redirect and can paint. A manual redirect would hide Location.
  if (!current) return fetch(request);
  const headers = new Headers(request.headers);
  headers.set("authorization", "Bearer " + current);
  let nextUrl = request.url;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(nextUrl, {
      method: request.method,
      headers,
      mode: "cors",
      credentials: "include",
      redirect: "manual",
      cache: "no-store",
    });
    if (response.headers.get("x-comfy-media-redirect") === "1") {
      const payload = await response.json();
      const target = new URL(payload.location, nextUrl);
      if (target.protocol !== "https:" && target.protocol !== "http:") break;
      if (target.origin !== new URL(nextUrl).origin) {
        return fetch(target.href, { mode: "no-cors", credentials: "omit", redirect: "follow", cache: "no-store" });
      }
      nextUrl = target.href;
      continue;
    }
    if (response.status === 401) return fetch(request);
    return response;
  }
  return fetch(request);
}
