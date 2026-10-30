"use client";

import { useEffect, useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/provider";
import { studioHref } from "@/lib/studio-origin";

/**
 * A studio link that works on every host: unchanged where Comfy login is authorized,
 * absolute on the authorized origin elsewhere (with the current language). The server
 * render keeps the relative path; src/proxy.ts redirects it if the click comes first.
 */
export function useStudioHref(path: string): string {
  const { locale } = useLocaleSwitch();
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(window.location.host), []);
  return host === null ? path : studioHref(path, host, locale);
}
