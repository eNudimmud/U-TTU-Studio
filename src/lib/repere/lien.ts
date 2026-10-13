// Short map links are followed only toward Google Maps or Earth. Nothing else is fetched.

const SHORT = new Set(["maps.app.goo.gl", "goo.gl", "maps.app"]);

export function isShortHost(hostname: string): boolean {
  return SHORT.has(hostname.toLowerCase());
}

const MAPS_COUNTRY = /^maps\.google\.(?:[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/;

export function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (isShortHost(host)) return true;
  if (host === "earth.google.com" || host === "maps.google.com" || host === "google.com" || host === "www.google.com") return true;
  return MAPS_COUNTRY.test(host);
}
