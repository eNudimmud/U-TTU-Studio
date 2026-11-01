// Canonical serialization and SHA-256 for snapshots, graphs and contexts (CONTRACTS « Références et
// snapshot »): sorted keys, no whitespace, `undefined` dropped like JSON. Keys, headers and signed
// URLs never enter a digest: callers pass only the relevant parameters, and `assertNoSecretFields`
// refuses an object that carries a credential-looking field.

/** JSON with object keys sorted at every depth. Arrays keep their order (order is meaning). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : sortDeep(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) out[key] = sortDeep(item);
    }
    return out;
  }
  return value;
}

export async function sha256Text(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function digestOf(value: unknown): Promise<string> {
  assertNoSecretFields(value);
  return sha256Text(canonicalJson(value));
}

const SECRET_KEY = /^(?:x-api-key|authorization|api_key_comfy_org|auth_token_comfy_org|apiKey|api_key|token|access_token|secret|password|cookie)$/i;
const SIGNED_URL = /[?&](?:X-Amz-Signature|Signature|sig|token)=/i;

/** Throws when an object meant for a digest, receipt or journal carries a credential field or a signed URL. */
export function assertNoSecretFields(value: unknown, path = "$"): void {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value) && SIGNED_URL.test(value)) throw new Error(`Signed URL at ${path}`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((item, index) => assertNoSecretFields(item, `${path}[${index}]`)); return; }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) throw new Error(`Secret field at ${path}.${key}`);
      assertNoSecretFields(item, `${path}.${key}`);
    }
  }
}
