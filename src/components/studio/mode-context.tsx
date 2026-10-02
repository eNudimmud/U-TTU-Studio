"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CinemaStep } from "@/lib/cinema";
import type { StudioMode } from "@/lib/studio-modes";

const GoContext = createContext<(mode: StudioMode) => void>(() => {});
const StepContext = createContext<(step: CinemaStep) => void>(() => {});

export function GoProvider({ go, children }: { go: (mode: StudioMode) => void; children: ReactNode }) {
  return <GoContext.Provider value={go}>{children}</GoContext.Provider>;
}

export function StepProvider({ go, children }: { go: (step: CinemaStep) => void; children: ReactNode }) {
  return <StepContext.Provider value={go}>{children}</StepContext.Provider>;
}

export function useGoToMode() {
  return useContext(GoContext);
}

export function useGoToStep() {
  return useContext(StepContext);
}
