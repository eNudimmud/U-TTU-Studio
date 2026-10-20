import test from "node:test";
import assert from "node:assert/strict";
import { routeStudioIntent } from "../src/lib/agent/intent.ts";

test("routes French cutout requests", () => {
  assert.equal(routeStudioIntent("Détoure cette image"), "suite-detourer");
  assert.equal(routeStudioIntent("Enlève le fond"), "suite-detourer");
  assert.equal(routeStudioIntent("Supprimer l'arrière-plan"), "suite-detourer");
});
test("routes English cutout requests", () => {
  assert.equal(routeStudioIntent("Remove the background"), "suite-detourer");
  assert.equal(routeStudioIntent("Cut out this image"), "suite-detourer");
});
test("does not claim unsupported intents", () => {
  assert.equal(routeStudioIntent("Fais une vidéo de 10 secondes"), "unrecognized");
  assert.equal(routeStudioIntent(""), "unrecognized");
});
