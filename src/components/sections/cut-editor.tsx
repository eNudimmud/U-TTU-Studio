"use client";
import { useEffect, useState } from "react";
import { idbVault } from "@/lib/coffre/store";
import {
  emptyEdit,
  editDuration,
  reorderVideo,
  type Edit,
} from "@/lib/montage/edit";
import { keptClip, validateCut } from "@/lib/sections/edit";
import {
  fileResult,
  readProduction,
  type ProductionAsset,
} from "@/lib/sections/model";
import { videoSeconds } from "@/lib/sections/media";
import type { Section } from "@/lib/sections/registry";

export default function CutEditor({
  project,
  section,
  assets,
  refresh,
}: {
  project: string;
  section: Section;
  assets: ProductionAsset[];
  refresh: () => Promise<void>;
}) {
  const [edit, setEdit] = useState<Edit>(() =>
    emptyEdit(`cut-${section}`, "Mon montage"),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  const path = `Projets/${project}/.uttu/cut-${section}.json`;
  useEffect(() => {
    let alive = true;
    setReady(false);
    setMessage("");
    void idbVault()
      .get(path)
      .then((entry) => {
        if (!alive) return;
        if (entry?.text) {
          const value = JSON.parse(entry.text) as Edit;
          if (!Array.isArray(value.video) || !Array.isArray(value.audio))
            throw Error("Montage illisible.");
          setEdit(value);
        } else setEdit(emptyEdit(`cut-${section}`, "Mon montage"));
        setReady(true);
      })
      .catch((e) => { if (alive) setMessage(e.message); });
    return () => {
      alive = false;
    };
  }, [path, section]);
  const choices = assets.filter(
    (a) => a.section === section && a.kind === "take" && a.kept,
  );
  const save = async () => {
    await idbVault().put({
      path,
      text: JSON.stringify(edit),
      updatedAt: Date.now(),
    });
  };
  const exportCut = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const urls = new Map<string, string>();
    try {
      const store = idbVault();
      validateCut(edit, (await readProduction(store, project)).assets, section);
      if (editDuration(edit) > 60)
        throw Error(
          "Ce montage dépasse 60 secondes. Exporte-le en plusieurs séquences.",
        );
      await save();
      for (const clip of edit.video) {
        const entry = await store.get(clip.source!);
        if (!entry?.blob)
          throw Error("Une source du montage manque sur cet appareil.");
        urls.set(clip.source!, URL.createObjectURL(entry.blob));
      }
      const { exportMp4, exportExtension } = await import(
        "@/lib/montage/encode"
      );
      let warning = "";
      const blob = await exportMp4({
        edit,
        urlOf: (path) => urls.get(path) || "",
        size: { width: 1920, height: 1080, fps: 24, quality: "high" },
        onProgress: (done, total) =>
          setMessage(
            `Export en cours · ${Math.round((done / Math.max(total, 1)) * 100)} %`,
          ),
        onWarning: (value) => {
          warning = value;
        },
      });
      const seconds = await videoSeconds(blob),
        id = crypto.randomUUID(),
        extension = exportExtension(blob);
      const asset: ProductionAsset = {
        id,
        section,
        kind: "edit",
        name: edit.name,
        path: `Projets/${project}/Assets/${id}.${extension}`,
        media: "video",
        seconds,
        prompt: "",
        at: new Date().toISOString(),
        refs: edit.video.map((c) => c.source!),
        source: "edit",
      };
      const { locked } = await import("@/lib/sections/runtime");
      await locked(`uttu-production-${project}`, async () => {
        validateCut(edit, (await readProduction(store, project)).assets, section);
        await fileResult(store, project, asset, blob, async () => false);
      });
      await refresh();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `uttu-${section}-${id.slice(0, 8)}.${extension}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(warning || "Montage ajouté au projet et téléchargé.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      setBusy(false);
    }
  };
  return (
    <section className="ps-editor" aria-label="Montage des prises gardées">
      <div className="ps-section-title">
        <h2>Table de montage</h2>
        <span>{editDuration(edit).toFixed(1)} s · export sur cet appareil</span>
      </div>
      {message && (
        <p role="status" className="ps-status">
          {message}
        </p>
      )}
      <p id="ps-cut-state" className="ps-help" role="status">
        {!ready ? "Le montage se charge…" : busy ? "Export en cours…" : ""}
      </p>
      <fieldset aria-describedby="ps-cut-state" disabled={busy || !ready}>
        <label>
          Nom du montage
          <input
            value={edit.name}
            maxLength={80}
            onChange={(e) => setEdit({ ...edit, name: e.target.value })}
          />
        </label>
        {edit.video.length > 0 && (
          <p id="ps-cut-order" className="ps-help">
            Les flèches déplacent la prise dans les limites du montage.
          </p>
        )}
        <div className="ps-cut-list">
          {edit.video.map((clip, index) => (
            <div className="ps-cut-row" key={`${clip.id}-${index}`}>
              <span className="ps-step-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <b>{clip.label}</b>
              <label>
                Début (s)
                <input
                  type="number"
                  min={0}
                  max={clip.end - 0.1}
                  step={0.1}
                  value={clip.start}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      video: edit.video.map((c, i) =>
                        i === index
                          ? { ...c, start: Number(e.target.value) }
                          : c,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Fin (s)
                <input
                  type="number"
                  min={clip.start + 0.1}
                  max={clip.media}
                  step={0.1}
                  value={clip.end}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      video: edit.video.map((c, i) =>
                        i === index ? { ...c, end: Number(e.target.value) } : c,
                      ),
                    })
                  }
                />
              </label>
              <div>
                <button
                  type="button"
                  aria-label={`Avancer ${clip.label}`}
                  aria-describedby="ps-cut-order"
                  disabled={!index}
                  onClick={() => setEdit(reorderVideo(edit, index, index - 1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Reculer ${clip.label}`}
                  aria-describedby="ps-cut-order"
                  disabled={index === edit.video.length - 1}
                  onClick={() => setEdit(reorderVideo(edit, index, index + 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Retirer ${clip.label} du montage`}
                  onClick={() =>
                    setEdit({
                      ...edit,
                      video: edit.video.filter((_, i) => i !== index),
                    })
                  }
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        {!choices.length && (
          <p className="ps-note">
            Garde une prise dans Shoot pour commencer ton montage.
          </p>
        )}
        <div className="ps-actions">
          {choices
            .filter((a) => !edit.video.some((c) => c.takeId === a.id))
            .map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() =>
                  setEdit({ ...edit, video: [...edit.video, keptClip(a)] })
                }
              >
                + {a.name}
              </button>
            ))}
        </div>
        <div className="ps-actions">
          <button
            type="button"
            onClick={() =>
              void save()
                .then(() => setMessage("Montage enregistré."))
                .catch((e) => setMessage(e.message))
            }
          >
            Enregistrer le montage
          </button>
          <button
            type="button"
            className="ps-primary"
            aria-describedby="ps-cut-export"
            disabled={!edit.video.length || editDuration(edit) > 60}
            onClick={() => void exportCut()}
          >
            Exporter · gratuit →
          </button>
        </div>
        <p id="ps-cut-export" className="ps-editor-note">
          {!edit.video.length ? "Ajoute une prise gardée pour exporter. " : ""}
          {editDuration(edit) > 60 ? "Raccourcis le montage à 60 secondes pour exporter. " : ""}
          1080p · 24 images/s · jusqu’à 60 secondes. Le format téléchargé dépend
          des capacités du navigateur.
        </p>
      </fieldset>
    </section>
  );
}
