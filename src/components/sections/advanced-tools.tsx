"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sectionTools, type ToolSettings } from "@/lib/sections/tools";
import { outilQuote } from "@/lib/outils/graphs";
import type { Entree } from "@/lib/outils/catalogue";
import { sectionPath, type Step, type Section } from "@/lib/sections/registry";
import { checkMedia } from "@/lib/sections/media";
import {
  fileResult,
  type ProductionAsset,
  type AssetKind,
} from "@/lib/sections/model";
import { idbVault } from "@/lib/coffre/store";
import { randomSeed } from "@/lib/seed";
import { Modal } from "./modal";

const slotLabel: Record<Entree, string> = {
  image: "Image de départ",
  image2: "Deuxième image",
  video: "Vidéo",
  audio: "Piste audio",
};
export default function AdvancedTools({
  section,
  step,
  toolId,
  project,
  assets,
  connected,
  refresh,
  connect,
}: {
  section: Section;
  step: Step;
  toolId?: string;
  project: string;
  assets: ProductionAsset[];
  connected: boolean;
  refresh: () => Promise<void>;
  connect: () => void;
}) {
  const router = useRouter();
  const tools = sectionTools(step),
    entry = tools.find((item) => item.tool.id === toolId),
    tool = entry?.tool;
  const [inputs, setInputs] = useState<Partial<Record<Entree, string>>>({});
  const [name, setName] = useState(""),
    [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [aspect, setAspect] = useState<"horizontal" | "vertical">("horizontal"),
    [stem, setStem] = useState<"voix" | "musique">("voix"),
    [consent, setConsent] = useState(false);
  const kind: AssetKind =
    step === "cast"
      ? "cast"
      : step === "set"
        ? "set"
        : step === "shoot"
          ? "take"
          : "edit";
  const seconds = assets.find((a) => a.path === inputs.video)?.seconds;
  const quote = tool ? outilQuote(tool, { seconds, mesh: "objet" }) : null;
  const required =
    tool?.entrees.filter(
      (slot) =>
        slot !== "image2" ||
        Boolean(tool.paire) ||
        ["vid-raccord", "vid-multi", "vid-transition-style"].includes(tool.id),
    ) || [];
  const reason = !name.trim()
    ? "Nomme la création."
    : required.some((slot) => !inputs[slot])
      ? "Choisis les sources indiquées."
      : tool?.texte === "requis" && !prompt.trim()
        ? "Décris le résultat attendu."
        : tool?.consentement && !consent
          ? "Confirme l’utilisation de la voix."
          : !quote
            ? "La durée de la source est nécessaire au devis."
            : "";
  async function addInput(slot: Entree, file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const media = slot === "image2" ? "image" : slot;
      if (!file.type.startsWith(`${media}/`) || file.size > 200 * 1024 * 1024)
        throw Error("Format incompatible ou fichier supérieur à 200 Mo.");
      const seconds = await checkMedia(file, media);
      const id = crypto.randomUUID(),
        ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !/^[a-z0-9]{1,5}$/.test(ext))
        throw Error("Extension de fichier non reconnue.");
      const path = `Projets/${project}/Assets/${id}.${ext}`;
      const asset: ProductionAsset = {
        id,
        section,
        kind,
        name: file.name.slice(0, 80),
        path,
        media,
        seconds,
        prompt: "",
        source: "import",
        refs: [],
        at: new Date().toISOString(),
        ...(kind === "take" ? { shotId: id, number: 1, kept: false } : {}),
      };
      const { locked } = await import("@/lib/sections/runtime");
      await locked(`uttu-production-${project}`, () =>
        fileResult(idbVault(), project, asset, file, async () => false),
      );
      await refresh();
      setInputs((old) => ({ ...old, [slot]: path }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!tool || !quote || reason || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const settings: ToolSettings = {
        id: tool.id,
        step,
        inputs,
        aspect,
        stem,
        seconds,
        voiceConsent: consent,
      };
      const runtime = await import("@/lib/sections/runtime");
      await runtime.createImage(
        {
          id: crypto.randomUUID(),
          project,
          section,
          kind,
          name: name.trim(),
          prompt: prompt.trim(),
          seed: randomSeed(),
          refs: Object.values(inputs).filter((x): x is string => Boolean(x)),
          quote: quote.credits,
          operation: "tool",
          tool: settings,
          ...(kind === "take"
            ? {
                shotId:
                  assets.find(
                    (a) => a.path === inputs.image || a.path === inputs.video,
                  )?.shotId || crypto.randomUUID(),
              }
            : {}),
        },
        setMessage,
      );
      await refresh();
      router.replace(sectionPath(section, step));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Le rendu a échoué.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="ps-extra-grid">
        {tools.map(({ tool, title }) => {
          const estimate = outilQuote(tool, { seconds: 5, mesh: "objet" });
          return (
            <Link
              key={tool.id}
              href={`${sectionPath(section, step)}/${tool.id}`}
            >
              <b>{title}</b>
              <small>
                {estimate
                  ? `≈ ${estimate.credits} crédits estimés${tool.parTranche ? " / 5 s" : ""}`
                  : "Devis selon la source"}
              </small>
            </Link>
          );
        })}
      </div>
      {tool && entry && (
        <Modal
          title={entry.title}
          close={() => {
            if (!busy) router.replace(sectionPath(section, step));
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Nom
                <input
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {tool.entrees.map((slot) => {
                const media = slot === "image2" ? "image" : slot;
                return (
                  <div className="ps-source-slot" key={slot}>
                    <label>
                      {slotLabel[slot]}
                      {required.includes(slot) ? "" : " · facultative"}
                      <select
                        value={inputs[slot] || ""}
                        onChange={(e) =>
                          setInputs({ ...inputs, [slot]: e.target.value })
                        }
                      >
                        <option value="">Choisir dans le projet</option>
                        {assets
                          .filter((a) => a.media === media)
                          .map((a) => (
                            <option key={a.id} value={a.path}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Importer un fichier
                      <input
                        type="file"
                        accept={`${media}/*`}
                        onChange={(e) =>
                          void addInput(slot, e.target.files?.[0])
                        }
                      />
                    </label>
                  </div>
                );
              })}
              {tool.texte !== "aucun" && (
                <label>
                  Description
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </label>
              )}
              {tool.reglages?.includes("aspect") && (
                <label>
                  Cadre
                  <select
                    value={aspect}
                    onChange={(e) => setAspect(e.target.value as typeof aspect)}
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                </label>
              )}
              {tool.reglages?.includes("piste") && (
                <label>
                  Piste à garder
                  <select
                    value={stem}
                    onChange={(e) => setStem(e.target.value as typeof stem)}
                  >
                    <option value="voix">Voix</option>
                    <option value="musique">Musique</option>
                  </select>
                </label>
              )}
              {tool.consentement && (
                <label className="ps-voice-consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  J’ai l’accord pour utiliser cette voix.
                </label>
              )}
              {quote && (
                <p className="ps-estimate">≈ {quote.credits} crédits estimés</p>
              )}
              {message && <p role="status">{message}</p>}
              <p id="ps-tool-reason">{reason}</p>
              {connected ? (
                <button
                  className="ps-primary"
                  aria-describedby="ps-tool-reason"
                  disabled={Boolean(reason) || busy}
                >
                  Créer et ajouter au projet
                </button>
              ) : (
                <button type="button" className="ps-primary" onClick={connect}>
                  Connecter Comfy
                </button>
              )}
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  );
}
