import { assetPath } from "@/lib/site";

/*
 * JD's logo, as drawn: the complete web, his own line, only downscaled (Lanczos, 1x/2x/3x files).
 * Never thicken or crop it; show it bigger instead. The web motif appears only here.
 * Files: scripts/brand/make_assets.py.
 */
const MARK_RATIO = 701 / 642;
/** Lossless WebP twins of the PNGs (same pixels, lighter); the PNG stays as `src`. */
const srcset = (base: string, h: number) => [1, 2, 3].map(k => `${assetPath(`/brand/${base}-h${h}${k === 1 ? "" : `@${k}x`}.webp`)} ${k}x`).join(", ");

/** The web mark: 48 px tall on phones, 56 px (studio) or 64 px (home) from 800 px wide. */
export function BrandMark({ desktop = 56 }: { desktop?: 56 | 64 }) {
  return <picture className="brand-mark-wrap">
    <source media="(min-width: 800px)" srcSet={srcset("uttu-mark", desktop)} width={Math.round(desktop * MARK_RATIO)} height={desktop} />
    <img className={`brand-mark brand-mark-${desktop}`} src={assetPath("/brand/uttu-mark-h48.png")} srcSet={srcset("uttu-mark", 48)} alt="" width={52} height={48} decoding="async" />
  </picture>;
}

/** The full lockup from JD's image (web + U*TTU + STUDIO), 180 px tall. */
export function BrandLockup({ className = "brand-lockup", alt = "" }: { className?: string; alt?: string }) {
  return <img className={className} src={assetPath("/brand/uttu-logo-h180.png")} srcSet={srcset("uttu-logo", 180)} alt={alt} width={142} height={180} decoding="async" />;
}

export function BrandName() {
  return <span className="brand-name">U<span className="brand-star">*</span>TTU<span className="brand-studio">Studio</span></span>;
}

export function Brand({ href, label = "U*TTU Studio", className = "wordmark", current, desktop = 56 }: { href: string; label?: string; className?: string; current?: boolean; desktop?: 56 | 64 }) {
  return <a href={href} className={className} aria-label={label} aria-current={current ? "page" : undefined}><BrandMark desktop={desktop} /><BrandName /></a>;
}
