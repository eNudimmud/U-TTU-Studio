declare module "@mapbox/vector-tile" {
  export class VectorTile {
    constructor(pbf: unknown);
    layers: Record<string, {
      length: number;
      extent: number;
      feature(index: number): {
        type: number;
        properties: Record<string, unknown>;
        loadGeometry(): { x: number; y: number }[][];
      };
    }>;
  }
}

declare module "pbf" {
  export default class Pbf {
    constructor(buffer: Uint8Array | ArrayBuffer);
  }
}
