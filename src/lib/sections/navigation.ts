import { tabFromLocation } from "../studio-route.ts";
import { sectionPath, type Section, type Step } from "./registry.ts";

const stageForTab: Record<string, Step> = {
  lora: "cast", look: "cast", scene: "set", prise: "shoot", montage: "edit", finaliser: "finish",
};
const primary: Record<string, Step> = {
  "img-klein": "cast", "img-qwen": "cast", "img-refs": "cast",
  "vid-ltx-image": "shoot", "vid-wan": "shoot",
  "ret-finaliser": "finish", "vid-finaliser": "finish",
};

/** Bare navigation moves to the new sections; project/action links keep their original adapter. */
export function legacyStudioDestination(
  section: Section,
  hash: string,
  search: string,
  tools: Readonly<Record<string, Step>> = {},
): string | null {
  if (!hash && !search) return null;
  const legacy = `/studio/legacy${search}${hash}`;
  // New sections do not consume legacy project, plan, take, asset, gesture or agent state yet.
  // Preserve unknown options as well, rather than silently discarding future link context.
  if ([...new URLSearchParams(search).keys()].some(key => key !== "step")) return legacy;
  try {
    if (hash.startsWith("#outils/")) {
      const id = decodeURIComponent(hash.slice(8));
      const step = Object.hasOwn(tools, id) ? tools[id] : undefined;
      if (step) return `${sectionPath(section, step)}/${id}${search}`;
      return Object.hasOwn(primary, id) ? `${sectionPath(section, primary[id])}${search}` : legacy;
    }
    const tab = tabFromLocation(hash, search);
    return tab && stageForTab[tab] ? `${sectionPath(section, stageForTab[tab])}${search}` : legacy;
  } catch {
    // A malformed percent escape must not crash the light entry page.
    return null;
  }
}
