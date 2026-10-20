import test from "node:test";
import assert from "node:assert/strict";
import { studioProductionMap } from "../src/lib/agent/studio-map.ts";
import { OUTILS } from "../src/lib/outils/catalogue.ts";
import { REGISTRE } from "../src/lib/workflows/registre.ts";

test("agent map covers every tool and every production gesture", () => {
  const operations = studioProductionMap();
  for (const tool of OUTILS) assert.ok(operations.some(op => op.id === `tool:${tool.id}`), tool.id);
  for (const gesture of REGISTRE.filter(g => ["cast", "decor", "prise", "montage"].includes(g.onglet)))
    assert.ok(operations.some(op => op.id === `gesture:${gesture.id}`), gesture.id);
  for (const area of ["cast", "decor", "prise", "montage", "outils"])
    assert.ok(operations.some(op => op.area === area), area);
});
test("agent map does not grant execution to unwired tools", () => {
  const operations = studioProductionMap();
  for (const tool of OUTILS.filter(tool => Boolean(tool.bientot))) {
    const operation = operations.find(op => op.id === `tool:${tool.id}`);
    assert.equal(operation?.status, "disabled", tool.id);
    assert.equal(operation?.quote, undefined, tool.id);
  }
});
