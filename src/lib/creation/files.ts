// A tiny folder, used in tests and by the vault link. No browser required.

export interface MemFile {
  path: string;
  text?: string;
  bytes?: Uint8Array;
}

export interface MemDir {
  write(path: string, data: string | Uint8Array): void;
  read(path: string): MemFile | null;
  list(): MemFile[];
  remove(path: string): void;
}

export function memoryDir(): MemDir {
  const files = new Map<string, MemFile>();
  return {
    write(path, data) {
      const clean = path.replace(/^\/+/, "");
      if (!clean || clean.split("/").some(part => part === ".." || part === "")) throw new Error("chemin refusé");
      if (typeof data === "string") files.set(clean, { path: clean, text: data });
      else files.set(clean, { path: clean, bytes: data });
    },
    read(path) {
      return files.get(path.replace(/^\/+/, "")) ?? null;
    },
    list() {
      return [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
    },
    remove(path) {
      files.delete(path.replace(/^\/+/, ""));
    },
  };
}

/** Writes a character note beside its picture, then reads the note back. */
export function writeNote(dir: MemDir, path: string, note: string, media?: { path: string; bytes: Uint8Array }): void {
  dir.write(path, note);
  if (media) dir.write(media.path, media.bytes);
}
