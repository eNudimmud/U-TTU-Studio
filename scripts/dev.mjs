// Keep Next.js while accepting the common --host/--strictPort preview flags.
// Next.js already fails when an explicitly requested port is occupied.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const args = process.argv.slice(2).filter(arg => arg !== "--strictPort").map(arg => arg === "--host" ? "--hostname" : arg);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...args], { stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 0));
