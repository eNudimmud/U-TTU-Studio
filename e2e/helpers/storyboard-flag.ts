/** The paper storyboard, now only behind ?storyboard=legacy. Other query params are kept. */
export function legacyStoryboard(href: string, extra: Record<string, string> = {}): string {
  const url = new URL(href, "http://127.0.0.1:3000");
  url.searchParams.set("storyboard", "legacy");
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}
