import { assetPath } from "@/lib/site";
import type { AbstractIntlMessages } from "next-intl";
import "./storyboard-holding.css";

export type HoldCopy = {
  eyebrow: string;
  title: string;
  gold: string;
  coming: string;
  body: string;
  back: string;
  home: string;
  alt: string;
};

export function holdCopy(messages: AbstractIntlMessages): HoldCopy {
  const hold = (messages as { storyboard?: { hold?: Partial<HoldCopy> } }).storyboard?.hold ?? {};
  return {
    eyebrow: hold.eyebrow || "StoryWeave",
    title: hold.title || "Your story, woven shot by shot.",
    gold: hold.gold || "woven",
    coming: hold.coming || "StoryWeave is coming",
    body: hold.body || "The new storyboard — talk with Uttu, a panel, a 4-track timeline — arrives soon. Boards you already made stay where they are. Nothing is deleted or migrated.",
    back: hold.back || "Back to the studio",
    home: hold.home || "Home",
    alt: hold.alt || "Uttu",
  };
}

function Title({ title, gold }: { title: string; gold: string }) {
  const at = gold ? title.indexOf(gold) : -1;
  if (at < 0) return title;
  return <>{title.slice(0, at)}<em>{gold}</em>{title.slice(at + gold.length)}</>;
}

/** Dark, quiet door while the storyboard is closed. No board, no prompt, no migration. */
export function StoryboardHolding({ copy, gate }: { copy: HoldCopy; gate: "closed" | "sw" }) {
  const portrait = assetPath("/images/uttu-portrait.webp");
  const portraitLarge = assetPath("/images/uttu-portrait-960.webp");
  return <main id="contenu" className="sw-hold" data-storyboard-holding="" data-storyboard-gate={gate} tabIndex={-1}>
    <div className="sw-hold-grid">
      <div className="sw-hold-copy">
        <p className="eyebrow sw-hold-eyebrow">{copy.eyebrow}</p>
        <h1><Title title={copy.title} gold={copy.gold} /></h1>
        <p className="sw-hold-coming">{copy.coming}</p>
        <p className="sw-hold-body">{copy.body}</p>
        <div className="sw-hold-actions">
          <a className="button button-primary" href={assetPath("/studio")} data-storyboard-back="">{copy.back}</a>
          <a className="sw-hold-home" href={assetPath("/")} data-storyboard-home="">{copy.home}</a>
        </div>
      </div>
      <figure className="sw-hold-portrait">
        {/* Official portrait already in the repo. Never generated, never renamed. */}
        <img
          src={portrait}
          srcSet={`${portrait} 600w, ${portraitLarge} 960w`}
          sizes="(max-height: 520px) and (orientation: landscape) 120px, (max-width: 760px) 220px, 260px"
          width={600}
          height={900}
          alt={copy.alt}
          data-uttu-portrait=""
          decoding="async"
        />
      </figure>
    </div>
  </main>;
}
