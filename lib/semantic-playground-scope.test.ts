import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlaygroundCandidateScopeFromSnapshot,
  parsePlaygroundCandidateScope,
} from "./semantic-playground-scope";

test("parses the two supported playground candidate scopes", () => {
  assert.equal(parsePlaygroundCandidateScope("CAMPAIGN"), "CAMPAIGN");
  assert.equal(parsePlaygroundCandidateScope("GLOBAL"), "GLOBAL");
});

test("legacy and invalid playground snapshots fall back to campaign scope", () => {
  assert.equal(getPlaygroundCandidateScopeFromSnapshot(null), "CAMPAIGN");
  assert.equal(getPlaygroundCandidateScopeFromSnapshot({}), "CAMPAIGN");
  assert.equal(getPlaygroundCandidateScopeFromSnapshot({ candidateScope: "OTHER" }), "CAMPAIGN");
  assert.equal(getPlaygroundCandidateScopeFromSnapshot({ candidateScope: "GLOBAL" }), "GLOBAL");
});
