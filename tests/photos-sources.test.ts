import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auteurCommons, commonsGeoUrl, commonsInfoUrl, COMMONS_AGENT, licenceCommons, motBruit, parseCommonsInfo, parseGeosearch, preselection, sphereCommons, vueDuLieu,
} from "../src/lib/repere/commons.ts";
import { kartaviewUrl, parseKartaview } from "../src/lib/repere/kartaview.ts";
import { creditRue, diversifier, KARTAVIEW_CREDIT, pano360, type PhotoRue, type PhotoSource } from "../src/lib/repere/panoramax.ts";

const LAU = { lat: 46.5197, lon: 6.6335 };
const north = (m: number) => m / 110_540;
const east = (m: number) => m / (111_320 * Math.cos(LAU.lat * Math.PI / 180));

function photo(id: string, source: PhotoSource, dNorth: number, dEast: number, extra: Partial<PhotoRue> = {}): PhotoRue {
  return {
    id, author: "Ada", thumb: "https://example.org/t.jpg", view: "https://example.org/v.jpg", source, license: "CC-BY-SA-4.0", tour: false,
    lat: LAU.lat + north(dNorth), lon: LAU.lon + east(dEast), heading: 0, fov: 70, next: null, prev: null, ...extra,
  };
}

const street = { title: "File:Rue de Bourg, Lausanne.jpg", mime: "image/jpeg", width: 4000, height: 3000, text: "Streets in Lausanne|Rue de Bourg", year: 2019 };

describe("photos · filtre Wikimedia Commons", () => {
  it("keeps an outdoor street view", () => {
    assert.equal(vueDuLieu(street), true);
  });

  for (const [what, text] of [
    ["an interior", "Interior of Église Saint-François (Lausanne)"],
    ["a zoo animal", "Central Park Zoo|Sea lions"],
    ["a portrait", "Portrait photographs of men|Joël Dicker"],
    ["a meeting", "Secretary Kerry Meets with UN Special Envoy"],
    ["a map", "Maps of Lausanne"],
    ["a logo", "Logos of companies"],
    ["a painting", "Paintings in the Musée cantonal"],
    ["a document", "Documents|Letters"],
    ["a car close-up", "1997 Ford automobiles"],
    ["fruit on a stall", "Apricots|Strawberries in Switzerland"],
    ["an elevator", "Elevators in Lausanne"],
    ["an old picture", "Black and white photographs of Lausanne"],
    ["a street sign", "100elles|Rue de la Confédération (Geneva)"],
  ] as const) {
    it(`drops ${what}`, () => {
      assert.ok(motBruit(text), text);
      assert.equal(vueDuLieu({ ...street, text }), false);
    });
  }

  it("drops non-photos, tiny files, odd shapes and old shots", () => {
    assert.equal(vueDuLieu({ ...street, mime: "image/png" }), false);
    assert.equal(vueDuLieu({ ...street, mime: "image/svg+xml" }), false);
    assert.equal(vueDuLieu({ ...street, width: 500, height: 300 }), false);
    assert.equal(vueDuLieu({ ...street, width: 6000, height: 1200 }), false);
    assert.equal(vueDuLieu({ ...street, year: 1962 }), false);
  });

  it("reads licences and authors without HTML", () => {
    assert.equal(licenceCommons("CC BY-SA 4.0"), "CC-BY-SA-4.0");
    assert.equal(licenceCommons("CC BY 2.0"), "CC-BY-2.0");
    assert.equal(licenceCommons("CC BY-SA 3.0 de"), "CC-BY-SA-3.0");
    assert.equal(licenceCommons("CC0"), "CC0-1.0");
    assert.equal(licenceCommons("Public domain"), "PD");
    assert.equal(licenceCommons("CC BY-NC 2.0"), null);
    assert.equal(licenceCommons("GFDL"), null);
    assert.equal(auteurCommons('<a href="//commons.wikimedia.org/wiki/User:Nfriedli">Nfriedli</a>'), "Nfriedli");
    assert.equal(auteurCommons('<a href="/wiki/User:A">Americasroof</a> ( <a href="/wiki/User_talk:A">talk</a> ).'), "Americasroof");
    assert.equal(auteurCommons("Unknown author"), "");
    assert.equal(auteurCommons("User:Erdrokan"), "Erdrokan");
    assert.equal(auteurCommons('<a href="//commons.wikimedia.org/wiki/User:Erdrokan">User:Erdrokan</a>'), "Erdrokan");
  });

  it("asks Commons politely: 250 m, files only, open CORS, 50 ids at most", () => {
    const geo = new URL(commonsGeoUrl(LAU.lat, LAU.lon));
    assert.equal(geo.searchParams.get("gsradius"), "250");
    assert.equal(geo.searchParams.get("gsnamespace"), "6");
    assert.equal(geo.searchParams.get("origin"), "*");
    const info = new URL(commonsInfoUrl(Array.from({ length: 80 }, (_, i) => i + 1)));
    assert.equal(info.searchParams.get("pageids")!.split("|").length, 50);
    assert.equal(info.searchParams.get("origin"), "*");
    assert.match(COMMONS_AGENT, /^U\*TTU Studio \(github\.com\/eNudimmud\/U-TTU-Studio\)$/);
  });

  it("drops duplicate points and spreads the preselection over the area", () => {
    const rows = [
      { pageid: 1, title: "File:A.jpg", lat: LAU.lat, lon: LAU.lon, dist: 0 },
      { pageid: 1, title: "File:A.jpg", lat: LAU.lat, lon: LAU.lon, dist: 0 },
      ...Array.from({ length: 5 }, (_, i) => ({ pageid: 10 + i, title: `File:Same spot ${i}.jpg`, lat: LAU.lat + north(2), lon: LAU.lon + east(2), dist: 3 })),
      { pageid: 30, title: "File:Far.jpg", lat: LAU.lat + north(150), lon: LAU.lon, dist: 150 },
      { pageid: 31, title: "File:Zoo animals.jpg", lat: LAU.lat + north(100), lon: LAU.lon, dist: 100 },
      { pageid: 32, title: "File:Plan.svg", lat: LAU.lat + north(120), lon: LAU.lon, dist: 120 },
    ];
    const points = parseGeosearch({ query: { geosearch: rows } });
    assert.equal(points.filter(p => p.pageid === 1).length, 1);
    const picked = preselection(points, LAU.lat, LAU.lon, 3).map(p => p.pageid);
    assert.equal(picked.length, 3);
    assert.ok(picked.includes(30), "the far spot comes before a third shot of the same spot");
    assert.ok(!picked.includes(31) && !picked.includes(32));
  });

  it("turns imageinfo into credited photos, with the file page as source", () => {
    const point = { pageid: 72, title: "File:Place Saint-François.jpg", lat: LAU.lat, lon: LAU.lon, dist: 0 };
    const page = (pageid: number, title: string, extra: Record<string, unknown> = {}, meta: Record<string, string> = {}) => ({
      pageid, title, imageinfo: [{
        width: 4000, height: 3000, mime: "image/jpeg",
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/960px-X.jpg`,
        url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg",
        descriptionurl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, "_")}`,
        extmetadata: Object.fromEntries(Object.entries({ LicenseShortName: "CC BY-SA 4.0", Artist: "<b>Nfriedli</b>", Categories: "Place Saint-François (Lausanne)", ...meta })
          .map(([k, v]) => [k, { value: v }])),
        ...extra,
      }],
    });
    const points = new Map([[72, point], [73, { ...point, pageid: 73, title: "File:Nave.jpg" }], [74, { ...point, pageid: 74, title: "File:B.jpg" }]]);
    const out = parseCommonsInfo({ query: { pages: [
      page(72, point.title),
      page(73, "File:Nave.jpg", {}, { Categories: "Interior of Église Saint-François" }),
      page(74, "File:B.jpg", {}, { LicenseShortName: "CC BY-NC 2.0" }),
    ] } }, points);
    assert.equal(out.length, 1);
    const p = out[0];
    assert.equal(p.id, "wmc-72");
    assert.equal(p.source, "commons");
    assert.equal(p.author, "Nfriedli");
    assert.equal(p.license, "CC-BY-SA-4.0");
    assert.match(p.thumb, /\/500px-X\.jpg$/);
    assert.match(p.view, /\/960px-X\.jpg$/);
    assert.equal(p.sourceUrl, "https://commons.wikimedia.org/wiki/File:Place_Saint-François.jpg");
    assert.equal(creditRue(p), "Nfriedli · CC BY-SA 4.0 · Wikimedia Commons");
  });

  it("refuses pictures served from anywhere but Wikimedia", () => {
    const point = { pageid: 9, title: "File:A.jpg", lat: LAU.lat, lon: LAU.lon, dist: 0 };
    const out = parseCommonsInfo({ query: { pages: [{ pageid: 9, imageinfo: [{
      width: 4000, height: 3000, mime: "image/jpeg", thumburl: "https://evil.example/960px-A.jpg", url: "https://evil.example/A.jpg",
      extmetadata: { LicenseShortName: { value: "CC0" }, Artist: { value: "Bob" } },
    }] }] } }, new Map([[9, point]]));
    assert.deepEqual(out, []);
  });
});

describe("photos · KartaView", () => {
  const row = (id: number, dNorth: number, extra: Record<string, unknown> = {}) => ({
    id: String(id), sequenceId: "77", sequenceIndex: String(id), lat: String(LAU.lat + north(dNorth)), lng: String(LAU.lon), heading: "90",
    width: "1920", height: "1080", projection: "PLANE", fieldOfView: "0",
    fileurlLTh: `https://storage9.openstreetcam.org/files/photo/lth/${id}.jpg`, fileurlProc: `https://storage9.openstreetcam.org/files/photo/proc/${id}.jpg`, ...extra,
  });

  it("only trusts apiCode 600, even on a 200", () => {
    assert.deepEqual(parseKartaview({ status: { apiCode: 401 }, result: { data: [row(1, 0)] } }, LAU.lat, LAU.lon), []);
    assert.deepEqual(parseKartaview(null, LAU.lat, LAU.lon), []);
  });

  it("keeps photos inside the radius, credited, with a 2:1 frame taken as a sphere", () => {
    const out = parseKartaview({ status: { apiCode: 600 }, result: { data: [
      row(1, 10), row(2, 400), row(3, 20, { width: "5376", height: "2688" }), row(4, 30, { fileurlLTh: "https://evil.example/x.jpg" }),
    ] } }, LAU.lat, LAU.lon, 250);
    assert.deepEqual(out.map(p => p.id), ["kv-1", "kv-3"]);
    assert.equal(out[0].tour, false);
    assert.equal(out[1].tour, true);
    assert.match(out[1].view, /\/proc\/3\.jpg$/);
    assert.equal(out[0].serie, "kv:77");
    assert.equal(creditRue(out[0]), KARTAVIEW_CREDIT);
    assert.equal(KARTAVIEW_CREDIT, "© KartaView contributors, CC BY-SA 4.0");
  });

  it("asks within the radius", () => {
    const url = new URL(kartaviewUrl(LAU.lat, LAU.lon, 250));
    assert.equal(url.searchParams.get("radius"), "250");
  });
});

describe("photos · mélange des sources", () => {
  const view = { lat: LAU.lat, lon: LAU.lon, heading: 0, fov: 90 };

  it("lets every source take turns instead of one filling the grid", () => {
    const many = Array.from({ length: 10 }, (_, i) => photo(`wmc-${i}`, "commons", 20 + i * 45, 0, { serie: `wmc:a${i}` }));
    const pmx = Array.from({ length: 3 }, (_, i) => photo(`px-${i}`, "panoramax", 25 + i * 45, 45, { serie: `px:${i}` }));
    const kv = [photo("kv-1", "kartaview", 30, -45, { serie: "kv:1" })];
    const out = diversifier([...many, ...pmx, ...kv], view, 6);
    const count = (s: PhotoSource) => out.filter(p => p.source === s).length;
    assert.equal(out.length, 6);
    assert.equal(count("panoramax"), 3);
    assert.equal(count("kartaview"), 1);
    assert.equal(count("commons"), 2);
  });

  it("keeps one source alone working as before", () => {
    const pmx = Array.from({ length: 5 }, (_, i) => photo(`px-${i}`, "panoramax", 20 + i * 45, 0, { serie: `px:${i}` }));
    assert.deepEqual(diversifier(pmx, view, 12).map(p => p.id), pmx.map(p => p.id));
  });

  it("offers the nearest sphere of any source, up to 250 m when asked", () => {
    const sphere = photo("kv-9", "kartaview", 150, 0, { tour: true });
    assert.equal(pano360([sphere], LAU.lat, LAU.lon), null);
    assert.equal(pano360([sphere], LAU.lat, LAU.lon, 250)?.id, "kv-9");
  });

  it("credits each source its own way", () => {
    assert.equal(creditRue(photo("a", "panoramax", 0, 0, { author: "jo2sm" })), "© jo2sm, Panoramax, CC-BY-SA-4.0");
    assert.equal(creditRue(photo("b", "commons", 0, 0, { author: "Benoît Prieur", license: "CC0-1.0" })), "Benoît Prieur · CC0 · Wikimedia Commons");
    assert.equal(creditRue(photo("c", "commons", 0, 0, { author: "Jim", license: "PD" })), "Jim · Public domain · Wikimedia Commons");
    assert.equal(creditRue(photo("d", "kartaview", 0, 0)), "© KartaView contributors, CC BY-SA 4.0");
  });
});

describe("photos · sphères Commons", () => {
  it("keeps an outdoor 360° square, drops a 360° inside a church", () => {
    const outside = { width: 5376, height: 2688, text: "File:Place Saint-François 360.jpg 360° panoramas|Squares in Lausanne" };
    assert.equal(sphereCommons(outside), true);
    assert.equal(sphereCommons({ ...outside, text: "File:Espace St-François.jpg 360° panoramas|Église réformée Saint-François, Lausanne" }), false);
    assert.equal(sphereCommons({ ...outside, text: "360° panoramas|Interior of churches|Place Saint-François" }), false);
  });

  it("never shows an indoor sphere flat in the grid", () => {
    const point = { pageid: 5, title: "File:Espace St-François.jpg", lat: LAU.lat, lon: LAU.lon, dist: 0 };
    const out = parseCommonsInfo({ query: { pages: [{ pageid: 5, imageinfo: [{
      width: 5376, height: 2688, mime: "image/jpeg", url: "https://upload.wikimedia.org/a/b.jpg", thumburl: "https://upload.wikimedia.org/thumb/a/b.jpg/960px-b.jpg",
      extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" }, Artist: { value: "Nfriedli" }, Categories: { value: "360° panoramas|Église réformée Saint-François" } },
    }] }] } }, new Map([[5, point]]));
    assert.deepEqual(out, []);
  });
});
