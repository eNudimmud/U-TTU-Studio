"use client";
import Link from "next/link";
import Image from "next/image";
import { Modal } from "./modal";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CAST_TOOLS,
  SET_TOOLS,
  SHOOT_TOOLS,
  SECTIONS,
  STEPS,
  STEP_COPY,
  sectionPath,
  type Section,
  type Step,
  type ToolId,
} from "@/lib/sections/registry";
import {
  emptyProduction,
  keepTake,
  readProduction,
  writeProduction,
  fileResult,
  stepState,
  type Production,
  type ProductionAsset,
  type AssetKind,
} from "@/lib/sections/model";
import { idbVault } from "@/lib/coffre/store";
import {
  readRenderLink,
  cleanApiKey,
  saveRenderLink,
} from "@/lib/render/settings";
import { imageVide } from "@/lib/render/blank";
import { finishEstimate } from "@/lib/sections/finish";
import { randomSeed } from "@/lib/seed";
import type { CreationRequest } from "@/lib/sections/runtime";
import "./studio.css";

const AdvancedTools = dynamic(() => import("./advanced-tools"), {
  ssr: false,
  loading: () => <p>Ouverture des outils…</p>,
});
const MeshPreview = dynamic(
  () => import("@/components/app/mesh-viewer").then((m) => m.MeshViewer),
  { ssr: false },
);
const CutEditor = dynamic(() => import("./cut-editor"), {
  ssr: false,
  loading: () => <p>Ouverture du montage…</p>,
});

const PromptLibrary = dynamic(() => import("./prompt-library"), {
  ssr: false,
  loading: () => <p>Ouverture de la promptothèque…</p>,
});

type DialogName =
  | "connect"
  | "guide"
  | "bible"
  | "project"
  | "tool"
  | "asset"
  | "finish"
  | null;
function heroImage(section: Section, step: Step) {
  const images =
    section === "anime"
      ? {
          cast: "/look/anime/char-sheet.webp",
          set: "/look/anime/bg-city-dawn.webp",
          shoot: "/look/anime/shot-1-wide.webp",
          edit: "/look/anime/shot-2-medium.webp",
          finish: "/look/anime/shot-3-closeup.webp",
        }
      : {
          cast: "/images/uttu-portrait-large-1200.webp",
          set: "/exemples/decor-quai-nuit-960.webp",
          shoot: "/images/accueil/uttu-quai-960.webp",
          edit: "/exemples/vignettes/ret-modifier.webp",
          finish: "/exemples/vignettes/vid-finaliser.webp",
        };
  return images[step];
}
function Etching({ kind, small = false }: { kind: string; small?: boolean }) {
  return (
    <svg
      className={small ? "ps-etch small" : "ps-etch"}
      viewBox="0 0 240 130"
      fill="none"
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          opacity=".2"
          d="M10 115L230 114M21 14V120M218 13V121M11 23L231 22"
        />
        {kind === "text" ? (
          <>
            <path d="M90 87C63 109 61 110 52 114M146 88C169 96 183 103 190 114M101 77L96 93Q119 109 142 92L138 77M91 50C85 44 91 22 115 20C145 14 154 34 148 55L142 75L124 88L106 83L96 69ZM92 48L106 39L124 43L145 31M102 56L111 54M129 54L139 57M120 56L117 67L123 69M112 76L131 75" />
            <path
              opacity=".4"
              d="M89 38L96 28M94 42L103 26M143 37L149 30M69 107L78 94M77 112L89 96M157 98L168 114M164 99L179 114"
            />
          </>
        ) : kind === "references" ? (
          <>
            <path d="M47 29L105 23L112 103L54 109ZM128 22L190 30L182 110L120 103ZM56 88L104 83M132 85L180 90" />
            <ellipse
              cx="79"
              cy="53"
              rx="12"
              ry="16"
              transform="rotate(-5 79 53)"
            />
            <path d="M59 81Q78 63 99 77M145 61Q132 38 152 37Q173 37 166 57L159 64L145 61ZM132 81Q154 64 178 83M97 15L105 11M113 10L115 3M120 15L127 12" />
          </>
        ) : (
          <>
            <path d="M63 40L63 108L181 108L181 40M63 41L88 41L97 31L139 31L151 41L181 41M121 53L121 91M105 69L121 53L137 69M51 116L194 116" />
          </>
        )}
      </g>
    </svg>
  );
}
export function AssetPreview({
  asset,
  final = false,
}: {
  asset: ProductionAsset;
  final?: boolean;
}) {
  const [url, setUrl] = useState("");
  const path = final && asset.finalPath ? asset.finalPath : asset.path;
  useEffect(() => {
    let disposed = false,
      local = "";
    void idbVault()
      .get(path)
      .then((entry) => {
        if (!entry?.blob || disposed) return;
        local = URL.createObjectURL(entry.blob);
        setUrl(local);
      });
    return () => {
      disposed = true;
      if (local) URL.revokeObjectURL(local);
      setUrl("");
    };
  }, [path]);
  if (!url) return <div className="ps-media-empty">Chargement…</div>;
  if (asset.media === "audio")
    return (
      <audio src={url} controls preload="metadata" aria-label={asset.name} />
    );
  if (asset.media === "mesh")
    return <MeshPreview url={url} label={asset.name} />;
  return asset.media === "video" ? (
    <video
      src={url}
      controls
      playsInline
      preload="metadata"
      aria-label={asset.name}
    />
  ) : (
    <img src={url} alt={asset.name} loading="lazy" />
  );
}
export function ProductionStudio({
  section,
  step,
  initialPanel,
  library = false,
  toolId,
}: {
  section: Section;
  step: Step;
  initialPanel?: "bible";
  library?: boolean;
  toolId?: string;
}) {
  const router = useRouter();
  const [extras, setExtras] = useState(Boolean(toolId));
  const [production, setProduction] = useState<Production>(emptyProduction);
  const [project, setProject] = useState("");
  const [projectName, setProjectName] = useState("Mon projet");
  const [projects, setProjects] = useState<{ slug: string; name: string }[]>(
    [],
  );
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(initialPanel || null);
  const [tool, setTool] = useState<ToolId>("text");
  const [active, setActive] = useState<ProductionAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [manualJobId, setManualJobId] = useState("");
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [structure, setStructure] = useState("");
  const [bible, setBible] = useState("");
  const [newProject, setNewProject] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem("u-ttu-last-section", section);
    } catch {}
  }, [section]);
  const fileInput = useRef<HTMLInputElement>(null);
  const reload = useCallback(async () => {
    const { openProject } = await import("@/lib/sections/project");
    const result = await openProject();
    setProject(result.project);
    setProjectName(result.name);
    setProjects(result.projects);
    setProduction(result.production);
    setBible(result.production.bible[section] || "");
    setConnected(readRenderLink(localStorage).mode !== "none");
    setReady(true);
  }, [section]);
  useEffect(() => {
    void reload().catch((e) => setError(e.message));
  }, [reload]);
  useEffect(() => {
    if (library) return;
    try {
      const raw = sessionStorage.getItem("u-ttu-style-draft");
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.section !== section || draft.step !== step) return;
      setPrompt(draft.prompt);
      setName(draft.name);
      setTool(draft.tool);
      setRefs([]);
      setDialog("tool");
      sessionStorage.removeItem("u-ttu-style-draft");
    } catch {}
  }, [section, step, library]);
  const transact = async (move: (p: Production) => Production) => {
    const { locked } = await import("@/lib/sections/runtime");
    await locked(`uttu-production-${project}`, async () => {
      const store = idbVault();
      const next = move(await readProduction(store, project));
      await writeProduction(store, project, next);
      setProduction(next);
    });
  };
  const action = async (run: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L’opération n’a pas abouti.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  };
  const kind: AssetKind =
    step === "set"
      ? "set"
      : step === "shoot" || step === "finish"
        ? "take"
        : step === "edit"
          ? "edit"
          : "cast";
  const items = production.assets.filter(
    (a) =>
      a.section === section && a.kind === kind && (step !== "finish" || a.kept),
  );
  const sourceImages = production.assets.filter(
    (a) => a.media === "image" && a.kind !== "edit",
  );
  const estimated = tool === "animate" ? (section === "anime" ? 48 : 18) : 4;
  const maxRefs = tool === "animate" ? 1 : 2;
  const index = STEPS.indexOf(step);
  const copy = library
    ? {
        label: "Promptothèque",
        title: "Une image commence par un regard.",
        note: "Explore des écritures visuelles. Choisis une matière, une lumière, un cadre — puis fais-en ton univers.",
        object: "styles",
      }
    : STEP_COPY[step];
  const openTool = (id: ToolId, asset?: ProductionAsset) => {
    setTool(id);
    setActive(asset || null);
    setName(asset ? `${asset.name} · variante` : "");
    setPrompt(id === "animate" ? "" : asset?.prompt || "");
    setRefs(asset ? [asset.path] : []);
    setStructure("");
    setDialog("tool");
    setError("");
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    await action(async () => {
      const { locked } = await import("@/lib/sections/runtime");
      await locked(`uttu-production-${project}`, async () => {
        for (const file of Array.from(files).slice(0, 2)) {
          const video =
            step === "shoot" &&
            dialog !== "tool" &&
            /^video\/(mp4|webm|quicktime)$/.test(file.type);
          if (
            (!video && !/^image\/(png|jpeg|webp)$/.test(file.type)) ||
            file.size > (video ? 200 : 30) * 1024 * 1024
          )
            throw new Error(
              "Choisis une image de moins de 30 Mo ou une vidéo de moins de 200 Mo.",
            );
          const seconds = video
            ? await (await import("@/lib/sections/media")).videoSeconds(file)
            : undefined;
          const id = crypto.randomUUID();
          const ext =
            file.type === "image/jpeg"
              ? "jpg"
              : file.type === "video/quicktime"
                ? "mov"
                : file.type.split("/")[1];
          const path = `Projets/${project}/Assets/${id}.${ext}`;
          const asset: ProductionAsset = {
            id,
            section,
            kind,
            name: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
            path,
            media: video ? "video" : "image",
            seconds,
            prompt: "",
            at: new Date().toISOString(),
            refs: [],
            source: "import",
            ...(kind === "take" ? { shotId: id, number: 1, kept: false } : {}),
          };
          const next = await fileResult(
            idbVault(),
            project,
            asset,
            file,
            video ? async () => false : imageVide,
          );
          setProduction(next);
          if (dialog === "tool")
            setRefs((old) => [...old, path].slice(0, maxRefs));
        }
      });
    });
    if (fileInput.current) fileInput.current.value = "";
  };
  const generate = async () =>
    action(async () => {
      if (
        !name.trim() ||
        !prompt.trim() ||
        ((tool === "references" || tool === "animate") && !refs.length)
      )
        throw new Error(
          "Donne un nom, décris le résultat et choisis les références nécessaires.",
        );
      const runtime = await import("@/lib/sections/runtime");
      const request: CreationRequest = {
        id: crypto.randomUUID(),
        project,
        section,
        kind,
        name: name.trim().slice(0, 80),
        prompt: prompt.trim(),
        refs: tool === "text" ? [] : refs,
        structure: structure || undefined,
        seed: randomSeed(),
        quote: estimated,
        operation: tool === "animate" ? "video" : "image",
        ...(kind === "take"
          ? { shotId: active?.shotId || crypto.randomUUID() }
          : {}),
      };
      await runtime.createImage(request, setStatus);
      await reload();
      setDialog(null);
    });
  const saveConnection = async () =>
    action(async () => {
      const clean = cleanApiKey(key);
      if (!clean) throw new Error("Cette clé Comfy n’a pas le format attendu.");
      const { createRenderClient } = await import("@/lib/render/client");
      await createRenderClient({ auth: { kind: "key", key: clean } }).user();
      saveRenderLink(localStorage, { mode: "key", key: clean });
      setKey("");
      setConnected(true);
      setDialog(null);
    });
  return (
    <div className={`production-studio ps-${section}`} lang="fr">
      <p id="ps-ready-reason" className="ps-help" role="status">
        {!ready
          ? "Ouverture du projet…"
          : busy
            ? "Une opération est en cours."
            : ""}
      </p>
      <header className="ps-header">
        <Link className="ps-brand" href="/" aria-label="Uttu Studio, accueil">
          U<span>*</span>TTU <small>STUDIO</small>
        </Link>
        <button
          className="ps-project"
          onClick={() => setDialog("project")}
          aria-describedby="ps-ready-reason"
          disabled={!ready || busy}
        >
          <span className="ps-dot" />
          {projectName}
          <span>⌄</span>
        </button>
        <nav className="ps-sections" aria-label="Univers de création">
          {SECTIONS.map((s) => (
            <Link
              key={s}
              aria-current={section === s ? "page" : undefined}
              href={sectionPath(s, library ? "prompts" : step)}
            >
              {s === "cinema" ? "CINEMA" : "ANIME"}
            </Link>
          ))}
        </nav>
        <div className="ps-utilities">
          <button onClick={() => setDialog("guide")}>Guide</button>
          <button onClick={() => setDialog("bible")}>Bible</button>
          <button className="ps-connect" onClick={() => setDialog("connect")}>
            {connected ? "Comfy connecté" : "Connecter Comfy"}
          </button>
        </div>
      </header>
      <nav className="ps-chain" aria-label="Étapes du film">
        {STEPS.map((s, i) => (
          <Link
            key={s}
            href={sectionPath(section, s)}
            aria-current={!library && s === step ? "step" : undefined}
          >
            <span className="ps-step-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <b>{STEP_COPY[s].label}</b>
              <small>{stepState(production, section, s)}</small>
            </span>
            <span className="ps-step-arrow">›</span>
          </Link>
        ))}
      </nav>
      <main id="contenu" className="ps-main">
        <div className="ps-project-band">
          <span className="ps-eyebrow">DANS CE PROJET</span>
          {(["cast", "set", "shoot"] as Step[]).map((s) => (
            <Link key={s} href={sectionPath(section, s)}>
              {
                production.assets.filter(
                  (a) =>
                    a.section === section &&
                    a.kind === (s === "shoot" ? "take" : s),
                ).length
              }{" "}
              {STEP_COPY[s].object}
              <span>→</span>
            </Link>
          ))}
        </div>
        <nav className="ps-view-nav" aria-label="Ressources créatives">
          <Link
            href={sectionPath(section, step)}
            aria-current={!library ? "page" : undefined}
          >
            Produire
          </Link>
          <Link
            href={sectionPath(section, "prompts")}
            aria-current={library ? "page" : undefined}
          >
            Promptothèque <span>→</span>
          </Link>
        </nav>
        <section className="ps-intro">
          <div>
            <p className="ps-eyebrow">
              {String(index + 1).padStart(2, "0")} / {copy.label.toUpperCase()}{" "}
              <span>· {section.toUpperCase()}</span>
            </p>
            <h1>{copy.title}</h1>
            <p>{copy.note}</p>
          </div>
          <div className="ps-hero-art">
            <Image
              src={heroImage(section, step)}
              alt=""
              fill
              sizes="(max-width: 600px) 120px, 440px"
              priority
            />
          </div>
        </section>
        {error && (
          <p role="alert" className="ps-error">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="ps-status">
            {status}
          </p>
        )}
        {!library && (
          <>
            <div className="ps-section-title">
              <h2>{items.length ? `Tes ${copy.object}` : "À toi de créer"}</h2>
              <span>
                {items.length ? `${items.length} dans le projet` : ""}
              </span>
            </div>
            {items.length > 0 && (
              <div className="ps-assets">
                {items.map((a) => (
                  <article className="ps-asset" key={a.id}>
                    <AssetPreview asset={a} final={step === "finish"} />
                    <div>
                      <small>
                        {a.kind === "take"
                          ? `PRISE ${String(a.number || 1).padStart(2, "0")} · ${a.kept ? "GARDÉE" : "ESSAI"}`
                        : a.source === "comfy"
                          ? "CRÉATION DU PROJET"
                          : a.source === "edit"
                            ? "MONTAGE DU PROJET"
                            : a.source === "legacy"
                              ? "PROJET EXISTANT"
                              : "FICHIER IMPORTÉ"}
                      </small>
                      <h3>{a.name}</h3>
                      <button
                        onClick={() => {
                          setActive(a);
                          setDialog("asset");
                        }}
                      >
                        Ouvrir <span>→</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {(step === "cast" || step === "set" || step === "shoot") && (
              <div className="ps-tools">
                {(step === "shoot"
                  ? SHOOT_TOOLS
                  : step === "set"
                    ? SET_TOOLS
                    : CAST_TOOLS
                ).map((t) => (
                  <button
                    className="ps-tool"
                    key={t.id}
                    onClick={() =>
                      t.id === "import"
                        ? fileInput.current?.click()
                        : openTool(t.id)
                    }
                    aria-describedby="ps-ready-reason"
                    disabled={!ready || busy}
                  >
                    <div className="ps-card-art">
                      <Etching kind={t.id} />
                      <span>{t.mark}</span>
                    </div>
                    <div className="ps-card-copy">
                      <h3>
                        {t.title}
                        <span>→</span>
                      </h3>
                      <p>{t.note}</p>
                      <small>
                        {t.id === "import"
                          ? "Gratuit · depuis ton appareil"
                          : `≈ ${t.id === "animate" ? (section === "anime" ? 48 : 18) : 4} crédits estimés`}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {ready && step !== "finish" && (
              <details
                className="ps-extras"
                open={Boolean(toolId) || extras}
                onToggle={(e) => setExtras(e.currentTarget.open)}
              >
                <summary>Outils de {STEP_COPY[step].label}</summary>
                {(toolId || extras) && (
                  <AdvancedTools
                    key={`${section}-${step}-${toolId || "list"}`}
                    section={section}
                    step={step}
                    toolId={toolId}
                    project={project}
                    assets={production.assets}
                    connected={connected}
                    refresh={reload}
                    connect={() => setDialog("connect")}
                  />
                )}
              </details>
            )}
            {step === "edit" && ready && (
              <CutEditor
                project={project}
                section={section}
                assets={production.assets}
                refresh={reload}
              />
            )}
            {step === "finish" && !items.length && (
              <p className="ps-note">
                Garde une prise dans Shoot. Elle apparaîtra ici pour sa
                finition.
              </p>
            )}
          </>
        )}
        {library && (
          <PromptLibrary
            section={section}
            onSave={(text) =>
              transact((p) => ({
                ...p,
                bible: {
                  ...p.bible,
                  [section]: [p.bible[section], text]
                    .filter(Boolean)
                    .join("\n\n---\n\n"),
                },
              }))
            }
            onUse={(style, use, text) => {
              const target = use === "motion" ? "shoot" : use;
              sessionStorage.setItem(
                "u-ttu-style-draft",
                JSON.stringify({
                  section,
                  step: target,
                  prompt: text,
                  name: style.title,
                  tool: use === "motion" ? "animate" : "text",
                }),
              );
              router.push(sectionPath(section, target));
            }}
          />
        )}
        <input
          ref={fileInput}
          type="file"
          accept={
            step === "shoot" && dialog !== "tool"
              ? "image/png,image/jpeg,image/webp,video/mp4,video/webm"
              : "image/png,image/jpeg,image/webp"
          }
          multiple
          hidden
          onChange={(e) => void upload(e.target.files)}
        />
        <aside className="ps-footnote">
          <span>✳</span>
          <p>
            {section === "anime"
              ? "La même histoire, un autre trait."
              : "Le cadre change. Ton univers reste."}
            <small>
              Les références de tes personnages et de tes décors restent dans ce
              projet.
            </small>
          </p>
          <button onClick={() => setDialog("guide")}>
            Comment commencer <span>→</span>
          </button>
        </aside>
      </main>
      <footer className="ps-footer">
        <span>
          {projectName} <small> / {section.toUpperCase()}</small>
        </span>
        <div>
          {index > 0 && (
            <Link href={sectionPath(section, STEPS[index - 1])}>
              ← {STEP_COPY[STEPS[index - 1]].label}
            </Link>
          )}
          {index < 4 && (
            <Link
              className="ps-primary"
              href={sectionPath(section, STEPS[index + 1])}
            >
              Passer à {STEP_COPY[STEPS[index + 1]].label} <span>→</span>
            </Link>
          )}
        </div>
      </footer>
      {dialog && (
        <Modal
          title={
            dialog === "connect"
              ? "Ton compte Comfy Cloud"
              : dialog === "guide"
                ? "Du personnage au film"
                : dialog === "bible"
                  ? "La bible du projet"
                  : dialog === "project"
                    ? "Tes projets"
                    : dialog === "finish"
                      ? "Améliorer la prise gardée"
                      : dialog === "asset"
                        ? active?.name || "Création"
                        : tool === "animate"
                          ? "Animer une image"
                          : tool === "text"
                            ? "Depuis un texte"
                            : "Depuis des références"
          }
          close={() => {
            if (!busy) {
              setDialog(null);
              setError("");
            }
          }}
        >
          <p id="ps-busy-reason" className="ps-help" role="status">
            {busy ? status || "Opération en cours…" : ""}
          </p>
          {error && (
            <p role="alert" className="ps-error">
              {error}
            </p>
          )}
          {dialog === "guide" && (
            <div className="ps-guide">
              {STEPS.map((s) => (
                <p key={s}>
                  <b>{STEP_COPY[s].label}</b>
                  {STEP_COPY[s].note}
                </p>
              ))}
              <p>
                Chaque génération affiche son estimation avant l’envoi. Un
                résultat valide est ajouté au projet avec ses références. Une
                prise gardée peut ensuite être montée ou améliorée.
              </p>
            </div>
          )}
          {dialog === "connect" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveConnection();
              }}
            >
              <p>
                Ta clé reste dans ce navigateur. Les rendus utilisent ton compte
                et tes crédits Comfy.
              </p>
              <label>
                Clé API Comfy
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
              </label>
              <p id="ps-key-reason" className="ps-help">
                {!key.trim() ? "Saisis la clé du compte à connecter." : ""}
              </p>
              <button
                className="ps-primary"
                aria-describedby="ps-key-reason"
                disabled={busy || !key.trim()}
              >
                Connecter le compte
              </button>
              <details>
                <summary>Retrouver un rendu après une interruption</summary>
                <label>
                  Identifiant Comfy si l’envoi a été interrompu
                  <input
                    value={manualJobId}
                    onChange={(e) => setManualJobId(e.target.value)}
                  />
                </label>
              </details>
              <button
                type="button"
                aria-describedby="ps-busy-reason"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const r = await import("@/lib/sections/runtime");
                    await r.recoverCreation(setStatus, manualJobId);
                    await reload();
                    setDialog(null);
                  })
                }
              >
                Récupérer un rendu en cours
              </button>
              <Link href="/studio/legacy?step=credits">
                Ouvrir la récupération avancée
              </Link>
              {connected && (
                <button
                  type="button"
                  onClick={() => {
                    saveRenderLink(localStorage, { mode: "none" });
                    setConnected(false);
                    setDialog(null);
                  }}
                >
                  Déconnecter ce navigateur
                </button>
              )}
            </form>
          )}
          {dialog === "project" && (
            <div className="ps-form">
              <label>
                Projet actif
                <select
                  value={project}
                  aria-describedby="ps-busy-reason"
                  disabled={busy}
                  onChange={(e) =>
                    void action(async () => {
                      const model = await import("@/lib/coffre/model");
                      await model.selectProject(idbVault(), e.target.value);
                      await reload();
                      setDialog(null);
                    })
                  }
                >
                  {projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nouveau projet
                <input
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  maxLength={40}
                />
              </label>
              <p id="ps-project-reason" className="ps-help">
                {!newProject.trim()
                  ? "Saisis un nom pour créer un projet."
                  : ""}
              </p>
              <button
                className="ps-primary"
                aria-describedby="ps-project-reason"
                disabled={busy || !newProject.trim()}
                onClick={() =>
                  void action(async () => {
                    const model = await import("@/lib/coffre/model");
                    await model.createProject(idbVault(), newProject);
                    await reload();
                    setNewProject("");
                    setDialog(null);
                  })
                }
              >
                Créer le projet
              </button>
            </div>
          )}
          {dialog === "bible" && (
            <div className="ps-form">
              <p>
                Les repères de {projectName} : personnages, lieux, palette,
                matières et règles de continuité.
              </p>
              <label>
                Direction artistique · {section.toUpperCase()}
                <textarea
                  rows={10}
                  value={bible}
                  onChange={(e) => setBible(e.target.value)}
                />
              </label>
              <button
                className="ps-primary"
                aria-describedby="ps-busy-reason"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await transact((p) => ({
                      ...p,
                      bible: { ...p.bible, [section]: bible },
                    }));
                    setDialog(null);
                  })
                }
              >
                Enregistrer
              </button>
            </div>
          )}
          {dialog === "tool" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
            >
              <fieldset aria-describedby="ps-busy-reason" disabled={busy}>
                {tool !== "animate" && (
                  <div className="ps-actions">
                    <button
                      type="button"
                      aria-pressed={tool === "text"}
                      onClick={() => setTool("text")}
                    >
                      Texte
                    </button>
                    <button
                      type="button"
                      aria-pressed={tool === "references"}
                      onClick={() => setTool("references")}
                    >
                      Références
                    </button>
                  </div>
                )}
                <label>
                  Nom de la création
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="La messagère du port"
                  />
                </label>
                <label>
                  Décris ce que l’on voit
                  <textarea
                    required
                    rows={5}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={
                      section === "anime"
                        ? "Portrait en trois-quarts, traits à l’encre très fins, aplats de gouache bleu ardoise, manteau usé, lumière latérale douce, fond papier ivoire."
                        : "Portrait en trois-quarts, manteau de travail patiné, lumière naturelle latérale, peau et textile détaillés, fond industriel sobre, optique 50 mm, grain 35 mm fin."
                    }
                  />
                </label>
                {(tool === "references" || tool === "animate") && (
                  <>
                    <p className="ps-label">
                      {tool === "animate"
                        ? "Image de départ"
                        : step === "set"
                          ? "Références du décor"
                          : step === "shoot"
                            ? "Personnage et décor"
                            : "Références d’identité"}{" "}
                      · {maxRefs} maximum
                    </p>
                    <div className="ps-ref-list">
                      {sourceImages.map((a) => (
                        <label key={a.id}>
                          <input
                            type="checkbox"
                            checked={refs.includes(a.path)}
                            disabled={
                              !refs.includes(a.path) && refs.length >= maxRefs
                            }
                            onChange={(e) =>
                              setRefs((old) =>
                                e.target.checked
                                  ? [...old, a.path]
                                  : old.filter((p) => p !== a.path),
                              )
                            }
                          />
                          {a.name}
                          <small>{a.section.toUpperCase()}</small>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                    >
                      Importer une référence
                    </button>
                    {step === "cast" && tool === "references" && connected && (
                      <button
                        type="button"
                        onClick={() =>
                          void action(async () => {
                            const { importUttuRefs } = await import(
                              "@/lib/sections/uttu-refs"
                            );
                            setRefs(await importUttuRefs(project, section));
                            await reload();
                          })
                        }
                      >
                        Charger U1 et U2 depuis mon compte Comfy
                      </button>
                    )}
                    {section === "anime" && tool !== "animate" && (
                      <label>
                        Image de pose ou de composition · facultatif
                        <select
                          value={structure}
                          onChange={(e) => setStructure(e.target.value)}
                        >
                          <option value="">Composition libre</option>
                          {sourceImages.map((a) => (
                            <option key={a.id} value={a.path}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <small>
                          {step === "set"
                            ? "Son dessin guide le cadrage ; les références au-dessus guident les matières et la lumière."
                            : "Son dessin guide la pose ; les références au-dessus guident l’identité."}
                        </small>
                      </label>
                    )}
                  </>
                )}
                <p id="ps-generation-reason" className="ps-help">
                  {!name.trim() || !prompt.trim()
                    ? "Renseigne le nom et la description."
                    : tool !== "text" && !refs.length
                      ? "Choisis une référence du projet."
                      : ""}
                </p>
                <p className="ps-estimate">
                  ≈ {estimated} crédits estimés{" "}
                  <small>
                    {tool === "animate"
                      ? "Vidéo de 5 secondes · estimation GPU"
                      : section === "anime"
                        ? "Une image · estimation à confirmer sur ton compte"
                        : "Une image · 1920 × 1088"}
                  </small>
                </p>
                {connected ? (
                  <button
                    className="ps-primary"
                    aria-describedby="ps-generation-reason"
                    disabled={
                      !name.trim() ||
                      !prompt.trim() ||
                      ((tool === "references" || tool === "animate") &&
                        !refs.length)
                    }
                  >
                    Créer et ajouter au projet →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ps-primary"
                    onClick={() => setDialog("connect")}
                  >
                    Connecter Comfy pour créer
                  </button>
                )}
              </fieldset>
            </form>
          )}
          {dialog === "finish" && active && (
            <div className="ps-form">
              <AssetPreview asset={active} />
              <p>
                <b>{active.name}</b> · prise {active.number} gardée
              </p>
              <p>
                {section === "anime"
                  ? "Real-ESRGAN x4plus anime agrandit et affine le dessin existant."
                  : "SeedVR2 améliore la résolution et restaure les détails de la prise existante."}{" "}
                L’original reste disponible.
              </p>
              <p className="ps-estimate">
                ≈ {finishEstimate(active)} crédits estimés
              </p>
              {connected ? (
                <button
                  className="ps-primary"
                  aria-describedby="ps-busy-reason"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const runtime = await import("@/lib/sections/runtime");
                      await runtime.createImage(
                        {
                          id: crypto.randomUUID(),
                          project,
                          section,
                          kind: "take",
                          name: active.name,
                          prompt: "",
                          refs: [active.path],
                          seed: randomSeed(),
                          quote: finishEstimate(active),
                          operation: "finish",
                          sourceId: active.id,
                          outputKind: active.media,
                        },
                        setStatus,
                      );
                      await reload();
                      setDialog(null);
                    })
                  }
                >
                  Améliorer et ajouter au projet →
                </button>
              ) : (
                <button
                  className="ps-primary"
                  onClick={() => setDialog("connect")}
                >
                  Connecter Comfy
                </button>
              )}
            </div>
          )}
          {dialog === "asset" && active && (
            <div className="ps-asset-detail">
              <p id="ps-asset-reason" className="ps-help">
                {active.kept ? "Cette prise est gardée." : ""}
              </p>
              <AssetPreview asset={active} final={step === "finish"} />
              <p>{active.prompt || "Image importée dans le projet."}</p>
              <dl>
                <dt>Provenance</dt>
                <dd>
                  {active.source === "comfy"
                    ? "Comfy Cloud"
                  : active.source === "legacy"
                    ? "Projet existant"
                    : active.source === "edit"
                      ? "Montage local"
                      : "Import"}
                </dd>
                {active.refs.length > 0 && (
                  <>
                    <dt>Références</dt>
                    <dd>
                      {active.refs
                        .map(
                          (path) =>
                            production.assets.find((a) => a.path === path)
                              ?.name || path.split("/").pop(),
                        )
                        .join(", ")}
                    </dd>
                  </>
                )}
                {active.structure && (
                  <>
                    <dt>Pose ou composition</dt>
                    <dd>
                      {production.assets.find(
                        (a) => a.path === active.structure,
                      )?.name || active.structure.split("/").pop()}
                    </dd>
                  </>
                )}
                {active.finalJobId && (
                  <>
                    <dt>Rendu de finition</dt>
                    <dd>{active.finalJobId}</dd>
                  </>
                )}
                {active.template && (
                  <>
                    <dt>Modèle / workflow</dt>
                    <dd>{active.template}</dd>
                  </>
                )}
                {active.jobId && (
                  <>
                    <dt>Rendu</dt>
                    <dd>{active.jobId}</dd>
                  </>
                )}
                {active.seed !== undefined && (
                  <>
                    <dt>Graine</dt>
                    <dd>{active.seed}</dd>
                  </>
                )}
                {active.credits != null && (
                  <>
                    <dt>Consommation Comfy de ce résultat</dt>
                    <dd>{active.credits.toFixed(2)} crédits</dd>
                  </>
                )}
              </dl>
              <div className="ps-actions">
                {active.kind === "take" && active.kept && (
                  <button
                    className="ps-primary"
                    onClick={() => setDialog("finish")}
                  >
                    Améliorer la prise gardée
                  </button>
                )}
                {active.finalPath && (
                  <button
                    aria-describedby="ps-busy-reason"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const entry = await idbVault().get(active.finalPath!);
                        if (!entry?.blob)
                          throw new Error("Finition indisponible.");
                        const url = URL.createObjectURL(entry.blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = active.finalPath!.split("/").pop()!;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      })
                    }
                  >
                    Télécharger la finition
                  </button>
                )}
                {step !== "finish" && active.media === "image" && (
                  <button onClick={() => openTool("references", active)}>
                    Créer une variante
                  </button>
                )}
                {step !== "finish" && active.kind === "take" && active.media === "image" && (
                  <button onClick={() => openTool("animate", active)}>
                    Animer ce cadre
                  </button>
                )}
                {active.kind === "take" && (
                  <button
                    className="ps-primary"
                    aria-describedby="ps-asset-reason"
                    disabled={busy || active.kept}
                    onClick={() =>
                      void action(async () => {
                        await transact((p) => keepTake(p, active.id));
                        setDialog(null);
                      })
                    }
                  >
                    {active.kept ? "Prise gardée" : "Garder cette prise"}
                  </button>
                )}
                <button
                  aria-describedby="ps-busy-reason"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const entry = await idbVault().get(active.path);
                      if (!entry?.blob)
                        throw new Error("Fichier indisponible.");
                      const url = URL.createObjectURL(entry.blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = active.path.split("/").pop()!;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    })
                  }
                >
                  Télécharger
                </button>
                <button
                  aria-describedby="ps-busy-reason"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await transact((p) => ({
                        ...p,
                        assets: p.assets.filter((a) => a.id !== active.id),
                      }));
                      setDialog(null);
                    })
                  }
                >
                  Retirer du projet
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
