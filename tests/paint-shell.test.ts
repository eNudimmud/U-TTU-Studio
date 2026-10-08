import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paintShell, vaultFilledCookie, VAULT_FILLED_COOKIE } from "../src/lib/paint-shell.ts";

describe("premier écran", () => {
  it("paints the empty shell before IndexedDB, and waits when a project is already stored", () => {
    assert.equal(paintShell(false, false), true);
    assert.equal(paintShell(true, false), true);
    assert.equal(paintShell(false, true), false);
    assert.equal(paintShell(true, true), true);
  });

  it("writes a cookie the next document can read", () => {
    assert.match(vaultFilledCookie(true), new RegExp(`^${VAULT_FILLED_COOKIE}=1;`));
    assert.match(vaultFilledCookie(false), new RegExp(`^${VAULT_FILLED_COOKIE}=;`));
    assert.match(vaultFilledCookie(false), /Max-Age=0/);
  });
});
