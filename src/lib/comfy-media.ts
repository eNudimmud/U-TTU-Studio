// Injected into the proxied Comfy document. It must run before Comfy's module.
// The asset list already sends Authorization. <img> and <video> cannot.
// This script copies that header onto the tile request and, when the src is
// a signed storage URL, loads it through /comfy-media-file on this origin.
// A queued run waits for the visitor to see its estimate and tap Lancer.
import { RUN_GATE_JS } from "./run-gate.ts";

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
      let label = path;
      if (path === "/api/view" || path === "/api/viewvideo") {
        const filename = abs.searchParams.get("filename");
        if (filename) label = path + "?filename=" + filename.slice(0, 96);
        else if (abs.search) label = path + abs.search.slice(0, 80);
      }
      return { href: abs.pathname + abs.search, needsToken: true, label: label };
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
function clipRun(text) {
  const clean = String(text || "").replace(/\\s+/g, " ").trim();
  if (!clean || /bearer\\s+\\S+/i.test(clean) || clean.indexOf("eyJ") >= 0) return "";
  return clean.slice(0, 240);
}
function runNote(line) {
  const body = document.body || document.documentElement;
  let box = document.getElementById("uttu-run-note");
  if (!box) {
    box = document.createElement("div");
    box.id = "uttu-run-note";
    box.setAttribute("role", "status");
    box.style.cssText = "position:fixed;z-index:2147483646;left:8px;right:8px;bottom:128px;max-height:28vh;overflow:auto;padding:8px 10px;border-radius:8px;background:#1c1408;color:#fff;font:600 12px/1.35 sans-serif";
    body.appendChild(box);
  }
  if (box.textContent !== line) box.textContent = line;
}
function pushRun(lines, text) {
  const line = clipRun(text);
  if (line && lines.indexOf(line) < 0) lines.push(line);
}
function linesFromRun(body) {
  const lines = [];
  const nodes = body && body.node_errors;
  if (nodes && typeof nodes === "object") {
    Object.keys(nodes).forEach((id) => {
      const node = nodes[id] || {};
      const errors = node.errors || [];
      errors.forEach((error) => pushRun(lines, (node.class_type || id) + " — " + (error.message || error.details || "")));
    });
  }
  const error = body && body.error;
  if (error && typeof error === "object") pushRun(lines, (error.type ? error.type + " — " : "") + (error.message || error.details || ""));
  else pushRun(lines, typeof error === "string" ? error : "");
  return lines;
}
function inspectRun(response) {
  try {
    const url = String(response && response.url || "");
    if (url.indexOf("/api/prompt") < 0) return;
    const type = (response.headers.get("content-type") || "");
    if (type.indexOf("json") < 0 || !response.clone) return;
    response.clone().json().then((body) => {
      const lines = linesFromRun(body).slice(0, 4);
      if (lines.length) runNote(lines.join(" · "));
    }).catch(() => {});
  } catch (e) {}
}
function piniaStore(id) {
  const root = document.getElementById("app") || document.querySelector("#vue-app");
  const vueApp = root && root.__vue_app__;
  const pinia = vueApp && vueApp.config && vueApp.config.globalProperties && vueApp.config.globalProperties.$pinia;
  return pinia && pinia._s && pinia._s.get(id);
}
function readMissingFiles(lines) {
  const media = piniaStore("missingMedia");
  const list = media && media.missingMediaCandidates;
  if (!list || !list.length) return;
  const names = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || item.isMissing === false) continue;
    const name = clipRun(item.name);
    if (name && names.indexOf(name) < 0) names.push(name);
  }
  if (!names.length) return;
  const extra = names.length > 3 ? " +" + (names.length - 3) : "";
  pushRun(lines, "fichier manquant — " + names.slice(0, 3).join(", ") + extra);
}
function readRunError() {
  try {
    const lines = [];
    readMissingFiles(lines);
    const store = piniaStore("executionError");
    if (store && store.isErrorOverlayOpen) {
      const found = linesFromRun({ node_errors: store.lastNodeErrors, error: store.lastPromptError });
      for (const line of found) pushRun(lines, line);
      const exec = store.lastExecutionError;
      if (exec) pushRun(lines, (exec.node_type || exec.node_id || "nœud") + " — " + (exec.exception_message || ""));
    }
    if (!lines.length) {
      const box = document.getElementById("uttu-run-note");
      if (box && box.parentNode) box.parentNode.removeChild(box);
      return;
    }
    runNote(lines.slice(0, 4).join(" · "));
  } catch (e) {}
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
function safeAssetName(name) {
  if (typeof name !== "string") return "";
  const clean = name.trim();
  if (!clean || clean.length > 180) return "";
  if (clean.indexOf("/") >= 0 || clean.indexOf("\\\\") >= 0 || /[\\u0000-\\u001f]/.test(clean) || clean === "." || clean === "..") return "";
  return clean;
}
function readTakeBrief() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    try {
      const open = indexedDB.open("uttu-take");
      open.onupgradeneeded = () => { try { open.transaction.abort(); } catch (e) {} finish(null); };
      open.onerror = () => finish(null);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("brief")) { try { db.close(); } catch (e) {} finish(null); return; }
        try {
          const request = db.transaction("brief").objectStore("brief").get("current");
          request.onsuccess = () => { try { db.close(); } catch (e) {} finish(request.result || null); };
          request.onerror = () => { try { db.close(); } catch (e) {} finish(null); };
        } catch (e) { try { db.close(); } catch (e2) {} finish(null); }
      };
    } catch (e) { finish(null); }
  });
}
function paintTakeNode(node, id, prompt, images) {
  if (id === "138" && prompt) {
    if (!Array.isArray(node.widgets_values)) node.widgets_values = [prompt];
    else node.widgets_values[0] = prompt;
    if (!node.widgets_values_named || typeof node.widgets_values_named !== "object") node.widgets_values_named = {};
    node.widgets_values_named.value = prompt;
    if (node.inputs && typeof node.inputs === "object") node.inputs.value = prompt;
    return true;
  }
  const image = images[id];
  if ((id === "137" || id === "139") && image) {
    if (!Array.isArray(node.widgets_values)) node.widgets_values = [image, "image"];
    else node.widgets_values[0] = image;
    if (!node.widgets_values_named || typeof node.widgets_values_named !== "object") node.widgets_values_named = {};
    node.widgets_values_named.image = image;
    if (typeof node.widgets_values_named.upload !== "string") node.widgets_values_named.upload = "image";
    if (node.inputs && typeof node.inputs === "object") node.inputs.image = image;
    return true;
  }
  return false;
}
function paintTakeGraph(graph, prompt, images) {
  let wrotePrompt = false;
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : null;
  if (nodes) {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (paintTakeNode(node, String(node.id), prompt, images) && String(node.id) === "138") wrotePrompt = true;
    }
    return wrotePrompt;
  }
  for (const id of ["137", "138", "139"]) {
    const node = graph && graph[id];
    if (!node || typeof node !== "object") continue;
    if (!node.inputs || typeof node.inputs !== "object") node.inputs = {};
    if (paintTakeNode(node, id, prompt, images) && id === "138") wrotePrompt = true;
  }
  return wrotePrompt;
}
async function uploadTakeFile(orig, file) {
  try {
    const body = new FormData();
    const blob = new Blob([file.bytes], { type: file.type || "application/octet-stream" });
    body.append("file", blob, String(file.name || "image.png").slice(0, 80));
    body.append("tags", "[\\"input\\"]");
    const headers = {};
    if (listHeaders && listHeaders.authorization) headers.authorization = listHeaders.authorization;
    if (listHeaders && listHeaders["x-api-key"]) headers["x-api-key"] = listHeaders["x-api-key"];
    const response = await orig("/api/assets", { method: "POST", body: body, headers: headers, credentials: "include" });
    if (!response.ok) return "";
    const data = await response.json();
    const name = data && (typeof data.name === "string" ? data.name : (data.asset && data.asset.name));
    return safeAssetName(name);
  } catch (e) { return ""; }
}
async function paintTake(response, orig) {
  try {
    if (!response || !response.ok || !response.clone) return response;
    const brief = await readTakeBrief();
    const prompt = brief && typeof brief.prompt === "string" ? brief.prompt.slice(0, 1600) : "";
    if (!prompt) return response;
    const graph = await response.clone().json();
    const images = {};
    const files = brief && Array.isArray(brief.files) ? brief.files : [];
    let missed = false;
    let sent = 0;
    for (const file of files) {
      const node = String(file && file.node || "");
      if (node !== "137" && node !== "139") continue;
      if (!file.bytes) continue;
      sent += 1;
      const name = await uploadTakeFile(orig, file);
      if (name) images[node] = name;
      else missed = true;
    }
    const wrotePrompt = paintTakeGraph(graph, prompt, images);
    if (!wrotePrompt) runNote("Le texte du plan n’a pas trouvé le champ prévu. Les images d’exemple restent.");
    else if (missed) runNote("Images d’exemple encore en place : le compte n’a pas accepté le fichier. Le texte du plan est écrit. Recharge après connexion.");
    else if (sent === 0) runNote("Le texte du plan est écrit. Aucune photo n’était jointe : les images d’exemple restent.");
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    if (!headers.get("content-type")) headers.set("content-type", "application/json");
    return new Response(JSON.stringify(graph), { status: response.status, statusText: response.statusText, headers: headers });
  } catch (e) {
    runNote("Le graphe d’exemple reste : le plan n’a pas pu être écrit.");
    return response;
  }
}
${RUN_GATE_JS}
let uttuBalance = null;
let gateChain = Promise.resolve();
function tellStudio(message) {
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage(message, location.origin);
  } catch (e) {}
}
function noteBalance(credits) {
  if (typeof credits !== "number" || !isFinite(credits)) return;
  const next = Math.round(credits);
  if (next === uttuBalance) return;
  uttuBalance = next;
  tellStudio({ type: "uttu-credits", credits: next, readAt: Date.now() });
}
function balanceUrl(url) {
  return /\\/(customers|billing)\\/balance(\\?|$)/.test(String(url || ""));
}
function readBalanceResponse(response) {
  try {
    if (!response || !response.ok || !response.clone || !balanceUrl(response.url)) return;
    response.clone().json().then((body) => noteBalance(gateBalanceFrom(body))).catch(() => {});
  } catch (e) {}
}
function readStoreBalance() {
  try {
    const store = piniaStore("auth");
    if (store && store.balance) noteBalance(gateBalanceFrom(store.balance));
  } catch (e) {}
}
function promptUrl(href) {
  try { return new URL(href, location.href).pathname === "/api/prompt"; } catch (e) { return false; }
}
function gateText(input, init) {
  if (init && typeof init.body === "string") return Promise.resolve(init.body);
  if (input instanceof Request) return input.clone().text().catch(() => "");
  return Promise.resolve("");
}
function gateLine(parent, text, css) {
  const line = document.createElement("p");
  line.textContent = text;
  line.style.cssText = "margin:0 0 6px;" + (css || "");
  parent.appendChild(line);
  return line;
}
function gateAsk(label, estimate, decision) {
  return new Promise((resolve) => {
    const host = document.body || document.documentElement;
    const wrap = document.createElement("div");
    wrap.id = "uttu-gate";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "uttu-gate-title");
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(10,10,11,.74);font:500 14px/1.5 system-ui,-apple-system,sans-serif;color:#f1ede6";
    const card = document.createElement("div");
    card.style.cssText = "width:min(420px,calc(100% - 32px));background:#111112;border:1px solid #c4a574;border-radius:10px;padding:20px 20px 16px;box-shadow:0 24px 64px rgba(0,0,0,.6)";
    const title = document.createElement("h2");
    title.id = "uttu-gate-title";
    title.textContent = "Lancer ce rendu ?";
    title.style.cssText = "margin:0 0 10px;font:600 20px/1.2 system-ui,-apple-system,sans-serif;color:#f1ede6";
    card.appendChild(title);
    gateLine(card, label, "color:#e6cfa7");
    gateLine(card, estimate ? "Estimation : " + gateCredits(estimate.low) + " à " + gateCredits(estimate.high) + " crédits. Non mesurée." : "Estimation : inconnue pour ce graphe.");
    gateLine(card, typeof uttuBalance === "number" ? "Ton solde : " + gateCredits(uttuBalance) + " crédits." : "Ton solde : non lu.");
    gateLine(card, decision.line, decision.tone === "block" ? "color:#df9390" : decision.tone === "warn" ? "color:#e6cfa7" : "color:#a8a6a2");
    gateLine(card, "Rien ne part sans ce clic. Le studio n’encaisse rien.", "color:#a8a6a2;font-size:12px;margin-top:4px");
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Annuler";
    cancel.style.cssText = "min-height:44px;padding:10px 18px;border:1px solid #8a7554;background:transparent;color:#f1ede6;border-radius:6px;font:600 14px system-ui,sans-serif;cursor:pointer";
    const launch = document.createElement("button");
    launch.type = "button";
    launch.id = "uttu-gate-launch";
    launch.textContent = "Lancer";
    launch.disabled = !decision.allow;
    launch.style.cssText = "min-height:44px;padding:10px 18px;border:1px solid #c4a574;background:#c4a574;color:#11100f;border-radius:6px;font:650 14px system-ui,sans-serif;cursor:pointer" + (decision.allow ? "" : ";opacity:.45;cursor:not-allowed");
    actions.appendChild(cancel);
    actions.appendChild(launch);
    card.appendChild(actions);
    wrap.appendChild(card);
    const finish = (ok) => {
      document.removeEventListener("keydown", onKey, true);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      resolve(ok);
    };
    const onKey = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); finish(false); }
    };
    cancel.addEventListener("click", () => finish(false));
    launch.addEventListener("click", () => { if (decision.allow) finish(true); });
    document.addEventListener("keydown", onKey, true);
    host.appendChild(wrap);
    cancel.focus();
  });
}
function gateRun(input, init) {
  const next = gateChain.then(() => gateText(input, init)).then((text) => {
    const run = gateClassify(text);
    const estimate = gateEstimate(run);
    const label = gateLabel(run);
    return gateAsk(label, estimate, gateDecide(estimate, uttuBalance)).then((ok) => {
      tellStudio({ type: "uttu-run", label: label, low: estimate ? estimate.low : null, high: estimate ? estimate.high : null, accepted: ok });
      return ok;
    });
  }).catch(() => window.confirm("Lancer ce rendu ? Le coût n’a pas pu être estimé. Il est débité sur ton compte."));
  gateChain = next.catch(() => false);
  return next;
}
function gateRefusal() {
  return new Response(JSON.stringify({ error: { type: "uttu_gate", message: "Lancement annulé dans le studio. Rien n’est parti.", details: "" }, node_errors: {} }), { status: 400, headers: { "content-type": "application/json" } });
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
    let href = "";
    let method = "GET";
    try {
      href = typeof input === "string" ? input : String((input && input.url) || "");
      method = String((init && init.method) || (input instanceof Request ? input.method : "GET")).toUpperCase();
    } catch (e) {}
    if (method === "POST" && promptUrl(href)) {
      const self = this;
      const args = arguments;
      return gateRun(input, init).then((ok) => {
        if (!ok) return gateRefusal();
        const sent = orig.apply(self, args);
        try {
          if (sent && sent.then) sent.then(inspectRun);
        } catch (e) {}
        return sent;
      });
    }
    const pending = orig.apply(this, arguments);
    try {
      if (pending && pending.then) {
        pending.then(inspectRun);
        pending.then(readBalanceResponse);
      }
    } catch (e) {}
    if (href.indexOf("/templates/video_minimax_h3_r2v.json") >= 0 && pending && pending.then) {
      return pending.then((response) => paintTake(response, orig));
    }
    return pending;
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
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { this.__uttuUrl = String(url || ""); } catch (e) {}
    return open.apply(this, arguments);
  };
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    try {
      if (balanceUrl(this.__uttuUrl)) {
        this.addEventListener("load", () => {
          try {
            if (this.status !== 200) return;
            const body = this.response && typeof this.response === "object" ? this.response : JSON.parse(this.responseText);
            noteBalance(gateBalanceFrom(body));
          } catch (e) {}
        });
      }
    } catch (e) {}
    return send.apply(this, arguments);
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
setInterval(readRunError, 1000);
setInterval(readStoreBalance, 2000);
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
