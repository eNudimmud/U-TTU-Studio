"use client";

import { useState, useSyncExternalStore } from "react";
import type { Take } from "@/lib/coffre/model";
import { clipForX, takeCaption, xComposerUrl } from "@/lib/share";
import { Save, Share } from "./glyphs";
import { useStudio } from "./studio-context";

const never = () => () => {};

function filesShareable(): boolean {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "prise.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

/** Phone: the device share sheet with the video, X first in line. Desktop: save, then X's composer. Never posts by itself. */
export function PublishActions({ take }: { take: Take }) {
  const { media } = useStudio();
  const canShare = useSyncExternalStore(never, filesShareable, () => false);
  const [status, setStatus] = useState("");
  const url = media[take.video];
  const caption = clipForX(takeCaption({ line: take.line, place: take.sceneName }));
  const filename = `uttu-${take.id}.${take.video.endsWith(".webm") ? "webm" : "mp4"}`;

  async function share() {
    if (!url) return;
    try {
      const blob = await fetch(url).then(response => response.blob());
      await navigator.share({ files: [new File([blob], filename, { type: blob.type || "video/mp4" })], text: caption });
      setStatus("Partage ouvert. Rien n’est publié sans ton geste dans X.");
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError" ? "Partage annulé." : "Le partage n’a pas abouti.");
    }
  }

  if (!url) return null;
  return <div className="u-publish">
    {canShare
      ? <button type="button" className="u-primary" onClick={() => void share()}>Publier <Share /></button>
      : <>
        <a className="u-primary" href={xComposerUrl(caption)} target="_blank" rel="noopener noreferrer" onClick={() => setStatus("Le brouillon X s’ouvre avec le texte. Joins la vidéo enregistrée, puis publie.")}>Publier sur X <Share /></a>
        <a className="u-secondary" href={url} download={filename}>Enregistrer la vidéo <Save /></a>
      </>}
    {status && <p className="u-small" role="status">{status}</p>}
  </div>;
}
