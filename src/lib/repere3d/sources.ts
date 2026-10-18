// Where every pixel of the 3D repérage comes from, and the credit it owes.
// No Google data anywhere: the Google Maps Platform terms forbid capture and AI use
// (docs: /workspace/concours/STREETVIEW-CONDITIONS.md, copied in docs/reperage-3d.md).

export type SourceId = "osm" | "openfreemap" | "terrain" | "swisstopo" | "swissbuildings";

export interface SourceInfo {
  id: SourceId;
  short: string;
  licence: string;
  url: string;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  osm: {
    id: "osm",
    short: "© contributeurs OpenStreetMap",
    licence: "ODbL 1.0",
    url: "https://www.openstreetmap.org/copyright",
  },
  openfreemap: {
    id: "openfreemap",
    short: "OpenFreeMap · © OpenMapTiles",
    licence: "tuiles : BSD-3 / CC-BY 4.0 (schéma OpenMapTiles)",
    url: "https://openfreemap.org",
  },
  terrain: {
    id: "terrain",
    short: "Relief : Terrain Tiles (Mapzen, AWS Open Data)",
    licence: "sources ouvertes : USGS SRTM / GMTED / 3DEP, Copernicus EU-DEM, NOAA ETOPO1 et autres",
    url: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
  },
  swisstopo: {
    id: "swisstopo",
    short: "© swisstopo",
    licence: "OGD swisstopo (usage libre, source obligatoire)",
    url: "https://www.swisstopo.admin.ch/fr/conditions-utilisation-geodonnees-et-geoservices-gratuit",
  },
  swissbuildings: {
    id: "swissbuildings",
    short: "Bâtiments : swissBUILDINGS3D © swisstopo",
    licence: "OGD swisstopo (usage libre, source obligatoire)",
    url: "https://www.swisstopo.admin.ch/fr/modele-du-territoire-swissbuildings3d-2-0",
  },
};

export const SOURCE_ORDER: readonly SourceId[] = ["osm", "openfreemap", "terrain", "swisstopo", "swissbuildings"];

/** Full Terrain Tiles credit, as required by tilezen/joerd docs/attribution.md (hosted service). */
export const TERRAIN_FULL = [
  "Mapzen",
  "ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736",
  "Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017",
  "Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich",
  "Canada terrain data contains information licensed under the Open Government Licence – Canada",
  "Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers",
  "Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration",
  "Mexico terrain data source: INEGI, Continental relief, 2016",
  "New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved)",
  "Norway terrain data © Kartverket",
  "United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved",
  "United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey",
] as const;

function ordered(sources: Iterable<SourceId>): SourceId[] {
  const set = new Set(sources);
  return SOURCE_ORDER.filter(id => set.has(id));
}

/** One short line, always shown on the view. OSM is always first. */
export function attributionLine(sources: Iterable<SourceId>): string {
  const list = ordered(["osm", ...sources]);
  return list.map(id => SOURCES[id].short).join(" · ");
}

/** The string stored with a capture: credits, licences and where to read them. */
export function attributionFull(sources: Iterable<SourceId>): string {
  const list = ordered(["osm", ...sources]);
  return list.map(id => `${SOURCES[id].short} (${SOURCES[id].licence}) ${SOURCES[id].url}`).join(" · ");
}
