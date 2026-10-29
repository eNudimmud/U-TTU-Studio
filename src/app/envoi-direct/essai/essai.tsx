"use client";

// Free check of the direct send on a deployment: browser → private Blob → server reads the
// file and deletes it. Comfy's upload and prompt are never called (0 crédits).
import { useState } from "react";
import { useI18n } from "@/components/i18n/provider";
import { essaiDirect } from "@/lib/envoi-direct/client";
import { getComfyAuthHeaders } from "@/lib/render/client";
import { sessionTokens } from "@/lib/render/session";
import { readRenderLink } from "@/lib/render/settings";

export function EssaiEnvoi() {
  const { t } = useI18n();
  const [line, setLine] = useState("");
  const run = async (file: File | undefined) => {
    if (!file) return;
    const link = readRenderLink(typeof localStorage === "undefined" ? null : localStorage);
    const headers = link.mode === "key" ? await getComfyAuthHeaders({ kind: "key", key: link.key }) : link.mode === "session" ? await getComfyAuthHeaders({ kind: "session", token: () => sessionTokens().token() }) : null;
    if (!headers) return setLine(t("envoiEssai.noAccount"));
    setLine(t("envoiEssai.sending"));
    try {
      const state = await fetch("/envoi-direct/etat", { cache: "no-store" }).then(response => response.json() as Promise<{ store?: boolean }>).catch(() => ({ store: false }));
      if (!state.store) return setLine(t("envoiEssai.noStore"));
      const result = await essaiDirect(file, "", headers);
      if (!result.direct) return setLine(t("envoiEssai.noAccount"));
      const deleted = result.deleted === true ? t("envoiEssai.yes") : result.deleted === false ? t("envoiEssai.no") : t("envoiEssai.unknown");
      setLine(t("envoiEssai.ok", { mb: ((result.bytes ?? 0) / 1_000_000).toFixed(1), deleted }));
    } catch (error) {
      setLine(t("envoiEssai.failed", { why: (error as Error).message }));
    }
  };
  return (
    <main id="contenu" style={{ maxWidth: 560, margin: "48px auto", padding: "0 20px", display: "grid", gap: 16 }}>
      <h1>{t("envoiEssai.title")}</h1>
      <p>{t("envoiEssai.lead")}</p>
      <label style={{ display: "grid", gap: 8 }}>
        {t("envoiEssai.pick")}
        <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" data-essai-file="" onChange={event => void run(event.target.files?.[0])} />
      </label>
      <p role="status" data-essai-line="">{line}</p>
    </main>
  );
}
