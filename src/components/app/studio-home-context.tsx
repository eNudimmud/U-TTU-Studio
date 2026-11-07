"use client";

import { createContext, useContext, type ReactNode } from "react";
import { STUDIO_PUBLIC } from "@/lib/studio-home";

const StudioHomeContext = createContext(STUDIO_PUBLIC);

/** Which studio URL this shell writes: `/studio` in the main journey, `/studio/legacy` on the alias. */
export function StudioHomeProvider({ home, children }: { home: string; children: ReactNode }) {
  return <StudioHomeContext.Provider value={home}>{children}</StudioHomeContext.Provider>;
}

export function useStudioHome(): string {
  return useContext(StudioHomeContext);
}
