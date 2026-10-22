/**
 * Only persistable Studio references may be handed across tool navigation.
 * Blob URLs are scoped to a document and are deliberately erased by rememberSource.
 */
export function agentSourceId(source: { url: string; path?: string }): string | undefined {
  if (source.path?.trim()) return source.path;
  return safeHandoffUrl(source.url) || undefined;
}

/** Serialize a handoff without carrying document-scoped preview URLs. */
export function safeHandoffUrl(url: string): string {
  return /^(?:blob|data|filesystem|javascript):/i.test(url) ? "" : url;
}
