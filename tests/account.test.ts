import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ACCOUNT_CREER_HASH, ACCOUNT_HOME_HASH, ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH, ACCOUNT_VAULT_LINKS, CLERK_OAUTH_PROVIDERS,
} from "../src/lib/account.ts";
import { clerkClientEnabled, hasClerkKeys } from "../src/lib/clerk-config.ts";
import { processesForMode } from "../src/lib/processes.ts";
import { VAULT_DOCUMENTS, VAULT_FOLDERS } from "../src/lib/vault.ts";

describe("compte et coffre", () => {
  it("points at every canon place, and at no cloud job", () => {
    assert.deepEqual(ACCOUNT_VAULT_LINKS.map(link => link.label), [
      ...VAULT_FOLDERS.map(folder => `${folder.name}/`),
      ...VAULT_DOCUMENTS.map(doc => doc.name),
    ]);
    for (const link of ACCOUNT_VAULT_LINKS) assert.equal(link.href, "#studio");
    assert.deepEqual([...CLERK_OAUTH_PROVIDERS], ["google", "github"]);
    assert.equal(processesForMode("compte").length, 0);
    assert.equal(ACCOUNT_SIGN_IN_PATH, "/sign-in");
    assert.equal(ACCOUNT_SIGN_UP_PATH, "/sign-up");
    assert.equal(ACCOUNT_HOME_HASH, "/#compte");
    assert.equal(ACCOUNT_CREER_HASH, "/#creer");
  });

  it("keeps the signed-in skeleton in the panel, without a network call of its own", () => {
    const text = readFileSync("src/components/studio/account-panel.tsx", "utf8");
    assert.match(text, /Se connecter/);
    assert.match(text, /Créer un compte/);
    assert.match(text, /Tes runs/);
    assert.match(text, /Ton studio cloud/);
    assert.match(text, /UserButton/);
    assert.match(text, /sans compte/);
    assert.doesNotMatch(text, /fetch\(|XMLHttpRequest|stripe|fal\.ai/i);
  });
});

describe("clerk keys", () => {
  it("requires both keys before the proxy will call Clerk", () => {
    assert.equal(hasClerkKeys(undefined, undefined), false);
    assert.equal(hasClerkKeys("pk", ""), false);
    assert.equal(hasClerkKeys("  ", "sk"), false);
    assert.equal(hasClerkKeys("", "sk"), false);
    assert.equal(hasClerkKeys(" pk ", " sk "), true);
  });

  it("reads only the publishable key on the client gate", () => {
    const previous = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "";
    assert.equal(clerkClientEnabled(), false);
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    assert.equal(clerkClientEnabled(), true);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
  });
});

describe("hosting path", () => {
  it("does not protect routes and does not static-export", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    assert.doesNotMatch(proxy, /\.protect\(|protect\(/);
    assert.match(proxy, /hasClerkKeys/);
    assert.match(proxy, /clerkMiddleware/);
    const config = readFileSync("next.config.mjs", "utf8");
    assert.doesNotMatch(config, /output:\s*["']export["']/);
    assert.match(config, /NEXT_PUBLIC_CLERK_KEYLESS_DISABLED/);
    const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
    assert.doesNotMatch(workflow, /deploy-pages/);
    assert.doesNotMatch(workflow, /GITHUB_PAGES:\s*["']true["']/);
    const creer = readFileSync("src/components/studio/create-view.tsx", "utf8");
    assert.doesNotMatch(creer, /@clerk\/nextjs|\/sign-in/);
  });
});
