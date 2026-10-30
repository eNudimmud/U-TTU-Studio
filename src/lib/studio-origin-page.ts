// Shown instead of looping when the authorized origin sends the visitor straight back
// (e.g. a Vercel domain redirect u-ttu-studio.vercel.app → uttu-studio.app is still on).
// Plain HTML from the proxy: no app bundle, one sentence of cause, two buttons (≥ 44 px).

import type { Locale } from "./i18n/config.ts";

const COPY: Record<Locale, { title: string; lead: string; retry: string; home: string; help: string }> = {
  fr: {
    title: "Le studio n'a pas pu s'ouvrir",
    lead: "Sur cette adresse, la connexion Comfy n'est pas encore autorisée. Le studio s'ouvre donc sur {origin}, mais cette adresse renvoie ici. Pour éviter une boucle, je m'arrête.",
    retry: "Réessayer",
    home: "Retour à l'accueil",
    help: "Si le problème continue, écris-nous : {email}",
  },
  en: {
    title: "The studio couldn't open",
    lead: "Comfy login isn't authorized on this address yet. The studio therefore opens on {origin}, but that address sends you back here. To avoid a loop, I stopped.",
    retry: "Try again",
    home: "Back to home",
    help: "If it keeps happening, write to us: {email}",
  },
  de: {
    title: "Das Studio konnte nicht geöffnet werden",
    lead: "Auf dieser Adresse ist die Comfy-Anmeldung noch nicht freigegeben. Das Studio öffnet sich deshalb auf {origin}, aber diese Adresse leitet hierher zurück. Um eine Schleife zu vermeiden, habe ich angehalten.",
    retry: "Erneut versuchen",
    home: "Zur Startseite",
    help: "Wenn es weiter passiert, schreib uns: {email}",
  },
  es: {
    title: "No se pudo abrir el estudio",
    lead: "En esta dirección el inicio de sesión de Comfy aún no está autorizado. Por eso el estudio se abre en {origin}, pero esa dirección te devuelve aquí. Para evitar un bucle, me he detenido.",
    retry: "Reintentar",
    home: "Volver al inicio",
    help: "Si sigue pasando, escríbenos: {email}",
  },
};

export function loopCopy(locale: Locale) {
  return COPY[locale];
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

export function loopPage(input: { locale: Locale; retry: string; home: string; origin: string; email: string }): string {
  const copy = COPY[input.locale];
  const lead = escape(copy.lead).replace("{origin}", `<strong>${escape(new URL(input.origin).host)}</strong>`);
  const help = escape(copy.help).replace("{email}", `<a href="mailto:${escape(input.email)}">${escape(input.email)}</a>`);
  const lang = input.locale === "fr" ? "fr-CH" : input.locale;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(copy.title)} · U*TTU Studio</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f0f11;color:#ece8df;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:34rem;padding:24px}h1{font-size:1.5rem;line-height:1.25;margin:0 0 12px}p{margin:0 0 16px;color:#c9c3b6}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 20px;border-radius:999px;text-decoration:none;font-weight:600}.primary{background:#d4a64a;color:#111}.secondary{border:1px solid #5a5548;color:#ece8df}small a{color:#d4a64a}</style></head>
<body><main id="contenu" data-studio-loop=""><h1>${escape(copy.title)}</h1><p>${lead}</p><div class="actions"><a class="primary" data-loop-retry="" href="${escape(input.retry)}">${escape(copy.retry)}</a><a class="secondary" data-loop-home="" href="${escape(input.home)}">${escape(copy.home)}</a></div><small>${help}</small></main></body></html>`;
}
