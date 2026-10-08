"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_PROJECT_FORMAT, FORMAT_FILE, formatMarkdown, readProjectFormat, type ProjectFormat } from "@/lib/prise/format";
import { useStudio } from "./studio-session";

const FormatContext = createContext<{ format: ProjectFormat; setFormat(next: ProjectFormat): void }>({
  format: DEFAULT_PROJECT_FORMAT,
  setFormat() {},
});

export function useFormat(): { format: ProjectFormat; setFormat(next: ProjectFormat): void } {
  return useContext(FormatContext);
}

export function FormatProvider({ children }: { children: ReactNode }) {
  const { ready, readProjectFile, writeProjectFile } = useStudio();
  const [format, setFormatState] = useState<ProjectFormat>(DEFAULT_PROJECT_FORMAT);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void readProjectFile(FORMAT_FILE).then(text => {
      if (live) setFormatState(readProjectFormat(text));
    });
    return () => { live = false; };
  }, [ready, readProjectFile]);

  const setFormat = useCallback((next: ProjectFormat) => {
    setFormatState(next);
    void writeProjectFile(FORMAT_FILE, formatMarkdown(next));
  }, [writeProjectFile]);

  return <FormatContext.Provider value={{ format, setFormat }}>{children}</FormatContext.Provider>;
}

export function FormatSwitch() {
  const { format, setFormat } = useFormat();
  return <div className="u-format" role="group" aria-label="Format du projet">
    {(["16:9", "9:16"] as const).map(item => (
      <button key={item} type="button" aria-pressed={format === item} onClick={() => setFormat(item)}>{item}</button>
    ))}
  </div>;
}
