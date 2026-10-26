// Wikimedia Commons: geotagged photos around the place, no key. One request at a time, the app named
// in Api-User-Agent (Commons asks for it), `origin=*` for the browser. Every file has its own licence
// and author, written under the photo and kept with any décor made from it.
// Commons holds everything near a point: zoo animals, church naves, portraits, maps. Only outdoor
// views of the place go through.

import { distanceMeters, photoLicenseUrl, type PhotoRue } from "./panoramax.ts";

export const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
export const COMMONS_AGENT = "U*TTU Studio (github.com/eNudimmud/U-TTU-Studio)";
export const COMMONS_RAYON = 250;
/** Width asked for each photo: one of the sizes Commons keeps ready. */
export const COMMONS_LARGEUR = 960;
const THUMB_SMALL = 500;

export interface CommonsPoint { pageid: number; title: string; lat: number; lon: number; dist: number }

export function commonsGeoUrl(lat: number, lon: number, radius = COMMONS_RAYON, limit = 500): string {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", origin: "*",
    list: "geosearch", gsnamespace: "6", gsprimary: "all",
    gscoord: `${lat.toFixed(6)}|${lon.toFixed(6)}`,
    gsradius: String(Math.min(COMMONS_RAYON, Math.max(10, Math.round(radius)))),
    gslimit: String(Math.min(500, Math.max(1, Math.round(limit)))),
  });
  return `${COMMONS_API}?${params}`;
}

export function commonsInfoUrl(pageids: readonly number[]): string {
  const params = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", origin: "*",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: String(COMMONS_LARGEUR),
    iiextmetadatafilter: "LicenseShortName|Artist|Credit|Categories|ImageDescription|ObjectName|DateTimeOriginal",
    pageids: pageids.slice(0, 50).join("|"),
  });
  return `${COMMONS_API}?${params}`;
}

export function parseGeosearch(payload: unknown): CommonsPoint[] {
  const rows = (payload as { query?: { geosearch?: unknown } } | null)?.query?.geosearch;
  if (!Array.isArray(rows)) return [];
  const seen = new Set<number>();
  return rows.flatMap(row => {
    const r = row as { pageid?: unknown; title?: unknown; lat?: unknown; lon?: unknown; dist?: unknown };
    const pageid = Number(r.pageid), lat = Number(r.lat), lon = Number(r.lon);
    if (!Number.isInteger(pageid) || pageid <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon) || typeof r.title !== "string" || seen.has(pageid)) return [];
    seen.add(pageid);
    return [{ pageid, title: r.title, lat, lon, dist: Number(r.dist) || 0 }];
  });
}

// Words that say the picture is not an outdoor view of the place. Titles and categories, EN/FR/DE/ES/IT.
const NOT_A_VIEW = new RegExp([
  // inside
  "interior", "interieur", "intérieur", "innenansicht", "innenraum", "\\binside\\b", "indoors?", "ceiling", "plafond", "chandelier", "lustre",
  "stained[- ]glass", "vitra(il|ux)", "\\bnave\\b", "\\bnef\\b", "altar", "autel", "\\borgans?\\b", "\\borgue", "pipe organ", "choir stalls", "crypt",
  "lobby", "staircase", "escalier intérieur", "\\broom\\b", "\\bhall of\\b", "restaurant interior", "museum objects?", "exhibits?\\b", "exhibition", "exposition",
  "collection of", "in the collection", "showcase", "vitrine", "elevators?", "ascenseurs?", "engines?\\b", "machinery",
  // animals and plants up close
  "\\bzoos?\\b", "wildlife", "animals?\\b", "\\baves\\b", "\\bbirds?\\b", "oiseaux?", "mammals?", "reptiles?", "insects?", "butterfl", "\\bducks?\\b",
  "geese", "\\bgoose\\b", "squirrels?", "\\bdogs?\\b", "\\bcats?\\b", "\\bhorses?\\b", "penguins?", "sea ?lions?", "\\bbears?\\b", "leopard", "monkeys?",
  "macaque", "mongoose", "pigeons?", "sparrows?", "starlings?", "\\bgulls?\\b", "mallard", "turtles?", "fish(es)?\\b", "kangaroos?", "\\bgoats?\\b", "\\bcows?\\b", "flowers? close", "macro photograph", "fungi",
  // people
  "portraits?", "\\bpeople\\b", "\\bpersons?\\b", "selfie", "\\bmen\\b", "\\bwomen\\b", "\\bgirls?\\b", "\\bboys?\\b", "children", "\\bkids?\\b", "actors?\\b",
  "actress", "musicians?", "singers?", "performers?", "politicians?", "athletes?", "\\bwedding", "\\bfaces?\\b", "headshot", "gestures", "clothing", "fashion",
  "\\bmeets?\\b", "meeting", "secretary", "ministers?\\b", "ambassador", "negotiations?", "envoy", "conference", "writers?\\b", "\\bauthors?\\b",
  // close-ups of vehicles and things
  "automobiles?", "\\bcars?\\b", "\\bcoupe\\b", "ferrari", "porsche", "lamborghini", "\\bgears?\\b",
  // not a photo of the place
  "\\bmaps?\\b", "\\bcartes?\\b", "\\bplans? (of|de)\\b", "floor plan", "diagram", "\\bcharts?\\b", "logos?\\b", "coats? of arms", "\\bflags?\\b", "emblem",
  "documents?\\b", "letters?\\b", "manuscripts?", "\\bbooks?\\b", "newspaper", "posters?\\b", "affiches?", "postcards?", "cartes? postales?", "\\btickets?\\b",
  "paintings?", "peintures?", "gemälde", "fresco", "drawings?", "dessins?", "engravings?", "gravures?", "lithograph", "illustrations?", "sculpture details?",
  "screenshots?", "satellite", "aerial", "\\baérienne", "from above", "orthophoto", "\\bcoins?\\b", "stamps?\\b", "banknotes?", "plaques? commémorative",
  "memorial plaques?", "100elles", "street (name )?signs?", "plaques? de rue", "road signs?", "\\bsignage\\b", "inscriptions?", "signatures?", "\\bfood\\b", "\\bdish(es)?\\b", "cuisine", "\\bmenu\\b", "products?\\b", "fruits?\\b", "vegetables?", "strawberr", "apricots?", "peach(es)?\\b", "black and white photographs",
  "historical images", "\\b1[89]\\d0s\\b", "19th century", "20th century photographs",
].join("|"), "i");

/** The first word that marks a file as not a view of the place, or null. */
export function motBruit(text: string): string | null {
  return NOT_A_VIEW.exec(text)?.[0] ?? null;
}

/** Is this file an outdoor photo of the place? Mime, size, shape and words in its title and categories. */
export function vueDuLieu(file: { title: string; mime: string; width: number; height: number; text: string; year?: number | null }): boolean {
  if (file.mime !== "image/jpeg") return false;
  if (file.width < 640 || file.height < 400) return false;
  // Tall strips and very wide stitched panoramas make poor references; 2:1 spheres are handled apart.
  const ratio = file.width / Math.max(1, file.height);
  if (ratio < 0.6 || ratio > 2.6) return false;
  if (file.year && file.year < 1990) return false;
  return !NOT_A_VIEW.test(`${file.title} ${file.text}`);
}

// A sphere shows everything around: it is kept only when its words say it was taken outside.
const OUTSIDE = /\b(streets?|squares?|plazas?|places?|platz|piazza|plaza|rues?|strasse|straße|avenues?|boulevards?|parks?|gardens?|jardins?|bridges?|ponts?|quais?|quays?|promenades?|exteriors?|extérieur|outdoors?|aussen|skyline|cityscape|vue sur)\b/i;

/** A 2:1 equirectangular sphere that Commons says is one, taken outside. */
export function sphereCommons(file: { width: number; height: number; text: string }): boolean {
  const ratio = file.width / Math.max(1, file.height);
  return ratio > 1.98 && ratio < 2.02 && file.width >= 3000 && /equirectangular|360°? ?(panoram|photo|view)|spherical panoram|photosphere/i.test(file.text)
    && OUTSIDE.test(file.text) && !NOT_A_VIEW.test(file.text);
}

/** A 2:1 file that looks like a sphere: never shown flat in the grid. */
const lookLikeSphere = (width: number, height: number) => width >= 3000 && Math.abs(width / Math.max(1, height) - 2) < 0.02;

/** « CC BY-SA 4.0 » → « CC-BY-SA-4.0 »; public domain → « PD ». Anything else is not reused. */
export function licenceCommons(short: string): string | null {
  const text = short.replace(/\s+/g, " ").trim();
  const cc = /^CC[ -](BY(?:-SA)?)[ -](1\.0|2\.0|2\.5|3\.0|4\.0)(?:[ -][a-z]{2,3})?$/i.exec(text);
  if (cc) return `CC-${cc[1].toUpperCase()}-${cc[2]}`;
  if (/^(CC0|CC0 1\.0|CC-zero)$/i.test(text)) return "CC0-1.0";
  if (/^(public domain|PD|PD-[a-z0-9-]+)$/i.test(text)) return "PD";
  return null;
}

/** Artist is HTML: links, spans, sometimes a whole table. Keep the plain name. */
export function auteurCommons(html: string): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'")
    .replace(/\(\s*(talk|discussion|contribs?)\s*\)/gi, " ").replace(/\s+/g, " ").replace(/[\s.,;:]+$/, "").replace(/^(User|Utilisateur|Benutzer):/i, "").trim();
  return /^(unknown|anonymous|inconnu)\b/i.test(text) ? "" : text.slice(0, 60);
}

export function commonsThumbAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "upload.wikimedia.org" || u.hostname === "thumb.wikimedia.org") && !u.username && !u.password && !u.port;
  } catch { return false; }
}

/** Smaller picture for the grid, when Commons gave a resized one. */
function petite(url: string): string {
  return url.replace(new RegExp(`/${COMMONS_LARGEUR}px-`), `/${THUMB_SMALL}px-`);
}

/**
 * Up to `max` points spread over the area: words in the title alone already drop the zoo and the
 * nave, then one point per `cell`-metre square, nearest first, then a second round for the rest.
 */
export function preselection(points: readonly CommonsPoint[], lat: number, lon: number, max = 100, cell = 40): CommonsPoint[] {
  const k = 111_320 * Math.max(0.01, Math.cos(lat * Math.PI / 180));
  const ok = points.filter(point => /\.jpe?g$/i.test(point.title) && !NOT_A_VIEW.test(point.title))
    .map(point => ({ point, d: distanceMeters(lat, lon, point.lat, point.lon), c: `${Math.floor((point.lon - lon) * k / cell)},${Math.floor((point.lat - lat) * 110_540 / cell)}` }))
    .sort((a, b) => a.d - b.d);
  const used = new Map<string, number>();
  const out: CommonsPoint[] = [];
  for (const round of [1, 2, 3]) {
    for (const item of ok) {
      if (out.length >= max) return out;
      if ((used.get(item.c) ?? 0) !== round - 1 || out.includes(item.point)) continue;
      used.set(item.c, round);
      out.push(item.point);
    }
  }
  return out;
}

type Meta = Record<string, { value?: unknown } | undefined>;
const metaText = (meta: Meta, key: string) => typeof meta[key]?.value === "string" ? String(meta[key]!.value) : "";

/** Reads one imageinfo answer. Points give the position; files that are not views of the place are dropped. */
export function parseCommonsInfo(payload: unknown, points: ReadonlyMap<number, CommonsPoint>): PhotoRue[] {
  const pages = (payload as { query?: { pages?: unknown } } | null)?.query?.pages;
  const list = Array.isArray(pages) ? pages : pages && typeof pages === "object" ? Object.values(pages) : [];
  const out: PhotoRue[] = [];
  for (const row of list) {
    const page = row as { pageid?: unknown; title?: unknown; imageinfo?: unknown };
    const point = points.get(Number(page.pageid));
    const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] as {
      thumburl?: unknown; url?: unknown; descriptionurl?: unknown; width?: unknown; height?: unknown; mime?: unknown; extmetadata?: Meta;
    } : null;
    if (!point || !info) continue;
    const meta = info.extmetadata ?? {};
    const text = [metaText(meta, "Categories"), metaText(meta, "ObjectName"), metaText(meta, "ImageDescription").replace(/<[^>]*>/g, " ").slice(0, 400)].join(" ");
    const width = Number(info.width) || 0, height = Number(info.height) || 0;
    const mime = typeof info.mime === "string" ? info.mime : "";
    const year = Number(/\b(1[0-9]{3}|20[0-9]{2})\b/.exec(metaText(meta, "DateTimeOriginal"))?.[1]) || null;
    const tour = mime === "image/jpeg" && sphereCommons({ width, height, text: `${point.title} ${text}` });
    if (!tour && (lookLikeSphere(width, height) || !vueDuLieu({ title: point.title, mime, width, height, text, year }))) continue;
    const license = licenceCommons(metaText(meta, "LicenseShortName"));
    const author = auteurCommons(metaText(meta, "Artist")) || auteurCommons(metaText(meta, "Credit"));
    if (!license || !author) continue;
    const thumbBig = typeof info.thumburl === "string" ? info.thumburl : "";
    const original = typeof info.url === "string" ? info.url : "";
    // A sphere needs its full width to be turned; a flat view is fine at 960.
    const view = tour && commonsThumbAllowed(original) ? original : thumbBig;
    if (!commonsThumbAllowed(view)) continue;
    const page_ = typeof info.descriptionurl === "string" && /^https:\/\/commons\.wikimedia\.org\/wiki\//.test(info.descriptionurl) ? info.descriptionurl : "";
    out.push({
      id: `wmc-${point.pageid}`,
      author,
      thumb: commonsThumbAllowed(thumbBig) ? petite(thumbBig) : view,
      view,
      source: "commons",
      license,
      licenseUrl: photoLicenseUrl(license),
      sourceUrl: page_ || `https://commons.wikimedia.org/?curid=${point.pageid}`,
      tour,
      lat: point.lat,
      lon: point.lon,
      heading: 0,
      fov: tour ? 360 : null,
      next: null,
      prev: null,
      // One photographer's set counts as one series: no six shots of the same bank front.
      serie: `wmc:${author.toLowerCase().replace(/\s+/g, " ").slice(0, 40)}`,
    });
  }
  return out;
}
