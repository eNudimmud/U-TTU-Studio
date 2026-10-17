import { assetPath } from "@/lib/site";

/** JD's web mark (the only place the web motif appears) and the « U*TTU Studio » name, as in his logo. */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  // Small-size cut of the logo: same drawing, line weight raised so it survives at 28 px.
  return <img className={className} src={assetPath("/brand/uttu-mark-small.png")} alt="" width={38} height={28} decoding="async" />;
}

export function BrandName() {
  return <span className="brand-name">U<span className="brand-star">*</span>TTU<span className="brand-studio">Studio</span></span>;
}

export function Brand({ href, label = "U*TTU Studio", className = "wordmark", current }: { href: string; label?: string; className?: string; current?: boolean }) {
  return <a href={href} className={className} aria-label={label} aria-current={current ? "page" : undefined}><BrandMark /><BrandName /></a>;
}
