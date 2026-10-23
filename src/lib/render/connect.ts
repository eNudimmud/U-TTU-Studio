// « Connecter mon compte Comfy » : the two ways in, both on Comfy's side.
// 1. Comfy's own login page, served on the studio origin by src/proxy.ts. Comfy
//    stores its session in this origin's IndexedDB; session.ts reads it and
//    sends it as Bearer through the relay. No key to copy.
// 2. A Comfy API key, pasted once. It stays on this device.
// Comfy's OAuth server only accepts allowlisted web hosts (see docs/DECISIONS.md),
// so there is no third-party « Sign in with Comfy » redirect to use yet.

import type { RenderErrorCode } from "./client.ts";
import { cleanApiKey } from "./settings.ts";

/** Comfy's login, on this origin (proxied). Sign-up is linked from the same page. */
export const COMFY_LOGIN_PATH = "/cloud/login";
export const COMFY_SIGNUP_URL = "https://cloud.comfy.org/";
export const COMFY_PRICING_URL = "https://www.comfy.org/cloud/pricing";
export const COMFY_KEYS_URL = "https://platform.comfy.org/profile/api-keys?onboarding=router";
/** How often the open sheet looks for a fresh Comfy session while the login tab is open. */
export const SESSION_POLL_MS = 2000;

const COMFY_KEY = /comfyui-[A-Za-z0-9._~+/=-]{8,250}/;

/** A Comfy API key inside pasted text (a whole line, a sentence, quotes). Only `comfyui-` keys. */
export function findComfyKey(text: string): string | null {
  const match = COMFY_KEY.exec(text ?? "");
  return match ? cleanApiKey(match[0]) : null;
}

/** What the clipboard gave: a Comfy key to submit, a plausible key to show, or nothing usable. */
export function clipboardKey(text: string): { kind: "comfy" | "other"; key: string } | { kind: "none" } {
  const comfy = findComfyKey(text);
  if (comfy) return { kind: "comfy", key: comfy };
  const other = cleanApiKey(text ?? "");
  return other ? { kind: "other", key: other } : { kind: "none" };
}

export type ConnectMessage = "keyInvalid" | "keyRefused" | "keySubscription" | "keyCredits" | "keyNetwork" | "keyUnchecked";

/** One message per cause. A key Comfy accepts but cannot use for renders is not « refused ». */
export function connectMessage(code: RenderErrorCode | null): ConnectMessage {
  if (code === "auth") return "keyRefused";
  if (code === "subscription") return "keySubscription";
  if (code === "credits") return "keyCredits";
  if (code === "network" || code === "timeout") return "keyNetwork";
  if (code === "invalid") return "keyInvalid";
  return "keyUnchecked";
}

/** Messages that need the pricing link next to them. */
export function needsPricing(message: string): boolean {
  return message === "keySubscription" || message === "keyCredits";
}
