import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FalPrice } from "../src/lib/fal/client.ts";
import { FAL_PUBLISHED, loraTakeQuote, trainingQuote } from "../src/lib/fal/prices.ts";

const trainer: FalPrice = { endpointId: "minimax/h3/ref2va/trainer", unitPrice: FAL_PUBLISHED.trainerPerStep, unit: "steps", currency: "USD" };
const take: FalPrice = { endpointId: "minimax/h3/reference-to-video/lora", unitPrice: FAL_PUBLISHED.takePerSecond["480P"], unit: "seconds", currency: "USD" };

describe("prix fal, avant le geste", () => {
  it("quotes a training from the live step price, with fal's 100-step floor", () => {
    assert.equal(trainingQuote(trainer, 1000), 15);
    assert.equal(trainingQuote(trainer, 2000), 30);
    assert.equal(trainingQuote(trainer, 40), 1.5);
    assert.equal(trainingQuote({ ...trainer, unit: "1000 steps" }, 2000), 0.03);
  });

  it("quotes a take from the 480p second price, scaled to 768p", () => {
    assert.equal(loraTakeQuote(take, 5, "480P"), 0.32);
    assert.equal(loraTakeQuote(take, 5, "768P"), 0.38);
    assert.equal(loraTakeQuote(take, 8, "768P"), 0.6);
  });

  it("quotes nothing when the unit or the currency is not the one fal bills", () => {
    assert.equal(trainingQuote({ ...trainer, unit: "images" }, 1000), null);
    assert.equal(trainingQuote({ ...trainer, currency: "EUR" }, 1000), null);
    assert.equal(trainingQuote(null, 1000), null);
    assert.equal(loraTakeQuote({ ...take, unit: "video" }, 5, "768P"), null);
    assert.equal(loraTakeQuote({ ...take, unitPrice: 0 }, 5, "480P"), null);
  });
});
