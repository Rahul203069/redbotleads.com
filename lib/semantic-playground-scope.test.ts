import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlaygroundCandidateScopeFromSnapshot,
  getPlaygroundFilteringDescriptionFromSnapshot,
  parsePlaygroundCandidateScope,
  resolvePlaygroundFilteringDescription,
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

test("reads and trims a per-run filtering description from a playground snapshot", () => {
  assert.equal(
    getPlaygroundFilteringDescriptionFromSnapshot({ filteringDescription: "  Find payment-processing buyers.  " }),
    "Find payment-processing buyers.",
  );
});

test("legacy and invalid playground snapshots do not invent a filtering description", () => {
  assert.equal(getPlaygroundFilteringDescriptionFromSnapshot(null), null);
  assert.equal(getPlaygroundFilteringDescriptionFromSnapshot({}), null);
  assert.equal(getPlaygroundFilteringDescriptionFromSnapshot({ description: "Legacy run notes" }), null);
  assert.equal(getPlaygroundFilteringDescriptionFromSnapshot({ filteringDescription: "   " }), null);
  assert.equal(getPlaygroundFilteringDescriptionFromSnapshot({ filteringDescription: 42 }), null);
});

test("prefers a snapshot description and falls back to the campaign description for legacy runs", () => {
  assert.equal(
    resolvePlaygroundFilteringDescription(
      { filteringDescription: "Run-specific criteria" },
      "Saved campaign criteria",
    ),
    "Run-specific criteria",
  );
  assert.equal(resolvePlaygroundFilteringDescription({}, "Saved campaign criteria"), "Saved campaign criteria");
  assert.equal(resolvePlaygroundFilteringDescription({}, null), null);
});
