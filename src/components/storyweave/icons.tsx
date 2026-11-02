export function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return <svg className="sw-i" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

export const ICON = {
  plus: "M12 5v14M5 12h14",
  mic: "M9 3h6v11a3 3 0 0 1-6 0V3zM5 11a7 7 0 0 0 14 0M12 18v3",
  send: "M12 19V5M6 11l6-6 6 6",
  panel: "M3 4h18v16H3zM15 4v16",
  chat: "M4 5h16v11H9l-5 4z",
  down: "M6 9l6 6 6-6",
  chev: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  export: "M12 15V4M7 9l5-5 5 5M5 15v4h14v-4",
  script: "M5 5h14M12 5v14",
  audio: "M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2",
  cut: "M8 8.5 20 17M8 15.5 20 7",
  text: "M5 6h14M12 6v13",
  del: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  prev: "M11 6 4 12l7 6zM20 6l-7 6 7 6z",
  next: "M13 6l7 6-7 6zM4 6l7 6-7 6z",
  play: "M8 5v14l11-7z",
  full: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  cam: "M3 7h13v10H3zM16 11l5-3v8l-5-3",
  note: "M9 18V6l10-2v12",
  lock: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3",
  dl: "M12 4v11M7 10l5 5 5-5M5 20h14",
} as const;
