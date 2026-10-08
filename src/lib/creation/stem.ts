// Voice, effect and music on the visitor's own Comfy account.
// The graph is the official template's paid node. Nothing here opens a network by itself.

import { measuredCost } from "../credits.ts";
import { MUSIC_SECONDS, SFX_DEFAULT_SECONDS } from "../montage/quotes.ts";
import { audioOutput, jobStage, RenderError, type RenderClient } from "../render/client.ts";
import type { ApiGraph } from "../render/take-graph.ts";

export type StemKind = "voix" | "effet" | "musique";

export interface StemRunInput {
  kind: StemKind;
  text: string;
  seed: number;
  clientId: string;
  balanceBefore: number;
}

export interface StemRunResult {
  jobId: string;
  audio: Blob;
  filename: string;
  balanceBefore: number;
  balanceAfter: number | null;
  costCredits: number | null;
}

export interface StemRunOptions {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const sleepDefault = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function seedOf(seed: number, max: number): number {
  if (!Number.isSafeInteger(seed) || seed < 0) return 0;
  return seed % (max + 1);
}

function saveAudio(prefix: string): ApiGraph[string] {
  return {
    class_type: "SaveAudioAdvanced",
    inputs: { audio: ["stem", 0], filename_prefix: prefix, format: "mp3", "format.quality": "V0" },
    _meta: { title: "Enregistrer" },
  };
}

/** The API graph for one paid sound template. No model name is meant for the screen. */
export function stemGraph(input: { kind: StemKind; text: string; seed: number }): ApiGraph {
  const text = input.text.trim();
  if (!text) throw new Error("Le texte est vide.");
  if (input.kind === "voix") {
    const seed = seedOf(input.seed, 2147483647);
    return {
      voice: {
        class_type: "ElevenLabsVoiceSelector",
        inputs: { voice: "Sarah (female, american)" },
        _meta: { title: "Voix" },
      },
      stem: {
        class_type: "ElevenLabsTextToSpeech",
        inputs: {
          voice: ["voice", 0],
          text,
          stability: 0.5,
          apply_text_normalization: "auto",
          model: "eleven_v4",
          "model.similarity_boost": 0.75,
          language_code: "",
          seed,
          output_format: "mp3_44100_192",
        },
        _meta: { title: "Parole" },
      },
      save: saveAudio("uttu-voix"),
    };
  }
  if (input.kind === "effet") {
    return {
      stem: {
        class_type: "ElevenLabsTextToSoundEffects",
        inputs: {
          text,
          model: "eleven_sfx_v2",
          "model.duration": SFX_DEFAULT_SECONDS,
          "model.loop": false,
          "model.prompt_influence": 0.3,
          output_format: "mp3_44100_192",
        },
        _meta: { title: "Effet" },
      },
      save: saveAudio("uttu-effet"),
    };
  }
  return {
    stem: {
      class_type: "SoniloTextToMusic",
      inputs: { prompt: text, duration: MUSIC_SECONDS, seed: seedOf(input.seed, 2147483647) },
      _meta: { title: "Musique" },
    },
    save: saveAudio("uttu-musique"),
  };
}

/** Uploads nothing. Queues, waits, and reads the cost from two balances. */
export async function runStem(client: RenderClient, input: StemRunInput, options: StemRunOptions = {}): Promise<StemRunResult> {
  const sleep = options.sleep ?? sleepDefault;
  const now = options.now ?? Date.now;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 4 * 60 * 1000;
  if (options.signal?.aborted) throw new RenderError("cancelled", "Rendu annulé avant l’envoi.");
  const graph = stemGraph({ kind: input.kind, text: input.text, seed: input.seed });
  const jobId = await client.submit(graph, input.clientId);
  const started = now();
  for (;;) {
    if (options.signal?.aborted) {
      await client.cancel(jobId).catch(() => {});
      throw new RenderError("cancelled", "Rendu annulé.");
    }
    if (now() - started > timeoutMs) throw new RenderError("timeout", "Le rendu dépasse la durée permise.");
    const status = await client.status(jobId);
    const stage = jobStage(status);
    if (stage === "done") break;
    if (stage === "failed") throw new RenderError("failed", "Le rendu a échoué dans le cloud.");
    if (stage === "cancelled") throw new RenderError("cancelled", "Le rendu a été annulé dans le cloud.");
    await sleep(pollMs);
  }
  const detail = await client.job(jobId);
  const ref = audioOutput(detail.outputs);
  if (!ref) throw new RenderError("failed", "Le rendu est fini, mais aucun son n’est sorti.");
  const audio = await client.file(ref);
  const balanceAfter = await client.balance().catch(() => null);
  const charged = balanceAfter !== null && balanceAfter !== input.balanceBefore ? balanceAfter : null;
  const filename = input.kind === "voix" ? "uttu-voix.mp3" : input.kind === "effet" ? "uttu-effet.mp3" : "uttu-musique.mp3";
  return {
    jobId,
    audio,
    filename,
    balanceBefore: input.balanceBefore,
    balanceAfter: charged,
    costCredits: measuredCost(input.balanceBefore, charged),
  };
}
