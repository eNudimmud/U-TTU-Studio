// Injected into the proxied Comfy document. It must run before Comfy's module
// so the first thumbnail request already carries the Firebase bearer.
export const COMFY_MEDIA_SW = "/comfy-media-sw.js";

export const COMFY_MEDIA_BOOT = `<script type="module">
function tokenFrom(parsed) {
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
async function readToken() {
  const local = readLocal();
  if (local) return local;
  try {
    if (!indexedDB.databases) return "";
    const listed = await indexedDB.databases();
    if (!listed.some((entry) => entry.name === "firebaseLocalStorageDb")) return "";
    const database = await new Promise((resolve, reject) => {
      const open = indexedDB.open("firebaseLocalStorageDb");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const rows = await new Promise((resolve) => {
      const request = database.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
    for (const row of rows) {
      const token = tokenFrom(row && (row.value || row));
      if (token) return token;
    }
  } catch (e) {}
  return "";
}
async function publish(worker) {
  if (worker) worker.postMessage({ type: "comfy-token", token: await readToken() });
}
try {
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.register(${JSON.stringify(COMFY_MEDIA_SW)});
    await Promise.race([navigator.serviceWorker.ready, new Promise((resolve) => setTimeout(resolve, 4000))]);
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    const post = () => publish(navigator.serviceWorker.controller || reg.active);
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 4000);
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "comfy-token-ack") { clearTimeout(timer); resolve(); }
      });
      post();
    });
    setInterval(post, 1000);
    document.addEventListener("visibilitychange", post);
  }
} catch (e) {}
try {
  const entry = document.querySelector("script[data-comfy-main]");
  if (entry) await import(entry.getAttribute("src"));
} catch (e) {}
</script>`;
