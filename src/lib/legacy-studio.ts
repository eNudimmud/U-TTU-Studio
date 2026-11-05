/** Context-bearing actions still use the historical project/agent adapters. */
export function legacyStudioHref(href: string): string {
  return href.replace(/^\/studio(?=$|[?#])/, "/studio/legacy");
}
