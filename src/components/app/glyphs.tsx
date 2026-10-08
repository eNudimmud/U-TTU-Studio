type GlyphProps = { className?: string };

const base = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const Plus = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M12 5v14M5 12h14" /></svg>;
export const Close = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const Arrow = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const Share = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M12 15V3M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
export const Save = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>;
export const Trash = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const Refresh = ({ className }: GlyphProps) => <svg {...base} className={className}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>;

/** The vault: a box tied with one thread. */
export const Coffre = ({ className }: GlyphProps) => <svg {...base} className={className}><rect x="3.5" y="6.5" width="17" height="13" rx="2" /><path d="M3.5 10.5h17M12 10.5v4" /></svg>;

/** Sphère: a web seen from its centre. */
export const Web = ({ className }: GlyphProps) => <svg {...base} className={className}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" /></svg>;

export const Iii = ({ className }: GlyphProps) => <svg width="22" height="20" viewBox="0 0 22 20" className={className} aria-hidden="true" fill="currentColor"><rect x="2" y="7" width="3.4" height="11" /><rect x="9.3" y="7" width="3.4" height="11" /><rect x="16.6" y="7" width="3.4" height="11" /><rect x="2" y="1.5" width="3.4" height="3.4" /><rect x="9.3" y="1.5" width="3.4" height="3.4" /><rect x="16.6" y="1.5" width="3.4" height="3.4" /></svg>;

export type MarkKind = "personnage" | "lieu" | "prise" | "sequence" | "note";

/** A quiet mark for a card that has no picture yet. */
export function KindMark({ kind }: { kind: MarkKind }) {
  return <div className={`u-card-blank is-${kind}`} aria-hidden="true">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {kind === "personnage" && <><circle cx="12" cy="8" r="3" /><path d="M6 19c1.2-3 3.2-4.5 6-4.5S16.8 16 18 19" /></>}
      {kind === "lieu" && <><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M4 15l4-3 3 2 3-4 6 5" /></>}
      {kind === "prise" && <><rect x="3.5" y="6" width="17" height="12" rx="1.5" /><path d="M10 9.5v5l4.5-2.5z" /></>}
      {kind === "sequence" && <path d="M5 7h14M5 12h14M5 17h9" />}
      {kind === "note" && <><path d="M7 3.5h7l4 4V20H7z" /><path d="M14 3.5V8h4M9 12h6M9 16h4" /></>}
    </svg>
  </div>;
}
