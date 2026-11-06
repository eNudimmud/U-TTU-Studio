import { idbVault, type VaultStore } from "../coffre/store.ts";
import {
  createRenderClient,
  renderCredentialScope,
  jobStage,
  pickOutputs,
  type OutputKind,
  type OutputRef,
  type RenderClient,
} from "../render/client.ts";
import { readRenderLink } from "../render/settings.ts";
import { sessionTokens } from "../render/session.ts";
import {
  readPending,
  recoverableClient,
  clearPending,
  bindPendingJob,
  type PendingRender,
} from "../render/recovery.ts";
import { qwenImageGraph, QWEN_EDIT, QWEN_TEXT } from "../render/qwen-image.ts";
import { BILLED_CREDITS_PER_GPU_SECOND } from "../credits.ts";
import { animeImageGraph, ANIME_TEMPLATE } from "./anime-graph.ts";
import {
  fileResult,
  readProduction,
  writeProduction,
  nextTakeNumber,
  type ProductionAsset,
  type Production,
  type AssetKind,
} from "./model.ts";
import type { Section } from "./registry.ts";
import { checkMedia, InvalidMediaError } from "./media.ts";
import type { ToolSettings } from "./tools.ts";
import type { Entree } from "../outils/catalogue.ts";
import { finishSource, sectionFinishGraph } from "./finish.ts";

export interface CreationRequest {
  id: string;
  project: string;
  section: Section;
  kind: AssetKind;
  name: string;
  prompt: string;
  refs: string[];
  structure?: string;
  seed: number;
  quote: number;
  shotId?: string;
  operation?: "image" | "video" | "finish" | "tool";
  sourceId?: string;
  outputKind?: OutputKind;
  tool?: ToolSettings;
  lot?: number;
}
export const vault = () => idbVault();
export function browserClient(): RenderClient | null {
  const link = readRenderLink(localStorage);
  if (link.mode === "key")
    return createRenderClient({
      auth: { kind: "key", key: link.key },
      openWeightsMode: true,
    });
  if (link.mode === "session") {
    const tokens = sessionTokens();
    return createRenderClient({
      auth: { kind: "session", token: () => tokens.token() },
      openWeightsMode: true,
    });
  }
  return null;
}
export async function locked<T>(
  name: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      "Ce navigateur ne permet pas de sécuriser les opérations. Ouvre le studio dans Chrome ou Safari à jour.",
    );
  return navigator.locks.request(name, { ifAvailable: true }, (lock) => {
    if (!lock)
      throw new Error("Une opération est déjà en cours dans un autre onglet.");
    return run();
  });
}
export const requestPath = (project: string) =>
  `Projets/${project}/.uttu/production-request.json`;
async function uploaded(store: VaultStore, client: RenderClient, path: string) {
  const blob = (await store.get(path))?.blob;
  if (!blob)
    throw new Error("Une référence n’est plus disponible dans ce projet.");
  return client.upload(blob, path.split("/").pop()!);
}
export async function collectResult(
  store: VaultStore,
  client: RenderClient,
  receipt: PendingRender,
  request: CreationRequest,
  status: (text: string) => void,
  signal?: AbortSignal,
): Promise<Production> {
  if (!receipt.jobId || !receipt.outputNode)
    throw new Error(
      "L’envoi est incertain. Retrouve son identifiant dans Comfy avant toute nouvelle génération.",
    );
  const job = receipt.jobId;
  const until = Date.now() + 40 * 60_000;
  while (true) {
    if (signal?.aborted || Date.now() > until)
      throw new Error(
        "Suivi interrompu. Le reçu est conservé ; récupère le résultat sans relancer la génération.",
      );
    const stage = jobStage(await client.status(job));
    if (stage === "failed" || stage === "cancelled") {
      clearPending(localStorage, job);
      throw new Error(
        "Le rendu a échoué chez Comfy. Aucun résultat ni coût n’a été ajouté au projet.",
      );
    }
    if (stage === "done") break;
    status(
      stage === "queue"
        ? "Dans la file de rendu…"
        : stage === "prepare"
          ? "Préparation du rendu…"
          : "Création en cours…",
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  status("Vérification et sauvegarde du résultat…");
  const detail = await client.job(job);
  const media =
    request.outputKind || (request.operation === "video" ? "video" : "image");
  const outputs = pickOutputs(detail.outputs, media, receipt.outputNode).filter(
    (ref) => ref.type === "output",
  );
  const rejectInvalid = async (reason: string): Promise<never> => {
    await store.put({
      path: `Projets/${request.project}/.uttu/rejected-${request.id}.json`,
      text: JSON.stringify({
        jobId: job,
        outputNode: receipt.outputNode,
        reason,
      }),
      updatedAt: Date.now(),
    });
    clearPending(localStorage, job);
    throw new Error(`${reason} Aucun résultat ni coût ajouté au projet.`);
  };
  const count = request.lot || 1;
  if (outputs.length < count)
    return rejectInvalid(
      "Le nœud final n’a pas fourni toutes les sorties attendues.",
    );
  const files: { output: OutputRef; blob: Blob; seconds?: number }[] = [];
  for (const output of outputs.slice(0, count)) {
    const blob = await client.file(output);
    let seconds;
    try {
      seconds = await checkMedia(blob, media);
    } catch (error) {
      if (error instanceof InvalidMediaError)
        return rejectInvalid(error.message);
      throw error;
    }
    files.push({ output, blob, seconds });
  }
  await locked(`uttu-production-${request.project}`, async () => {
    const latest = await readProduction(store, request.project);
    const firstNumber = request.shotId
      ? nextTakeNumber(latest, request.section, request.shotId)
      : undefined;
    for (const [index, file] of files.entries()) {
      const { output, blob, seconds } = file;
      const ext = output.filename.split(".").pop()!.toLowerCase();
      const id = index ? `${request.id}-${index + 1}` : request.id;
      const path = `Projets/${request.project}/Assets/${id}.${ext}`;
      if (request.operation === "finish") {
        if (!latest.assets.some((a) => a.id === request.sourceId))
          throw new Error(
            "La prise source a été retirée. Le reçu est conservé.",
          );
        await store.put({ path, blob, updatedAt: Date.now() });
        if ((await store.get(path))?.blob?.size !== blob.size)
          throw new Error("La finition n’a pas pu être conservée.");
        await writeProduction(store, request.project, {
          ...latest,
          assets: latest.assets.map((a) =>
            a.id === request.sourceId
              ? {
                  ...a,
                  finalPath: path,
                  finalJobId: job,
                  finalOutput: output,
                  finalCredits: null,
                }
              : a,
          ),
        });
      } else {
        const asset: ProductionAsset = {
          id,
          section: request.section,
          kind: request.kind,
          name: index
            ? `${request.name} · ${index + 1}/${count}`
            : request.name,
          path,
          media,
          seconds,
          prompt: request.prompt,
          refs: request.refs,
          structure: request.structure,
          at: receipt.at,
          source: "comfy",
          jobId: job,
          output,
          template: receipt.template,
          seed: request.seed,
          quote: index ? undefined : request.quote,
          credits: null,
          ...(request.shotId
            ? {
                shotId: request.shotId,
                number: firstNumber! + index,
                kept: false,
              }
            : {}),
        };
        await fileResult(
          store,
          request.project,
          asset,
          blob,
          async () => false,
        );
      }
    }
  });
  // Only the job's billed events count. Never infer a debit from other work on the account.
  const charge = await client
    .jobCharge(job, BILLED_CREDITS_PER_GPU_SECOND)
    .catch(() => null);
  const next = await locked(`uttu-production-${request.project}`, async () => {
    const saved = await readProduction(store, request.project);
    const next = {
      ...saved,
      assets: saved.assets.map((a) =>
        request.operation === "finish" && a.id === request.sourceId
          ? { ...a, finalCredits: charge?.credits ?? a.finalCredits ?? null }
          : a.id === request.id
            ? { ...a, credits: charge?.credits ?? a.credits ?? null }
            : a,
      ),
    };
    await writeProduction(store, request.project, next);
    return next;
  });
  clearPending(localStorage, job);
  return next;
}
export async function createImage(
  request: CreationRequest,
  status: (text: string) => void,
  signal?: AbortSignal,
) {
  return locked("uttu-paid-render", async () => {
    const client = browserClient();
    if (!client) throw new Error("Connecte ton compte Comfy Cloud.");
    if (readPending(localStorage))
      throw new Error(
        "Un résultat attend sa récupération. Aucun nouvel envoi.",
      );
    const store = vault();
    const account = await renderCredentialScope(client);
    if (!account) throw new Error("La connexion Comfy est expirée.");
    const balance = await client.balance();
    if (balance === null || balance < request.quote)
      throw new Error("Le solde Comfy ne permet pas de confirmer ce devis.");
    status("Envoi des références…");
    for (const path of [
      ...request.refs,
      ...(request.structure ? [request.structure] : []),
    ]) {
      if (!path.startsWith(`Projets/${request.project}/`))
        throw new Error("Une référence appartient à un autre projet.");
    }
    const inputNames = new Map<string, string>();
    for (const path of request.refs)
      inputNames.set(path, await uploaded(store, client, path));
    const images = [...inputNames.values()];
    const structure = request.structure
      ? inputNames.get(request.structure) ||
        (await uploaded(store, client, request.structure))
      : undefined;
    let binding;
    if (request.operation === "tool" && request.tool) {
      const tools = await import("./tools.ts");
      const inputs: Partial<Record<Entree, string>> = {};
      for (const [slot, path] of Object.entries(request.tool.inputs)) {
        if (!inputNames.has(path))
          throw new Error("Une source de l’outil manque.");
        inputs[slot as Entree] = inputNames.get(path);
      }
      if (request.tool.id === "vid-prolonger") {
        const source = await store.get(request.tool.inputs.video || "");
        if (!source?.blob) throw new Error("Vidéo source manquante.");
        const url = URL.createObjectURL(source.blob);
        try {
          const frame = await (
            await import("../suite/media.ts")
          ).lastFrame(url);
          if (!frame) throw new Error("Dernière image illisible.");
          inputs.image = await client.upload(frame, frame.name);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const tool = tools.buildTool(
        request.tool,
        inputs,
        request.prompt,
        request.seed,
      );
      if (tool.quote.credits !== request.quote || balance < tool.quote.high)
        throw new Error(
          "Le devis ou le solde a changé. Vérifie le montant avant l’envoi.",
        );
      request.outputKind = tool.media;
      request.lot = tool.lot;
      binding = tool;
    } else if (request.operation === "finish") {
      const source = finishSource(
        (await readProduction(store, request.project)).assets,
        request.sourceId || "",
        request.section,
      );
      if (images.length !== 1 || request.refs[0] !== source.path)
        throw new Error("La source ne correspond pas à la prise gardée.");
      request.outputKind = source.media;
      binding = await sectionFinishGraph(source, images[0], request.seed);
    } else if (request.operation === "video") {
      if (images.length !== 1)
        throw new Error("L’animation demande une image de départ.");
      const video = await import("./video-graph.ts");
      binding = video.videoBinding({
        section: request.section,
        image: images[0],
        prompt: request.prompt,
        seed: request.seed,
      });
    } else if (request.section === "anime") {
      binding = {
        graph: animeImageGraph({
          prompt: request.prompt,
          images,
          structure,
          seed: request.seed,
          portrait: request.kind === "cast",
        }),
        template: ANIME_TEMPLATE,
        outputNode: "21",
      };
    } else {
      binding = {
        graph: qwenImageGraph({
          prompt: request.prompt,
          images,
          seed: request.seed,
          edit: images.length > 0,
        }),
        template: images.length ? QWEN_EDIT : QWEN_TEXT,
        outputNode: "461",
      };
    }
    const { graph, template, outputNode } = binding;
    const receiptKind =
      request.operation === "finish"
        ? "final"
        : request.outputKind === "audio"
          ? "son"
          : request.outputKind ||
            (request.operation === "video" ? "video" : "image");
    const receipt: PendingRender = {
      version: 1,
      kind: receiptKind,
      project: request.project,
      id: request.id,
      name: request.name,
      prompt: request.prompt,
      at: new Date().toISOString(),
      account,
      refs: request.refs,
      template,
      quote: request.quote,
      balanceBefore: balance,
      jobId: null,
      outputNode,
    };
    await store.put({
      path: `Projets/${request.project}/Assets/${request.id}-workflow.json`,
      text: JSON.stringify(graph),
      updatedAt: Date.now(),
    });
    await store.put({
      path: requestPath(request.project),
      text: JSON.stringify(request),
      updatedAt: Date.now(),
    });
    const safe = recoverableClient(client, localStorage, receipt);
    status("Envoi du rendu…");
    const jobId = await safe.submit(graph, crypto.randomUUID());
    return collectResult(
      store,
      client,
      { ...receipt, jobId },
      request,
      status,
      signal,
    );
  });
}
export async function recoverCreation(
  status: (text: string) => void,
  manualJobId = "",
) {
  return locked("uttu-paid-render", async () => {
    const client = browserClient();
    let receipt = readPending(localStorage);
    if (!client || !receipt)
      throw new Error("Aucun rendu à récupérer sur ce compte.");
    if (receipt.account !== (await renderCredentialScope(client)))
      throw new Error("Reconnecte le compte Comfy utilisé pour ce rendu.");
    if (!receipt.jobId && manualJobId.trim())
      receipt = await bindPendingJob(
        localStorage,
        client,
        receipt.account,
        manualJobId,
        true,
      );
    const store = vault();
    const raw = (await store.get(requestPath(receipt.project)))?.text;
    if (!raw)
      throw new Error(
        "Ce rendu vient de l’ancien studio. Utilise sa commande Récupérer le rendu.",
      );
    const request = JSON.parse(raw) as CreationRequest;
    if (request.id !== receipt.id || request.project !== receipt.project)
      throw new Error("Le reçu ne correspond pas à cette création.");
    await collectResult(store, client, receipt, request, status);
    return receipt.project;
  });
}
