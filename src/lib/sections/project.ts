import { idbVault } from "../coffre/store.ts";
import { ACTIVE_FILE } from "../coffre/project.ts";
import {
  readProduction,
  writeProduction,
  type ProductionAsset,
} from "./model.ts";
export async function openProject() {
  const store = idbVault();
  const active = (await store.get(ACTIVE_FILE))?.text;
  const slug = active ? JSON.parse(active).actif : null;
  if (
    typeof slug === "string" &&
    /^[a-z0-9-]+$/.test(slug) &&
    (await store.get(`Projets/${slug}/.uttu/production-imported.json`))
  ) {
    const map = (await store.get("MOC.md"))?.text || "";
    const projects = [
      ...map.matchAll(/\[\[Projets\/([a-z0-9-]+)\/_MOC\|([^\]]+)\]\]/g),
    ].map((m) => ({ slug: m[1], name: m[2] }));
    const name = projects.find((p) => p.slug === slug)?.name || slug;
    return {
      project: slug,
      name,
      projects: projects.length ? projects : [{ slug, name }],
      production: await readProduction(store, slug),
    };
  }
  const model = await import("../coffre/model.ts");
  await model.ensureActiveProject(store);
  const old = await model.loadStudio(store);
  const project = old.project!;
  let production = await readProduction(store, project);
  // Import the old index once; retain original files and notes, without copying media.
  if (!(await store.get(`Projets/${project}/.uttu/production-imported.json`))) {
    const additions: ProductionAsset[] = [];
    for (const c of old.cast) {
      const path = c.sheet || c.photos[0];
      if (!path || !(await store.get(path))?.blob) continue;
      additions.push({
        id: `legacy-cast-${c.id}`,
        kind: "cast",
        section: "cinema",
        name: c.name,
        path,
        media: "image",
        prompt: c.prompt,
        at: c.at,
        refs: c.photos,
        source: "legacy",
        template: c.template,
        credits: c.cost,
      });
    }
    for (const s of old.scenes) {
      const path = s.render || s.stills[0];
      if (!path || !(await store.get(path))?.blob) continue;
      additions.push({
        id: `legacy-set-${s.id}`,
        kind: "set",
        section: "cinema",
        name: s.name,
        path,
        media: "image",
        prompt: s.prompt || s.note,
        at: "",
        refs: s.stills,
        source: "legacy",
        template: s.template,
        credits: s.cout,
      });
    }
    for (const t of [...old.takes].sort((a, b) => a.at.localeCompare(b.at))) {
      if (!(await store.get(t.video))?.blob) continue;
      const section = /anime|anisora/i.test(t.workflow || "")
        ? "anime"
        : "cinema";
      additions.push({
        id: `legacy-take-${t.id}`,
        kind: "take",
        section,
        name: t.line || t.sceneName,
        path: t.video,
        media: "video",
        prompt: t.prompt,
        at: t.at,
        refs: t.refs || [],
        source: "legacy",
        jobId: t.jobId,
        template: t.workflow,
        credits: t.costCredits,
        seconds: t.settings.seconds,
        shotId: t.planId || t.id,
        number:
          additions.filter(
            (a) =>
              a.kind === "take" &&
              a.section === section &&
              a.shotId === (t.planId || t.id),
          ).length + 1,
        kept: t.etat === "gardee" || t.etat === "finalisee",
        finalPath: t.finalVideo || undefined,
      });
    }
    const newestKept = new Map(
      additions
        .filter((a) => a.kept)
        .map((a) => [`${a.section}/${a.shotId}`, a.id]),
    );
    for (const a of additions)
      if (a.kept) a.kept = newestKept.get(`${a.section}/${a.shotId}`) === a.id;
    production = {
      ...production,
      assets: [
        ...production.assets,
        ...additions.filter(
          (a) => !production.assets.some((b) => b.id === a.id),
        ),
      ],
    };
    await writeProduction(store, project, production);
    await store.put({
      path: `Projets/${project}/.uttu/production-imported.json`,
      text: "true",
      updatedAt: Date.now(),
    });
  }
  return { project, name: old.projectName, projects: old.projects, production };
}
