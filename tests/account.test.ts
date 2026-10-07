import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ACCOUNT_PATH, ACCOUNT_SIGN_IN_PATH, ACCOUNT_SIGN_UP_PATH, CLERK_OAUTH_PROVIDERS, STUDIO_PATH } from "../src/lib/account.ts";
import { CLERK_APP_ID, clerkClientEnabled, clerkPath, hasClerkKeys } from "../src/lib/clerk-config.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("compte facultatif, hors du studio", () => {
  it("lives on its own pages", () => {
    assert.equal(ACCOUNT_SIGN_IN_PATH, "/sign-in");
    assert.equal(ACCOUNT_SIGN_UP_PATH, "/sign-up");
    assert.equal(ACCOUNT_PATH, "/compte");
    assert.equal(STUDIO_PATH, "/studio#personnage");
    assert.deepEqual([...CLERK_OAUTH_PROVIDERS], ["google", "github"]);
    for (const path of ["/sign-in", "/sign-in/sso-callback", "/sign-up", "/compte"]) assert.equal(clerkPath(path), true, path);
    for (const path of ["/", "/studio", "/sign-inx", "/comfy-embed", "/api/view", "/login"]) assert.equal(clerkPath(path), false, path);
  });

  it("never loads Clerk on the studio or the landing", () => {
    assert.doesNotMatch(read("src/app/layout.tsx"), /ClerkProvider|@clerk\//);
    assert.doesNotMatch(read("src/app/studio/page.tsx"), /@clerk\/|ClerkScope/);
    assert.doesNotMatch(read("src/components/landing/home.tsx"), /@clerk\//);
    assert.match(read("src/components/account/clerk-scope.tsx"), /telemetry=\{false\}/);
    assert.match(read("src/app/compte/page.tsx"), /<ClerkScope><AccountPage \/><\/ClerkScope>/);
    assert.match(read("src/app/sign-in/[[...sign-in]]/page.tsx"), /<ClerkScope>/);
    assert.match(read("src/app/sign-up/[[...sign-up]]/page.tsx"), /<ClerkScope>/);
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /!clerkPath\(request\.nextUrl\.pathname\)/);
    assert.ok(proxy.indexOf("proxyComfy") < proxy.indexOf("withClerk"), "Comfy runs before Clerk");
    assert.doesNotMatch(proxy, /\.protect\(|protect\(/);
  });

  it("keeps no visitor data beyond Clerk's own optional account", () => {
    const page = read("src/components/account/account-page.tsx");
    assert.doesNotMatch(page, /fetch\(|localStorage|budget/i);
    assert.match(page, /t\("account\.title"\)/);
    assert.ok(read("messages/fr.json").includes("Le studio n’en a pas besoin."));
  });
});

describe("clés Clerk", () => {
  it("points at the existing Development application, without keys in git", () => {
    assert.equal(CLERK_APP_ID, "app_3JxoXh0l1EQ");
    const auth = read("docs/AUTH.md");
    for (const fact of [CLERK_APP_ID, "Development", "Production", "Google", "GitHub", "env pull"]) assert.ok(auth.includes(fact), fact);
    const example = read(".env.example");
    assert.match(example, new RegExp(CLERK_APP_ID));
    assert.match(example, /^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$/m);
    assert.match(example, /^CLERK_SECRET_KEY=$/m);
    assert.match(example, /^NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=\/compte$/m);
    assert.doesNotMatch(example, /pk_test_[A-Za-z0-9]|sk_test_[A-Za-z0-9]/);
  });

  it("requires both keys on the server, and only the public one in the browser", () => {
    assert.equal(hasClerkKeys(undefined, undefined), false);
    assert.equal(hasClerkKeys("pk", ""), false);
    assert.equal(hasClerkKeys("  ", "sk"), false);
    assert.equal(hasClerkKeys("", "sk"), false);
    assert.equal(hasClerkKeys(" pk ", " sk "), true);
    const previous = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "";
    assert.equal(clerkClientEnabled(), false);
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
    assert.equal(clerkClientEnabled(), true);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previous;
  });
});

describe("hébergement", () => {
  it("does not protect routes and does not static-export", () => {
    const proxy = read("src/proxy.ts");
    assert.match(proxy, /hasClerkKeys/);
    assert.match(proxy, /clerkMiddleware/);
    const config = read("next.config.mjs");
    assert.doesNotMatch(config, /output:\s*["']export["']/);
    assert.match(config, /NEXT_PUBLIC_CLERK_KEYLESS_DISABLED/);
    const workflow = read(".github/workflows/pages.yml");
    assert.doesNotMatch(workflow, /deploy-pages/);
    assert.doesNotMatch(workflow, /GITHUB_PAGES:\s*["']true["']/);
  });
});
