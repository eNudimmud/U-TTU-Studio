export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { installHoldScripts } = await import("./lib/hold-scripts-install.ts");
  installHoldScripts();
}
