"use client";

import { StatusPage } from "@/components/status-page";

/** A page that breaks never touches what is saved: the studio stays on this device. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset(): void }) {
  return <StatusPage kind="erreur" onRetry={reset} />;
}
