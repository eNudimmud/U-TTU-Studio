// A finished take goes to the visitor's own network. The studio prepares the
// text and hands off to X's composer or the device share sheet. It never posts.

export const X_COMPOSER = "https://x.com/intent/post";
export const X_TEXT_MAX = 280;
const X_URL_WEIGHT = 23;
const URL_PATTERN = /https?:\/\/\S+/g;

export function takeCaption(input: { line?: string; place?: string }): string {
  const line = (input.line ?? "").replace(/\s+/g, " ").trim().replace(/[.!?…]+$/, "");
  const place = (input.place ?? "").replace(/\s+/g, " ").trim();
  const head = [line, place].filter(Boolean).join(" — ");
  return `${head ? `${head}. ` : ""}Tourné dans U*TTU Studio.`;
}

/** X counts every link as 23 characters, whatever its length. */
export function xLength(text: string): number {
  let length = 0;
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    length += [...text.slice(last, match.index)].length + X_URL_WEIGHT;
    last = (match.index ?? 0) + match[0].length;
  }
  return length + [...text.slice(last)].length;
}

export function clipForX(text: string): string {
  const chars = [...text.replace(/\r\n/g, "\n")];
  return chars.length <= X_TEXT_MAX ? chars.join("") : chars.slice(0, X_TEXT_MAX).join("");
}

/** X's own composer, prefilled. The visitor still taps Post there. */
export function xComposerUrl(text: string): string {
  const url = new URL(X_COMPOSER);
  url.searchParams.set("text", clipForX(text));
  return url.toString();
}

export const SHARE_ACCEPT = "video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp";
export const SHARE_FILE_MAX = 512 * 1024 * 1024;

export function shareableFile(file: { type: string; size: number }): boolean {
  return SHARE_ACCEPT.split(",").includes(file.type) && file.size > 0 && file.size <= SHARE_FILE_MAX;
}

/** What the post control needs to exist. Not wired: the studio would have to hold the visitor's X token. */
export const X_DIRECT_NEEDS = ["X_CLIENT_ID", "X_CLIENT_SECRET"] as const;
