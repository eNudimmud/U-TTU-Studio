import { idbVault } from "../coffre/store.ts";
import { fileResult } from "./model.ts";
import { imageVide } from "../render/blank.ts";
import { browserClient, locked } from "./runtime.ts";
import type { Section } from "./registry.ts";

// Content-addressed INPUT filenames from the owner's supplied Comfy graphs. Each GET uses
// the visitor's own account. No credential, cross-account URL or paid job is involved.
const canonical = [
  {
    label: "U1 · Fiche Uttu",
    file: "426e65fc2aa4a4823fef162f5d700a6983d999f4d88a94a1a83c00675040072c.jpg",
  },
  {
    label: "U2 · Portrait Uttu",
    file: "a5881eb3a1d88517fb03497034bd5d38ffbc3f3d5ea3fd4868a8cf2844ac0e8c.jpg",
  },
];
export async function importUttuRefs(
  project: string,
  section: Section,
): Promise<string[]> {
  const client = browserClient();
  if (!client)
    throw new Error(
      "Connecte le compte Comfy qui contient U1 et U2 ou importe tes deux images.",
    );
  const blobs = await Promise.all(
    canonical.map(async (ref) => {
      const blob = await client
        .file({ filename: ref.file, type: "input", subfolder: "" })
        .catch(() => null);
      if (!blob || (await imageVide(blob)))
        throw new Error(
          "U1 ou U2 est indisponible sur ce compte. Importe ta fiche et ton portrait.",
        );
      return blob;
    }),
  );
  return locked(`uttu-production-${project}`, async () => {
    const store = idbVault(),
      paths = [];
    for (const [index, ref] of canonical.entries()) {
      const id = `uttu-${section}-u${index + 1}`,
        path = `Projets/${project}/Refs/${id}.jpg`;
      await fileResult(
        store,
        project,
        {
          id,
          section,
          kind: "cast",
          name: ref.label,
          path,
          media: "image",
          prompt: "",
          at: new Date().toISOString(),
          source: "import",
          refs: [],
        },
        blobs[index],
        async () => false,
      );
      paths.push(path);
    }
    return paths;
  });
}
