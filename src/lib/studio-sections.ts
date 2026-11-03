// Shared by the Cinema PR and the Anime PR: each section registers exactly one entry here.
// Keeping this file small and append-only lets both branches touch it without touching each
// other's code — the merge is "two array items", never a conflict inside a shared component.
// Anime is already live at /look; its own PR may later point it at a dedicated door without
// this file's shape changing.

export type SectionId = "cinema" | "anime";

export interface StudioSection {
  id: SectionId;
  /** Where the door leads. Anime keeps its existing route until its own PR gives it one. */
  href: string;
  /** i18n keys: doors.<id>.name and doors.<id>.line (messages/*.json). */
  i18nKey: SectionId;
}

export const STUDIO_SECTIONS: readonly StudioSection[] = [
  { id: "cinema", href: "/studio/cgi", i18nKey: "cinema" },
  { id: "anime", href: "/look", i18nKey: "anime" },
];
