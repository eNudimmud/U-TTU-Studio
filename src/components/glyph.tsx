export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M5 19 19 5M5 5h14v14" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.5" /></svg>;
}

export function Glyph({ kind }: { kind: "bible" | "stills" | "gate" | "thread" }) {
  const paths = {
    bible: <><path d="M8 9h14l4 4 4-4h14v34H30l-4 4-4-4H8zM26 13v34M13 17h7m-7 7h7m12-7h7m-7 7h7M13 33h7m12 0h7" /><circle cx="26" cy="5" r="2" /></>,
    stills: <><path d="M7 7h15v15H7zM30 7h15v15H30zM7 30h15v15H7zM30 30h15v15H30zM22 14h8M14 22v8m24-8v8m-16 8h8" /><circle cx="26" cy="26" r="2" /></>,
    gate: <><path d="M8 8h36v36H8zM26 8v36M8 26h36M13 17l4 4 5-7M32 14l7 7m0-7-7 7M13 34l4 4 5-7M32 34h7" /></>,
    thread: <><path d="M7 10h38M7 26h38M7 42h38M15 6v40m22-40v40M7 10c20 0 16 32 38 32M7 42c20 0 16-32 38-32" /><circle cx="26" cy="26" r="4" /></>,
  };
  return <svg width="52" height="52" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">{paths[kind]}</svg>;
}
