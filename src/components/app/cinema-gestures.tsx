"use client";

import { useState } from "react";
import {
  CAMERA_MOVES, CINEMA_GESTURE_IDS, CINEMA_GESTURES, cinemaGestureGate, gestureInputsReady, gestureReasonKey,
  type GestureSources,
} from "@/lib/cinema-gestures";
import { useI18n } from "@/components/i18n/provider";
import { Why } from "./guide-bubble";
import { useStudio } from "./studio-context";

/** No measured quote is on file for these templates. Without a number, nothing leaves. */
const QUOTE_MEASURED = false;

function sourcesFor(studio: ReturnType<typeof useStudio>, shotId: string | undefined, pose: string | null): GestureSources {
  const { studio: memory, scene, media } = studio;
  const shot = shotId ? memory.shots.find(item => item.id === shotId) : null;
  const takes = shot ? memory.takes.filter(take => shot.takeIds.includes(take.id)) : memory.takes;
  const scenes = shotId
    ? memory.scenes.filter(item => takes.some(take => take.sceneId === item.id))
    : scene ? [scene] : [];
  const images = [
    ...memory.look.photos,
    ...scenes.flatMap(item => [item.render ?? "", ...item.stills]),
    ...takes.map(take => take.poster ?? ""),
  ];
  const videos = takes.filter(take => take.video && media[take.video]).map(take => take.video);
  return { images, videos, pose };
}

export function CinemaGestures({ shotId, anchor = false }: { shotId?: string; anchor?: boolean }) {
  const studio = useStudio();
  const { t } = useI18n();
  const [pose, setPose] = useState<string | null>(null);
  const sources = sourcesFor(studio, shotId, pose);

  return <section className="u-cinema" id={anchor ? "cinema-gestes" : undefined} aria-label={t("cinema.kicker")}>
    <div className="u-cinema-lead">
      <p className="u-label">{t("cinema.kicker")}</p>
      <p className="u-small">{shotId ? t("cinema.leadPlan") : t("cinema.lead")}</p>
      <p className="u-small">{t("cinema.lands")}</p>
    </div>
    {CINEMA_GESTURE_IDS.map(id => {
      const fact = CINEMA_GESTURES[id];
      const inputsReady = gestureInputsReady(id, sources);
      const gate = cinemaGestureGate({
        schemaRead: fact.schemaRead,
        inputsReady,
        quoteMeasured: QUOTE_MEASURED,
      });
      const reason = gate.block ? t(gestureReasonKey(id, gate.block, sources)) : "";
      return <article key={id} className="u-card u-fiche" data-geste={id}>
        <h2>{t(`cinema.${id}.name`)}</h2>
        <p>{t(`cinema.${id}.sentence`)}</p>
        {id === "raccord" && <p className="u-small">{t("cinema.raccord.apart")}</p>}
        {id === "camera" && <MovePicker pose={pose} onPick={setPose} />}
        <button type="button" className="u-secondary" disabled={!gate.enabled}>{t("verb.tourner")}</button>
        <Why on={!gate.enabled} text={reason} />
      </article>;
    })}
  </section>;
}

function MovePicker({ pose, onPick }: { pose: string | null; onPick(pose: string): void }) {
  const { t } = useI18n();
  return <fieldset className="u-segments">
    <legend className="u-label">{t("cinema.camera.moves")}</legend>
    {CAMERA_MOVES.map(move => <button key={move} type="button" aria-pressed={pose === move} onClick={() => onPick(move)}>{t(`cinema.camera.pose.${poseKey(move)}`)}</button>)}
  </fieldset>;
}

function poseKey(move: (typeof CAMERA_MOVES)[number]): string {
  switch (move) {
    case "Pan Up": return "up";
    case "Pan Down": return "down";
    case "Pan Left": return "left";
    case "Pan Right": return "right";
    case "Zoom In": return "in";
    case "Zoom Out": return "out";
    case "Anti Clockwise (ACW)": return "acw";
    case "ClockWise (CW)": return "cw";
  }
}
