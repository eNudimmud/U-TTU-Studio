// Intentionally inert: no SDK, cookie, localStorage, network call or personal data.
export type StudioEvent = "brief_prepared" | "brief_copied" | "comparison_opened";
export function trackEvent(_event: StudioEvent): void {
  // A future, explicitly chosen privacy-preserving provider can be connected here.
}
