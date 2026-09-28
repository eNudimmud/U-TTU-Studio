"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const LaunchContext = createContext<{
  id: string | null;
  request: (id: string) => void;
}>({ id: null, request: () => {} });

export function ProcessLaunchProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const request = useCallback((next: string) => setId(next), []);
  const value = useMemo(() => ({ id, request }), [id, request]);
  return <LaunchContext.Provider value={value}>{children}</LaunchContext.Provider>;
}

export function useProcessLaunch() {
  return useContext(LaunchContext);
}
