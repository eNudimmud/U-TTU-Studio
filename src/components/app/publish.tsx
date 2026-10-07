"use client";

import { useState, useSyncExternalStore } from "react";
import type { Take } from "@/lib/coffre/model";
import { clipForX, takeCaption, xComposerUrl } from "@/lib/share";
import { useI18n } from "@/components/i18n/provider";
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
  const { t } = useI18n();
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
      setStatus(t("publish.shareOpen"));
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "AbortError" ? t("publish.shareCancel") : t("publish.shareFailed"));
    }
  }

  if (!url) return null;
  return <div className="u-publish">
    {canShare
      ? <button type="button" className="u-primary" onClick={() => void share()}>{t("publish.publish")} <Share /></button>
      : <>
        <a className="u-primary" href={xComposerUrl(caption)} target="_blank" rel="noopener noreferrer" onClick={() => setStatus(t("publish.xDraft"))}>{t("publish.publishX")} <Share /></a>
        <a className="u-secondary" href={url} download={filename}>{t("publish.save")} <Save /></a>
      </>}
    {status && <p className="u-small" role="status">{status}</p>}
  </div>;
}
