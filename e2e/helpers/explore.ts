import type { Page } from '@playwright/test';
/** Visible actions in the first screen: what a beginner sees without scrolling. */
export async function firstScreen(page: Page) {
  return page.evaluate(() => {
    const h = innerHeight, w = innerWidth;
    const els = [...document.querySelectorAll<HTMLElement>('a[href], button, [role=button], input:not([type=hidden]), textarea, select, label.u-primary, label.u-secondary')];
    return els.filter(e => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && b.top < h && b.bottom > 0 && b.left < w && s.visibility !== 'hidden' && s.display !== 'none'; })
      .map(e => { const b = e.getBoundingClientRect(); const label = (e.getAttribute('aria-label') || e.innerText || (e as HTMLInputElement).placeholder || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 50); return `${e.tagName.toLowerCase()}${e.className.includes('u-primary') ? '★' : ''} "${label}" ${Math.round(b.width)}x${Math.round(b.height)}${b.height < 44 || b.width < 44 ? ' <44' : ''}`; });
  });
}
