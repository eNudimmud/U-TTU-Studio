// Keep Next.js while accepting the common --host/--strictPort preview flags.
// Next.js already fails when an explicitly requested port is occupied.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const args = process.argv.slice(2).filter(arg => arg !== "--strictPort").map(arg => arg === "--host" ? "--hostname" : arg);
// Uttu reads public/agent/knowledge.json; build it once so dev matches production.
spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", "scripts/agent-knowledge.mjs"], { stdio: "inherit" });
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...args], { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));
