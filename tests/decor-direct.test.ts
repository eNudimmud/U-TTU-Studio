import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lignesContexte, lireContexte, tagsContexte, villePays } from "../src/lib/repere3d/contexte.ts";
import { MAPILLARY_ATTRIBUTION, mapillaryBboxUrl, parseMapillary } from "../src/lib/repere/mapillary.ts";
import { mapillaryPhoto } from "../src/lib/repere/direct.ts";
import { dansLaVue, diversifier, pano360, panoramaxBboxUrl, parsePanoramax, zoneVue, type PhotoRue } from "../src/lib/repere/panoramax.ts";

const NYC = { lat: 40.7638, lon: -73.9794 };

function photo(id: string, dNorth: number, dEast: number, serie?: string, extra: Partial<PhotoRue> = {}): PhotoRue {
  return {
    id, author: "Ada", thumb: "https://panoramax.xyz/t.jpg", view: "https://panoramax.xyz/v.jpg", source: "panoramax", license: "CC-BY-SA-4.0",
    tour: false, lat: NYC.lat + dNorth / 110_540, lon: NYC.lon + dEast / (111_320 * Math.cos(NYC.lat * Math.PI / 180)),
    heading: 0, fov: 70, next: null, prev: null, ...(serie ? { serie } : {}), ...extra,
  };
}

describe("décor direct · ce que montre la vue", () => {
  const square = (cx: number, cz: number, r: number): [number, number][] => [[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r], [cx - r, cz - r]];

  it("tags the large park, not a small sanctuary inside it that happens to be nearer", () => {
    const c = lireContexte({
      place: { name: "New York City Center", detail: "New York, New York, United States" },
      camera: { x: 0, z: 0, heading: 0, pitch: 2, fov: 62, height: 1.7 },
      areas: [
        { outer: [[-500, -250], [0, -250], [500, -250], [500, -1200], [-500, -1200], [-500, -250]], kind: "park", name: "Central Park" },
        { outer: square(20, -260, 40), kind: "park", name: "Hallett Nature Sanctuary" },
      ],
      buildings: [],
    });
    assert.deepEqual(c.zones.map(z => z.name).sort(), ["Central Park", "Hallett Nature Sanctuary"]);
    assert.deepEqual(tagsContexte(c).find(tag => tag.kind === "zone"), { kind: "zone", text: "Central Park" });
  });

  it("reads named parks in the frame, their side, and the skyline; ignores what is behind the camera", () => {
    // Camera looks north (-z). Central Park ahead, a park behind, towers ahead.
    const c = lireContexte({
      place: { name: "New York City Center", detail: "New York, New York, United States" },
      camera: { x: 0, z: 0, heading: 0, pitch: 2, fov: 62, height: 1.7 },
      areas: [
        { outer: square(0, -400, 150), kind: "park", name: "Central Park" },
        { outer: square(0, 400, 100), kind: "park", name: "Behind Park" },
        { outer: square(300, -300, 60), kind: "water" },
      ],
      buildings: [{ outer: square(-40, -120, 10), height: 240 }, { outer: square(40, -150, 10), height: 60 }, { outer: square(0, 200, 10), height: 400 }],
      sun: { azimuth: 180, altitude: 35 },
    });
    assert.deepEqual(c.zones.map(z => [z.name, z.cote]), [["Central Park", "face"]]);
    assert.ok(c.kinds.includes("park") && c.kinds.includes("water"));
    assert.equal(c.tallest, 240);
    assert.equal(c.silhouette, "tours");
    assert.equal(c.city, "New York");
    assert.equal(c.country, "United States");
    assert.deepEqual(tagsContexte(c), [{ kind: "ville", text: "New York" }, { kind: "zone", text: "Central Park" }, { kind: "silhouette", key: "tours" }]);
    const lines = lignesContexte(c).join("\n");
    assert.match(lines, /New York City Center, New York, United States/);
    assert.match(lines, /street level, at a person's eye height/);
    assert.match(lines, /never raise, lower or move the camera/);
    assert.match(lines, /looking north/);
    assert.match(lines, /Central Park \(park\) ahead/);
    assert.match(lines, /skyscrapers up to about 240 m/);
    assert.match(lines, /Sunlight from the south/);
    assert.doesNotMatch(lines, /Behind Park/);
  });

  it("splits Photon's detail line without repeats", () => {
    assert.deepEqual(villePays("Place Saint-François", "Lausanne, Vaud, Suisse"), { city: "Lausanne", country: "Suisse" });
    assert.deepEqual(villePays("Lausanne", "Lausanne, Vaud, Suisse"), { city: "Vaud", country: "Suisse" });
    assert.deepEqual(villePays("X", ""), { city: "", country: "" });
  });

  it("says the camera height when the view is not at street level", () => {
    const c = lireContexte({ place: { name: "Lausanne" }, camera: { x: 0, z: 0, heading: 90, pitch: -30, fov: 45, height: 120 }, areas: [], buildings: [] });
    assert.match(lignesContexte(c).join(" "), /about 120 m above the ground, looking east, \d+ mm lens, tilted 30° down/);
    assert.equal(c.silhouette, "aucun");
  });
});

describe("préciser avec des photos · recherche sur la zone visible", () => {
  it("asks Panoramax and Mapillary for an area, 360° only when asked", () => {
    const box = zoneVue({ ...NYC, heading: 0, fov: 90 });
    assert.ok(box[3] - NYC.lat > 350 / 110_540, "the wedge reaches north");
    assert.ok(NYC.lat - box[1] < 130 / 110_540, "and only ±120 m behind");
    const url = new URL(panoramaxBboxUrl(box, 500));
    assert.equal(url.searchParams.get("limit"), "100");
    assert.equal(url.searchParams.get("place_position"), null);
    assert.equal(url.searchParams.get("filter"), null);
    assert.equal(new URL(panoramaxBboxUrl(box, 20, true)).searchParams.get("filter"), "field_of_view=360");
    const mly = new URL(mapillaryBboxUrl(box));
    assert.match(mly.searchParams.get("fields") ?? "", /is_pano/);
    assert.match(mly.searchParams.get("fields") ?? "", /sequence/);
    assert.equal(MAPILLARY_ATTRIBUTION, "© Mapillary contributors, CC BY-SA");
  });

  it("keeps one photo per spot and per series first: no twelve shots of one statue", () => {
    const statue = Array.from({ length: 10 }, (_, i) => photo(`s${i}`, 290 + i, 2, "pmx:statue"));
    const walk = Array.from({ length: 8 }, (_, i) => photo(`w${i}`, 40 + i * 50, -20, "pmx:walk"));
    const others = [photo("o1", 120, 60, "pmx:a"), photo("o2", 200, -80, "pmx:b"), photo("back", -100, 0, "pmx:c")];
    const out = diversifier([...statue, ...walk, ...others, statue[0]], { ...NYC, heading: 0, fov: 90 }, 12);
    assert.equal(new Set(out.map(p => p.id)).size, out.length, "no duplicate");
    assert.equal(out.filter(p => p.serie === "pmx:statue").length, 1);
    assert.ok(out.filter(p => p.serie === "pmx:walk").length >= 3, "a long walk still gives several spots");
    assert.ok(out.length <= 12);
    assert.notEqual(out[0].id, "back", "photos in the view come first");
  });

  it("finds the 360° sphere at the camera's spot, never one far away", () => {
    const near = photo("p1", 30, 10, "pmx:p", { tour: true, fov: 360 });
    const far = photo("p2", 400, 0, "pmx:q", { tour: true, fov: 360 });
    assert.equal(pano360([far, near, photo("f", 5, 5)], NYC.lat, NYC.lon)?.id, "p1");
    assert.equal(pano360([far], NYC.lat, NYC.lon), null);
    assert.equal(dansLaVue({ ...NYC, heading: 0, fov: 60 }, photo("x", -200, 0)), false);
  });

  it("reads the Panoramax series and the Mapillary sequence and sphere flag", () => {
    const pmx = parsePanoramax({ features: [{ id: "12345678-1234-1234-1234-123456789abc", collection: "abcdefab-1234-1234-1234-123456789abc", geometry: { coordinates: [NYC.lon, NYC.lat] }, properties: { license: "CC-BY-SA-4.0", "geovisio:producer": "Ada" }, assets: { sd: { href: "https://panoramax.xyz/a.jpg" } } }] });
    assert.equal(pmx[0].serie, "pmx:abcdefab-1234-1234-1234-123456789abc");
    const mly = parseMapillary({ data: [{ id: "123", thumb_256_url: "https://scontent.fbcdn.net/a.jpg", thumb_2048_url: "https://scontent.fbcdn.net/b.jpg", geometry: { coordinates: [NYC.lon, NYC.lat] }, is_pano: true, sequence: "seqA", creator: { username: "bo" } }] }, 100);
    const p = mapillaryPhoto(mly[0]);
    assert.equal(p.tour, true);
    assert.equal(p.view, "https://scontent.fbcdn.net/b.jpg");
    assert.equal(p.serie, "mly:seqA");
    assert.equal(p.license, "CC-BY-SA-4.0");
  });
});
