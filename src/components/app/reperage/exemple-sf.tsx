"use client";

// The Place Saint-François (Lausanne) example: a 3D frame, one street photo, one result.
// The result is an illustration made outside Comfy: it says so, in every language.
// Sources and licences: docs/CREDITS.md.

import { useI18n } from "@/components/i18n/provider";
import { assetPath } from "@/lib/site";

export function ExempleSaintFrancois({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const items = [
    { file: "sf-vue3d", label: t("rep3d.example.a") },
    { file: "sf-rue", label: t("rep3d.example.b") },
    { file: "sf-exemple", label: t("rep3d.example.c") },
  ];
  return <figure className={compact ? "u-rep3d-example is-compact" : "u-rep3d-example"} data-rep3d-example="">
    <div className="u-rep3d-example-row">
      {items.map((item, index) => <div key={item.file} className="u-rep3d-example-cell">
        <img src={assetPath(`/exemples/reperage/${item.file}.webp`)} alt="" width={960} height={540} loading="lazy" decoding="async" />
        <span>{index === 2 ? "= " : index === 1 ? "+ " : ""}{item.label}</span>
      </div>)}
    </div>
    <figcaption>
      <b>{t("rep3d.example.tag")} · {t("rep3d.example.place")}</b>
      <span data-rep3d-example-note="">{t("rep3d.example.note")}</span>
    </figcaption>
  </figure>;
}
