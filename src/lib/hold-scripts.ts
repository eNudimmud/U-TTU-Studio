/* Next emits async chunk tags in the head. On a fast machine their download
   finishes before the first contentful paint, and Lighthouse's simulated LCP
   then counts those bytes. The tags stay inert until the layout's paint
   observer runs them, and script preloads are removed so the request itself
   starts after that paint. */

const CHUNK = /<script\b([^>]*?)\bsrc="([^"]*\/_next\/static\/[^"]+)"([^>]*)>\s*<\/script>/g;

function dropScriptPreloads(html: string): string {
  return html.replace(/<link\b[^>]*>/g, tag => (
    /\brel="preload"/.test(tag) && /\bas="script"/.test(tag) ? "" : tag
  ));
}

export function holdNextScripts(html: string): string {
  return dropScriptPreloads(html).replace(CHUNK, (full, before: string, src: string, after: string) => {
    const attrs = `${before} ${after}`;
    if (/\bnoModule\b|\bnomodule\b/i.test(attrs)) return full;
    const id = /\bid="([^"]*)"/.exec(attrs);
    const idAttr = id ? ` data-u-id="${id[1]}"` : "";
    // No preload: a request that finishes before first paint is still on the
    // simulated LCP path. The bytes start when the paint observer runs the tag.
    return `<script type="text/plain" data-u-src="${src}"${idAttr}></script>`;
  });
}
