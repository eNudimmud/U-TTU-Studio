"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readPlateau, readTakeNote } from "@/lib/plateau";
import { SHARE_ACCEPT, X_DIRECT_NEEDS, X_TEXT_MAX, clipForX, shareableFile, takeCaption, xComposerUrl, xLength } from "@/lib/share";
import { Arrow } from "../glyph";

const noSubscription = () => () => {};
const shareCapable = () => typeof navigator !== "undefined" && typeof navigator.canShare === "function" && typeof navigator.share === "function";

/** Without `line` and `place`, the caption starts from the take noted on this device. */
export function PostTake({ titleId = "post-take-title", line, place }: { titleId?: string; line?: string; place?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [text, setText] = useState(() => takeCaption({ line, place }));
  const [status, setStatus] = useState("");
  const edited = useRef(false);
  const canShare = useSyncExternalStore(noSubscription, shareCapable, () => false);

  useEffect(() => {
    if (edited.current) return;
    if (line !== undefined || place !== undefined) {
      setText(takeCaption({ line, place }));
      return;
    }
    const note = readTakeNote(window.localStorage);
    const book = readPlateau(window.localStorage);
    const noted = book.scenes.find(scene => scene.id === note.sceneId)?.name ?? book.scenes[0]?.name ?? "";
    setText(takeCaption({ line: note.line, place: noted }));
  }, [line, place]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function pick(list: FileList | null) {
    const next = list?.[0];
    if (!next) return;
    if (!shareableFile(next)) {
      setStatus("Garde une vidéo MP4, WebM ou MOV, ou une image JPEG, PNG ou WebP, jusqu’à 512 Mo.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setStatus("");
  }

  const words = clipForX(text);
  const payload = file ? { files: [file], text: words } : null;
  const fileShare = Boolean(payload && canShare && navigator.canShare(payload));
  const over = xLength(text) > X_TEXT_MAX;

  async function share() {
    if (!payload) return;
    try {
      await navigator.share(payload);
      setStatus("Partage transmis. Rien n’est publié tant que tu ne valides pas dans X.");
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError" ? "Partage annulé. Rien n’est parti." : "Le partage n’a pas abouti. Ouvre le brouillon X.");
    }
  }

  return <section className="post-take" aria-labelledby={titleId}>
    <div className="post-head">
      <h2 id={titleId}>Publier la prise</h2>
      <p>Sur ton compte X. Le studio prépare le texte. Tu publies dans X.</p>
    </div>
    <div className="post-body">
      <label className={`post-drop${file ? " has-file" : ""}`}>
        <input type="file" accept={SHARE_ACCEPT} onChange={event => { pick(event.target.files); event.target.value = ""; }} />
        {preview && file
          ? file.type.startsWith("video/")
            ? <video src={preview} muted playsInline controls preload="metadata" />
            : <img src={preview} alt="" />
          : <span className="post-drop-title">Choisir la prise</span>}
        <span className="post-file">{file ? file.name : "Vidéo ou image, depuis cet appareil. Rien n’est envoyé au studio."}</span>
      </label>
      <div className="post-text">
        <label htmlFor={`${titleId}-text`}>Texte</label>
        <textarea id={`${titleId}-text`} value={text} rows={4} onChange={event => { edited.current = true; setText(event.target.value); }} />
        <p className={over ? "is-error" : ""}>{xLength(text)} / {X_TEXT_MAX}{over ? " : coupé à l’envoi" : ""}</p>
      </div>
    </div>
    <div className="post-actions">
      {fileShare
        ? <button type="button" className="button button-primary" onClick={() => void share()}>Partager vers X <Arrow /></button>
        : <a className={`button ${file ? "button-primary" : "button-outline"}`} href={xComposerUrl(words)} target="_blank" rel="noopener noreferrer" onClick={() => setStatus(file ? "Le brouillon X s’ouvre avec le texte. Ajoute la vidéo dans X, puis publie." : "Le brouillon X s’ouvre avec le texte. Rien n’est publié sans ton clic dans X.")}>
          Ouvrir le brouillon X <Arrow diagonal /><span className="sr-only">(nouvel onglet)</span>
        </a>}
      {fileShare && <a className="text-button" href={xComposerUrl(words)} target="_blank" rel="noopener noreferrer">Brouillon X, texte seul<span className="sr-only"> (nouvel onglet)</span></a>}
    </div>
    {fileShare && <p className="small-print">La liste de partage de l’appareil s’ouvre : choisis X.</p>}
    <p className="post-status" role="status">{status}</p>
    <div className="post-direct">
      <button type="button" className="button button-outline" disabled aria-describedby={`${titleId}-direct`}>Publier sans quitter le studio</button>
      <p id={`${titleId}-direct`} className="small-print">Éteint. Il faudrait une app X ({X_DIRECT_NEEDS.join(", ")}) sur un serveur, et que le studio garde ton jeton X. Il ne garde rien.</p>
    </div>
  </section>;
}
