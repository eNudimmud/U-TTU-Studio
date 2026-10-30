/**
 * Is this element actually on screen? False while the page is hidden, while an ancestor is
 * `hidden`/collapsed, or while it is scrolled out of view. Lets periodic repaints sleep instead
 * of burning the main thread behind a closed « Avancé » group.
 */
export function watchShown(node: Element, onShown?: () => void): { shown(): boolean; stop(): void } {
  let intersecting = true;
  const shown = () => !document.hidden && intersecting;
  const wake = () => { if (shown()) onShown?.(); };
  const observer = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
      const last = entries[entries.length - 1];
      if (!last) return;
      const was = shown();
      intersecting = last.isIntersecting;
      if (!was) wake();
    })
    : null;
  observer?.observe(node);
  const onVisibility = () => wake();
  document.addEventListener("visibilitychange", onVisibility);
  return { shown, stop() { observer?.disconnect(); document.removeEventListener("visibilitychange", onVisibility); } };
}
