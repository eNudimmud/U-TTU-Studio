import { FAL_PROXY_ROUTES, type FalGenRequest, type FalJob, type FalJobResult, type FalJobStatus } from "./fal-stack.ts";

// Browser side: talks to the studio proxy (workers/fal-proxy), which holds the fal key.
export interface FalProxy { url: string; token: string; fetch?: typeof fetch }

export class FalProxyError extends Error {
  status: number;
  problems: string[];
  constructor(message: string, status: number, problems: string[] = []) {
    super(message);
    this.name = "FalProxyError";
    this.status = status;
    this.problems = problems;
  }
}

async function call<T>(proxy: FalProxy, path: string, init: RequestInit): Promise<T> {
  const send = proxy.fetch ?? fetch;
  let response: Response;
  try {
    response = await send(`${proxy.url}${path}`, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${proxy.token}` } });
  } catch {
    throw new FalProxyError("Proxy injoignable : réseau coupé, ou origine non autorisée (CORS).", 0);
  }
  const body = (await response.json().catch(() => ({}))) as { error?: unknown; problems?: unknown };
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : `Proxy : erreur ${response.status}.`;
    throw new FalProxyError(message, response.status, Array.isArray(body.problems) ? body.problems.map(String) : []);
  }
  return body as T;
}

export const startFalTraining = (proxy: FalProxy, zip: Blob, trigger: string, steps: number) =>
  call<{ id: string }>(proxy, `${FAL_PROXY_ROUTES.train}?${new URLSearchParams({ trigger, steps: String(steps) })}`, {
    method: "POST", headers: { "Content-Type": "application/zip" }, body: zip,
  });

export const falJobStatus = <J extends FalJob>(proxy: FalProxy, job: J, id: string) =>
  call<FalJobStatus<FalJobResult[J]>>(proxy, `${FAL_PROXY_ROUTES.status}?${new URLSearchParams({ job, id })}`, { method: "GET" });

export const startFalGeneration = (proxy: FalProxy, request: FalGenRequest) =>
  call<{ id: string }>(proxy, FAL_PROXY_ROUTES.gen, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
  });
