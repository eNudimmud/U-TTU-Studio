"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StudioMode } from "@/lib/studio-modes";

const GoContext = createContext<(mode: StudioMode) => void>(() => {});

export function GoProvider({ go, children }: { go: (mode: StudioMode) => void; children: ReactNode }) {
  return <GoContext.Provider value={go}>{children}</GoContext.Provider>;
}

export function useGoToMode() {
  return useContext(GoContext);
}
