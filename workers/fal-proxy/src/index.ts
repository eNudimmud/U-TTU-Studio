import { handle, type Env } from "./proxy.ts";

// workerd treats every export of the entry module as an entrypoint: only the handler lives here.
export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
