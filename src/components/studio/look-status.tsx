"use client";

import { LOOK_HELD_LINE, LOOK_HELD_TITLE, LOOK_OPEN_LINE, LOOK_OPEN_TITLE } from "@/lib/cinema";

export function LookStatus({ held }: { held: boolean }) {
  return <p className="look-status" role="status" data-held={held ? "true" : "false"}>
    <span className="look-status-mark">{held ? LOOK_HELD_TITLE : LOOK_OPEN_TITLE}</span>
    <span>{held ? LOOK_HELD_LINE : LOOK_OPEN_LINE}</span>
  </p>;
}
