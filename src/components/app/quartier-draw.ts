// Shared block: extruded buildings, street ribbons, a relief mesh. Meters, east +x, south +z.

import { sampleRelief, type Quartier } from "@/lib/repere/quartier";

type ThreeNS = typeof import("three");

export interface QuartierDraw {
  group: import("three").Group;
  stand: import("three").Mesh;
  dispose(): void;
}

export function drawQuartier(THREE: ThreeNS, quartier: Quartier): QuartierDraw {
  const group = new THREE.Group();
  group.name = "quartier";
  const geometries: { dispose(): void }[] = [];
  const materials: { dispose(): void }[] = [];
  const tones = [0xc4a574, 0x8d6b45, 0xe0c48a, 0x6e5338, 0xb8926a, 0x4e3b2a].map(color => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
    materials.push(material);
    return material;
  });
  const road = new THREE.MeshStandardMaterial({ color: 0x6e675c, roughness: 0.9 });
  const earth = new THREE.MeshStandardMaterial({ color: 0x5c4e3a, roughness: 1 });
  const gold = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
  materials.push(road, earth, gold);

  if (quartier.relief && quartier.relief.n >= 2) {
    const { n, span } = quartier.relief;
    const geo = new THREE.PlaneGeometry(span, span, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let index = 0; index < pos.count; index += 1) {
      pos.setY(index, sampleRelief(quartier.relief, pos.getX(index), pos.getZ(index)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geometries.push(geo);
    group.add(new THREE.Mesh(geo, earth));
  }

  for (const street of quartier.streets) {
    for (let index = 0; index < street.points.length - 1; index += 1) {
      const [ax, az] = street.points[index];
      const [bx, bz] = street.points[index + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      if (length < 0.4) continue;
      const midX = (ax + bx) / 2;
      const midZ = (az + bz) / 2;
      const geo = new THREE.BoxGeometry(length, 0.12, Math.max(2, street.width));
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, road);
      mesh.position.set(midX, sampleRelief(quartier.relief, midX, midZ) + 0.08, midZ);
      mesh.rotation.y = Math.atan2(-dz, dx);
      group.add(mesh);
    }
  }

  quartier.buildings.forEach((building, buildingIndex) => {
    if (building.ring.length < 3 || !(building.height > 0)) return;
    const shape = new THREE.Shape();
    building.ring.forEach(([x, z], index) => {
      if (index === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    try {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, tones[buildingIndex % tones.length]);
      const [cx, cz] = centroid(building.ring);
      mesh.position.y = sampleRelief(quartier.relief, cx, cz);
      group.add(mesh);
    } catch {
      // A broken ring is skipped. The rest of the block still stands.
    }
  });

  const standGeo = new THREE.RingGeometry(0.55, 0.85, 24);
  geometries.push(standGeo);
  const stand = new THREE.Mesh(standGeo, gold);
  stand.name = "stand";
  stand.rotation.x = -Math.PI / 2;
  const y = sampleRelief(quartier.relief, quartier.stand.x, quartier.stand.z);
  stand.position.set(quartier.stand.x, y + 0.2, quartier.stand.z);
  group.add(stand);

  return {
    group,
    stand,
    dispose() {
      group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

function centroid(ring: readonly [number, number][]): [number, number] {
  const x = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
  const z = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
  return [x, z];
}
