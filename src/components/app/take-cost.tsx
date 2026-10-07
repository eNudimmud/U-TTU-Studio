"use client";

import { formatCredits } from "@/lib/credits";
import { takeCostView, type LandedCostTake } from "@/lib/render/landed-cost";
import { useI18n } from "@/components/i18n/provider";

/** Announced quote against the cost that was actually read, on the take that just landed. */
export function TakeCostLines({ take, gateLine }: { take: LandedCostTake; gateLine?: string | null }) {
  const { t, say } = useI18n();
  const cost = takeCostView(take);
  if (cost.kind === "none") return null;
  const announced = formatCredits(cost.announced);
  const high = cost.high === null ? "" : formatCredits(cost.high);
  const line = cost.kind === "unread"
    ? (cost.high === null ? t("take.announcedUnread", { announced }) : t("take.announcedUnreadHigh", { announced, high }))
    : (cost.high === null
      ? t("take.announcedReal", { announced, real: formatCredits(cost.real) })
      : t("take.announcedHigh", { announced, high, real: formatCredits(cost.real) }));
  return <>
    <p className="u-small">{t("take.filed")}</p>
    <p className="u-small">{line}</p>
    {cost.kind === "read" && cost.exceeded && <p className="u-cost is-block">{t("take.overQuote")}</p>}
    {cost.kind === "read" && cost.exceeded && gateLine ? <p className="u-small">{say(gateLine)}</p> : null}
  </>;
}
