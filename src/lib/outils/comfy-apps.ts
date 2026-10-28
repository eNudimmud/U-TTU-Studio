// Comfy-hosted apps open only after the visitor follows the explicit link.
// They own their account, files, quote and generation; no Studio graph is submitted.
export const COMFY_APPS = {
  openjutsu: {
    url: "https://comfy.org/hub/apps/openjutsu/",
    source: "https://github.com/Comfy-Org/comfy-openjutsu",
  },
} as const;

export type ComfyAppId = keyof typeof COMFY_APPS;
