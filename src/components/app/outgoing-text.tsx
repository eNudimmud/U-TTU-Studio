"use client";

import { isPlaceLora } from "@/lib/coffre/model";
import { filmOutgoingText, priseOutgoingText, prisePicturePaths } from "@/lib/render/outgoing-text";
import { useI18n } from "@/components/i18n/provider";
import { useStudio } from "./studio-context";

/** The take prompt, exactly as Tourner would send it. Memory is named as absent. */
export function OutgoingTake() {
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
  return <section className="u-outgoing" aria-label={t("sent.title")}>
    <p className="u-label">{t("sent.title")}</p>
    {text
      ? <p className="u-outgoing-text">{text}</p>
      : <p className="u-small">{t("sent.noPictures")}</p>}
    <p className="u-small">{t("sent.memoryOut")}</p>
  </section>;
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
