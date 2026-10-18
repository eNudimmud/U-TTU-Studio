import type { Metadata } from "next";
import { StatusPage } from "@/components/status-page";

export const metadata: Metadata = { title: "Page introuvable — U*TTU Studio", robots: { index: false } };

export default function NotFound() {
  return <StatusPage kind="introuvable" />;
}
