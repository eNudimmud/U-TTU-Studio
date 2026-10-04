import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { authDatabasePlan, reduceConnect, sheetDismissAllowed, type LinkEpoch } from "../src/lib/link-epoch.ts";

describe("une liaison qui tient", () => {
  it("keeps a newer connect when an older read fails", () => {
    const start: LinkEpoch = { epoch: 0, connected: false };
    const opened = reduceConnect(start, { type: "connect" });
    assert.equal(opened.epoch, 1);
    assert.equal(opened.connected, true);
    const late = reduceConnect(opened, { type: "read", epoch: start.epoch, ok: false });
    assert.equal(late.ignored, true);
    assert.equal(late.connected, true);
    assert.equal(late.epoch, 1);
    const second = reduceConnect(opened, { type: "read", epoch: opened.epoch, ok: true });
    assert.equal(second.ignored, false);
    assert.equal(second.connected, true);
  });

  it("lets a later read unlink only the connect it belongs to", () => {
    const linked = reduceConnect({ epoch: 2, connected: true }, { type: "read", epoch: 2, ok: false });
    assert.equal(linked.ignored, false);
    assert.equal(linked.connected, false);
  });

  it("ignores the tap that opened the sheet, then accepts a later one", () => {
    assert.equal(sheetDismissAllowed(1_000, 1_499), false);
    assert.equal(sheetDismissAllowed(1_000, 1_500), true);
  });

  it("does not open or delete a session database that is not there yet", () => {
    assert.equal(authDatabasePlan([], true), "skip");
    assert.equal(authDatabasePlan([{ name: "firebaseLocalStorageDb", version: 0 }], true), "skip");
    assert.equal(authDatabasePlan([{ name: "other", version: 2 }], true), "skip");
    assert.equal(authDatabasePlan([{ name: "firebaseLocalStorageDb", version: 1 }], false), "skip");
    assert.equal(authDatabasePlan([{ name: "firebaseLocalStorageDb", version: 1 }], true), "read");
    assert.equal(authDatabasePlan(null, true), "read");
  });

  it("deletes the session database only when the adherent unlinks", () => {
    const media = readFileSync("src/lib/comfy-media.ts", "utf8");
    const session = readFileSync("src/lib/render/session.ts", "utf8");
    assert.doesNotMatch(media, /deleteDatabase/);
    const reading = session.slice(session.indexOf("function readStoredUsers"), session.indexOf("function clearStoredUsers"));
    const forgetting = session.slice(session.indexOf("function clearStoredUsers"), session.indexOf("export function sessionTokens"));
    assert.doesNotMatch(reading, /deleteDatabase/);
    assert.match(forgetting, /deleteDatabase\("firebaseLocalStorageDb"\)/);
  });
});
