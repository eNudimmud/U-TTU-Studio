// Intentionally inert: no SDK, cookie, localStorage, network call or personal data.
export type StudioEvent = "gate_pass" | "dataset_zip_downloaded" | "comfy_app_opened" | "prompt_app_opened" | "waitlist_prepared" | "waitlist_copied";
export function trackEvent(_event: StudioEvent): void {
  // A future, explicitly chosen privacy-preserving provider can be connected here.
}
