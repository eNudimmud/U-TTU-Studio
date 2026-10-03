import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import manifest from "../src/app/manifest.ts";
import { clerkPath } from "../src/lib/clerk-config.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("le studio comme une app", () => {
  it("shows one chain, a credit chip, and everything else to the side", () => {
    const shell = read("src/components/studio/shell.tsx");
    assert.match(shell, /cinema-nav/);
    assert.match(shell, /<CreditChip \/>/);
    assert.match(shell, /pick\("sphere"\)/);
    assert.match(shell, /aria-label="Autres espaces"/);
    assert.match(shell, />Plus</);
    assert.match(shell, /Rien à payer/);
    assert.doesNotMatch(shell, /cinema-name|studio-footer|CINEMA_PATH|THE BLOC/);
    assert.match(shell, /PLATEAU_EVENT/);
    assert.match(read("src/components/studio/plateau-panel.tsx"), /dispatchEvent\(new Event\(PLATEAU_EVENT\)\)/);
  });

  it("holds the look on one card with one primary action", () => {
    const card = read("src/components/studio/look-card.tsx");
    assert.match(card, /Noté dans CANON\.md/);
    assert.match(card, /button button-primary look-next" disabled=\{!held\}/);
    assert.match(card, /goStep\("plateau"\)/);
    const create = read("src/components/studio/create-view.tsx");
    assert.match(create, /<LookCard /);
    assert.match(create, /Aller plus loin/);
    assert.match(create, /canonToggle=\{false\}/);
    assert.ok(create.indexOf("<LookCard") < create.indexOf("<PreparePanel"), "the dataset path comes after the look");
  });

  it("puts the shelf and the post surface in Sphère, and the post in La prise", () => {
    const sphere = read("src/components/studio/sphere-panel.tsx");
    assert.match(sphere, /<PostTake /);
    assert.ok(sphere.indexOf("<PostTake") < sphere.indexOf("<summary>Autres gestes</summary>"));
    const take = read("src/components/studio/take-panel.tsx");
    assert.match(take, /<PostTake line=\{note\.line\}/);
    assert.match(read("src/components/studio/take-frame.tsx"), /<TakeCost \/>/);
  });

  it("names the missing secret instead of faking a studio balance", () => {
    const meter = read("src/components/studio/credit-meter.tsx");
    assert.match(meter, /disabled aria-describedby="credit-off-note"/);
    assert.match(meter, /FAL_ADMIN_KEY/);
    assert.doesNotMatch(meter, /fetch\(|localStorage\.setItem|document\.cookie/);
    assert.doesNotMatch(read("src/lib/credit-store.ts"), /fetch\(|document\.cookie|sessionStorage/);
  });

  it("loads the account provider only on the account surfaces", () => {
    assert.doesNotMatch(read("src/app/layout.tsx"), /ClerkProvider|@clerk\//);
    const scope = read("src/components/account/clerk-scope.tsx");
    assert.match(scope, /telemetry=\{false\}/);
    assert.match(read("src/components/studio/account-panel.tsx"), /<ClerkScope><AccountSession \/><\/ClerkScope>/);
    assert.match(read("src/app/sign-in/[[...sign-in]]/page.tsx"), /<ClerkScope>/);
    assert.match(read("src/app/sign-up/[[...sign-up]]/page.tsx"), /<ClerkScope>/);
    assert.match(read("src/proxy.ts"), /!clerkPath\(request\.nextUrl\.pathname\)/);
    for (const path of ["/sign-in", "/sign-in/sso-callback", "/sign-up", "/sign-up/verify"]) assert.equal(clerkPath(path), true, path);
    for (const path of ["/", "/studio", "/sign-inx", "/comfy-embed", "/api/view"]) assert.equal(clerkPath(path), false, path);
  });

  it("installs on Ton style, standalone", () => {
    const app = manifest();
    assert.equal(app.display, "standalone");
    assert.equal(app.start_url, "/studio?step=look");
    assert.equal(app.theme_color, "#0A0A0B");
    assert.equal(app.lang, "fr-CH");
  });
});
