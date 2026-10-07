"use client";

import { isPlaceLora } from "@/lib/coffre/model";
import { placeShotLine, placeShotList } from "@/lib/lora/place";
import { filmOutgoingText, lieuOutgoingText, personnageOutgoingText, priseOutgoingText, prisePicturePaths } from "@/lib/render/outgoing-text";
import { useI18n } from "@/components/i18n/provider";
import { useStudio } from "./studio-context";

/** The take prompt, exactly as Tourner would send it. Memory is named as absent. */
export function OutgoingTake({ clamp = false }: { clamp?: boolean }) {
  const { t } = useI18n();
  const { studio, scene, line, engine, chosenLora } = useStudio();
  const place = scene ? { name: scene.name, note: scene.note, stills: scene.stills, render: scene.render } : null;
  const text = prisePicturePaths(studio.look.photos, place).length > 0
    ? priseOutgoingText({
      traits: studio.look.traits,
      photos: studio.look.photos,
      place,
      line,
      engine: engine === "lora" ? "lora" : "comfy",
      subject: chosenLora?.trigger,
    })
    : "";
  const folded = clamp && text.length > 180;
  return <section className="u-outgoing" aria-label={t("sent.title")}>
    <p className="u-label">{t("sent.title")}</p>
    {text
      ? <p className={folded ? "u-outgoing-text u-outgoing-clamp" : "u-outgoing-text"}>{text}</p>
      : <p className="u-small">{t("sent.noPictures")}</p>}
    <p className="u-small">{t("sent.memoryOut")}</p>
  </section>;
}

/** The rest of a long prompt. It stays off the gold gesture so four lines cannot push the button down. */
export function OutgoingTakeFull() {
  const { t } = useI18n();
  const { studio, scene, line, engine, chosenLora } = useStudio();
  const place = scene ? { name: scene.name, note: scene.note, stills: scene.stills, render: scene.render } : null;
  const text = prisePicturePaths(studio.look.photos, place).length > 0
    ? priseOutgoingText({
      traits: studio.look.traits,
      photos: studio.look.photos,
      place,
      line,
      engine: engine === "lora" ? "lora" : "comfy",
      subject: chosenLora?.trigger,
    })
    : "";
  if (text.length <= 180) return null;
  return <details className="u-fold">
    <summary>{t("sent.full")}</summary>
    <p className="u-outgoing-text">{text}</p>
  </details>;
}

/** The path prompt, once the frames on the place are the ones that would leave. */
export function OutgoingFilm() {
  const { t } = useI18n();
  const { studio, scene } = useStudio();
  const person = studio.loras.find(item => !isPlaceLora(item));
  const frames = scene?.frames.length ?? 0;
  const text = scene && person && frames >= 2
    ? filmOutgoingText({ subject: person.trigger, place: scene.name, note: scene.note, frames })
    : "";
  return <section className="u-outgoing" aria-label={t("sent.title")}>
    <p className="u-label">{t("sent.title")}</p>
    {text
      ? <p className="u-outgoing-text">{text}</p>
      : <p className="u-small">{t("sent.notYet")}</p>}
    {text ? <p className="u-small">{t("sent.memoryOut")}</p> : null}
  </section>;
}

/** The call word Former would send. Memory is named as absent. */
export function OutgoingPersonnage() {
  const { t } = useI18n();
  const { studio } = useStudio();
  const text = personnageOutgoingText(studio.role.name);
  return <section className="u-outgoing" aria-label={t("sent.title")}>
    <p className="u-label">{t("sent.title")}</p>
    {text
      ? <p className="u-outgoing-text">{text}</p>
      : <p className="u-small">{t("sent.noName")}</p>}
    <p className="u-small">{t("sent.memoryOut")}</p>
  </section>;
}

/** The place word Former ce lieu would send, once enough views let the gesture leave. */
export function OutgoingLieu() {
  const { t } = useI18n();
  const { scene } = useStudio();
  if (!scene) return null;
  const ready = placeShotLine(placeShotList(scene).length).ready;
  const text = ready ? lieuOutgoingText(scene.name) : "";
  return <section className="u-outgoing" aria-label={t("sent.title")}>
    <p className="u-label">{t("sent.title")}</p>
    {text
      ? <p className="u-outgoing-text">{text}</p>
      : <p className="u-small">{t("sent.noViews")}</p>}
    <p className="u-small">{t("sent.memoryOut")}</p>
  </section>;
}
