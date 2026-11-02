import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";
import { loadCatalog } from "@/lib/i18n/catalog";
import { requestLocale } from "@/lib/i18n/server";

/** Document title follows the visitor's language. English is the default (no locale cookie). */
export async function generateMetadata(): Promise<Metadata> {
  const messages = await loadCatalog(await requestLocale());
  const status = messages.status as { introuvable?: { title?: string } } | undefined;
  const heading = (status?.introuvable?.title || "This page does not exist.").replace(/\.$/, "");
  return { title: `${heading} — U*TTU Studio`, robots: { index: false } };
}

export default function NotFound() {
  return <StatusPage kind="introuvable" />;
}
