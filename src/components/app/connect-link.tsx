"use client";

// Next to every « Relie ton compte… » reason: the action itself, one tap, never a dead end.

import { useI18n } from "@/components/i18n/provider";
import { useStudio } from "./studio-session";

export function ConnectLink() {
  const { t } = useI18n();
  const { connected, setSheet } = useStudio();
  if (connected) return null;
  return <button type="button" className="u-link u-connect-link" data-connect-link="" onClick={() => setSheet("connect")}>{t("outils.link")}</button>;
}
