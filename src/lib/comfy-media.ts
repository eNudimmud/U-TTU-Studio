// Injected into the proxied Comfy document. It must run before Comfy's module.
// The asset list already sends Authorization. <img> and <video> cannot.
// This script copies that header onto the tile request and, when the src is
// a signed storage URL, loads it through /comfy-media-file on this origin.
export const COMFY_MEDIA_SW = "/comfy-media-sw.js";

export const COMFY_MEDIA_BOOT = `<script type="module">
let listHeaders = null;
const waiting = [];
function storageHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\\.+$/, "");
  return host === "storage.googleapis.com" || host === "storage.cloud.google.com" || host.endsWith(".storage.googleapis.com") || host.endsWith(".googleusercontent.com");
}
function routeMedia(raw) {
  try {
    const abs = new URL(raw, location.href);
    if (abs.protocol === "blob:" || abs.protocol === "data:") return null;
    const path = abs.pathname;
    if (abs.origin === location.origin && (path === "/api/view" || path === "/api/viewvideo" || path.startsWith("/api/assets/") || path.startsWith("/api/s/"))) {
      return { href: abs.pathname + abs.search, needsToken: true, label: path };
    }
    if (abs.protocol === "https:" && storageHost(abs.hostname)) {
      return { href: "/comfy-media-file?u=" + encodeURIComponent(abs.href), needsToken: false, label: abs.hostname + path };
    }
  } catch (e) {}
  return null;
}
function note(line) {
  const body = document.body || document.documentElement;
  let box = document.getElementById("uttu-media-note");
  if (!box) {
    box = document.createElement("div");
    box.id = "uttu-media-note";
    box.setAttribute("role", "status");
    box.style.cssText = "position:fixed;z-index:2147483647;left:8px;right:8px;bottom:72px;padding:8px 10px;border-radius:8px;background:#3a1010;color:#fff;font:600 12px/1.35 sans-serif";
    body.appendChild(box);
  }
  const count = Number(box.dataset.count || 0) + 1;
  box.dataset.count = String(count);
  box.textContent = count > 1 ? line + " · " + count + " tuiles" : line;
}
function remember(map) {
  const next = {};
  if (map.authorization) next.authorization = map.authorization;
  if (map["x-api-key"]) next["x-api-key"] = map["x-api-key"];
  if (!next.authorization && !next["x-api-key"]) return;
  if (listHeaders && listHeaders.authorization === next.authorization && listHeaders["x-api-key"] === next["x-api-key"]) return;
  listHeaders = next;
  const match = /^Bearer\\s+(\\S+)/i.exec(next.authorization || "");
  if (match) {
    try {
      const worker = navigator.serviceWorker && navigator.serviceWorker.controller;
      if (worker) worker.postMessage({ type: "comfy-token", token: match[1] });
    } catch (e) {}
  }
  const batch = waiting.splice(0);
  for (const item of batch) loadMedia(item);
}
function hookFetch() {
  const orig = window.fetch;
  window.fetch = function (input, init) {
    try {
      const headers = new Headers(init && init.headers);
      if (input instanceof Request) input.headers.forEach((value, key) => { if (!headers.has(key)) headers.set(key, value); });
      const map = {};
      const auth = headers.get("authorization");
      const apiKey = headers.get("x-api-key");
      if (auth) map.authorization = auth;
      if (apiKey) map["x-api-key"] = apiKey;
      remember(map);
    } catch (e) {}
    return orig.apply(this, arguments);
  };
  const setHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    const key = String(name).toLowerCase();
    if (key === "authorization" || key === "x-api-key") {
      if (!this.__uttuAuth) this.__uttuAuth = {};
      this.__uttuAuth[key] = value;
      remember(this.__uttuAuth);
    }
    return setHeader.apply(this, arguments);
  };
}
function loadMedia(item) {
  const el = item.el;
  if (el.dataset.uttuSrc === item.raw && el.dataset.uttuState === "run") return;
  el.dataset.uttuSrc = item.raw;
  el.dataset.uttuState = "run";
  if (item.routed.needsToken && !listHeaders) {
    el.dataset.uttuState = "wait";
    waiting.push(item);
    return;
  }
  const headers = {};
  if (item.routed.needsToken && listHeaders) {
    if (listHeaders.authorization) headers.authorization = listHeaders.authorization;
    if (listHeaders["x-api-key"]) headers["x-api-key"] = listHeaders["x-api-key"];
  }
  fetch(item.routed.href, { headers: headers, credentials: "include", cache: "no-store" }).then(async (response) => {
    const type = (response.headers.get("content-type") || "").split(";")[0];
    if (!response.ok || type.indexOf("json") >= 0 || type.indexOf("text/") === 0) {
      note(response.status + " " + item.routed.label + (type ? " " + type : ""));
      el.dataset.uttuState = "fail";
      item.nativeSet.call(el, item.raw);
      return;
    }
    const blob = await response.blob();
    if (blob.size > 25000000) {
      note("fichier trop lourd " + item.routed.label);
      el.dataset.uttuState = "fail";
      item.nativeSet.call(el, item.raw);
      return;
    }
    el.dataset.uttuState = "ok";
    if (window.HTMLVideoElement && el instanceof HTMLVideoElement) el.preload = "auto";
    item.nativeSet.call(el, URL.createObjectURL(blob));
  }).catch(() => {
    note("réseau " + item.routed.label);
    el.dataset.uttuState = "fail";
    item.nativeSet.call(el, item.raw);
  });
}
function hookSrc(proto) {
  const desc = Object.getOwnPropertyDescriptor(proto, "src");
  if (!desc || !desc.set || !desc.get) return;
  const nativeSet = desc.set;
  const nativeGet = desc.get;
  Object.defineProperty(proto, "src", {
    configurable: true,
    enumerable: true,
    get() { return nativeGet.call(this); },
    set(value) {
      const raw = String(value || "");
      if (this.dataset.uttuSrc === raw && (this.dataset.uttuState === "ok" || this.dataset.uttuState === "wait" || this.dataset.uttuState === "run")) return;
      const routed = routeMedia(raw);
      if (!routed) {
        nativeSet.call(this, value);
        return;
      }
      loadMedia({ el: this, raw: raw, routed: routed, nativeSet: nativeSet });
    }
  });
}
hookFetch();
hookSrc(HTMLImageElement.prototype);
if (window.HTMLMediaElement) hookSrc(HTMLMediaElement.prototype);
setTimeout(() => {
  if (listHeaders || !waiting.length) return;
  const stuck = waiting.splice(0);
  for (const item of stuck) {
    note("aucun jeton sur la liste · " + item.routed.label);
    item.el.dataset.uttuState = "fail";
    item.nativeSet.call(item.el, item.raw);
  }
}, 8000);
function tokenFrom(parsed) {
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch (e) { return ""; }
  }
  const manager = parsed && parsed.stsTokenManager;
  const token = manager && manager.accessToken;
  const exp = Number(manager && manager.expirationTime);
  if (typeof token === "string" && token && (!(exp > 0) || exp > Date.now() + 15000)) return token;
  return "";
}
function readLocal() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("firebase:authUser:")) continue;
      const token = tokenFrom(JSON.parse(localStorage.getItem(key) || "null"));
      if (token) return token;
    }
  } catch (e) {}
  return "";
}
function readSession() {
  try {
    const token = sessionStorage.getItem("Comfy.Workspace.Token") || "";
    const exp = Number(sessionStorage.getItem("Comfy.Workspace.ExpiresAt"));
    if (token && (!(exp > 0) || exp > Date.now() + 15000)) return token;
  } catch (e) {}
  return "";
}
function arm(token) {
  if (!token) return;
  let maxAge = 3300;
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const body = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(atob(body + "=".repeat((4 - (body.length % 4)) % 4)));
      const exp = Number(payload && payload.exp) * 1000;
      if (exp > Date.now() + 60000) maxAge = Math.floor((exp - Date.now()) / 1000) - 30;
    } catch (e) {}
  }
  document.cookie = "__Host-uttu_media=" + encodeURIComponent(token) + "; Path=/; Secure; SameSite=Lax; Max-Age=" + maxAge;
}
async function readIdb() {
  try {
    const database = await new Promise((resolve) => {
      const open = indexedDB.open("firebaseLocalStorageDb");
      open.onupgradeneeded = () => { try { open.transaction.abort(); } catch (e) {} };
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("firebaseLocalStorage")) {
          try { db.close(); } catch (e) {}
          indexedDB.deleteDatabase("firebaseLocalStorageDb");
          resolve(null);
          return;
        }
        resolve(db);
      };
      open.onerror = () => resolve(null);
    });
    if (!database) return "";
    const rows = await new Promise((resolve) => {
      try {
        const request = database.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
    try { database.close(); } catch (e) {}
    for (const row of rows) {
      const token = tokenFrom(row && (row.value || row));
      if (token) return token;
    }
  } catch (e) {}
  return "";
}
async function readToken() {
  const local = readLocal();
  if (local) return local;
  const stored = await readIdb();
  if (stored) return stored;
  return readSession();
}
function publish(worker, token) {
  if (worker) worker.postMessage({ type: "comfy-token", token: token });
}
try {
  let current = await readToken();
  arm(current);
  const sync = async () => {
    const next = await readToken();
    if (next) arm(next);
    current = next;
    publish(navigator.serviceWorker && (navigator.serviceWorker.controller || null), next);
  };
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.register(${JSON.stringify(COMFY_MEDIA_SW)});
    await Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(resolve, 4000))]);
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 4000);
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "comfy-token-ack") { clearTimeout(timer); resolve(); }
      });
      publish(navigator.serviceWorker.controller || reg.active, current);
    });
    const post = () => sync().then(() => publish(navigator.serviceWorker.controller || reg.active, current));
    setInterval(post, 1000);
    document.addEventListener("visibilitychange", post);
  }
} catch (e) {}
try {
  const entry = document.querySelector("script[data-comfy-main]");
  if (entry) await import(entry.getAttribute("src"));
} catch (e) {}
</script>`;
