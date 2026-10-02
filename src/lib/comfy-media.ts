// Injected into the proxied Comfy document. It must run before Comfy's module.
// A hard reload skips the service worker, so the token is also written to
// `__Host-uttu_media` first. The proxy turns that cookie into Authorization
// on thumbnail and video GETs. Comfy is imported only after that write.
export const COMFY_MEDIA_SW = "/comfy-media-sw.js";

export const COMFY_MEDIA_BOOT = `<script type="module">
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
