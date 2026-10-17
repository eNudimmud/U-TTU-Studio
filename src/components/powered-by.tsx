"use client";

import { useI18n } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";

/*
 * « Propulsé par ComfyUI » — a factual nod: every render goes through Comfy Cloud.
 * Official logomark from comfy.org/brand, used as provided (not recoloured, cropped or outlined).
 * Nominative use only: no endorsement or partnership implied. Sources and rules: docs/brand/comfy-badge.md.
 */
const COMFY_LOGOMARK = "/brand/comfy/comfy-logomark-yellow.svg";

export function ComfyLogomark({ size = 24 }: { size?: number }) {
  return <img className="comfy-logomark" src={assetPath(COMFY_LOGOMARK)} alt="" width={size} height={size} decoding="async" />;
}

export function PoweredBy({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return <a className={`comfy-badge ${className}`.trim()} href="https://comfy.org/" target="_blank" rel="noopener noreferrer" aria-label={t("landing.poweredByLabel")} data-comfy-badge="">
    <ComfyLogomark />
    <span>{t("landing.poweredBy")}</span>
  </a>;
}
