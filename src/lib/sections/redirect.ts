export type LegacySearch = Record<string, string | string[] | undefined>;

/** Keep shared-link options when retiring an old route. The destination is fixed by the page. */
export function withSearchParams(destination: string, search: LegacySearch): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.append(key, value);
  }
  return query.size ? `${destination}?${query}` : destination;
}
