import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanSemanticQueryRows,
  MAX_SEMANTIC_QUERY_CATEGORY_LENGTH,
  MAX_SEMANTIC_QUERY_TEXT_LENGTH,
  parseSemanticQueryBulkInput,
  parseSemanticQueriesJson,
} from "./semantic-queries";

test("parses supported JSON wrapper shapes", () => {
  for (const payload of [
    '[{"text":"looking for a CRM","category":"buyer-intent"}]',
    '{"queries":[{"queryText":"looking for a CRM"}]}',
    '{"semanticQueries":["looking for a CRM"]}',
  ]) {
    const result = parseSemanticQueryBulkInput(payload);
    assert.equal(result.status, "success");
    assert.deepEqual(result.status === "success" ? result.queries : [], [
      {
        category: payload.includes("buyer-intent") ? "buyer-intent" : "",
        text: "looking for a CRM",
      },
    ]);
  }
});

test("parses newline and triple-comma plain text", () => {
  for (const payload of ["query one\nquery two", "query one,,,query two"]) {
    const result = parseSemanticQueryBulkInput(payload);
    assert.equal(result.status, "success");
    assert.deepEqual(result.status === "success" ? result.queries.map((query) => query.text) : [], [
      "query one",
      "query two",
    ]);
  }
});

test("deduplicates repeated imports by collapsed whitespace and case", () => {
  const result = cleanSemanticQueryRows([
    { text: "Looking   for a CRM", category: "first" },
    { text: " looking for A crm ", category: "second" },
  ]);

  assert.equal(result.status, "success");
  assert.deepEqual(result.status === "success" ? result.queries : [], [
    { text: "Looking   for a CRM", category: "first" },
  ]);
});

test("rejects malformed JSON and unsupported wrappers", () => {
  assert.equal(parseSemanticQueryBulkInput('{"queries":[').status, "error");
  assert.equal(parseSemanticQueriesJson('{"items":[]}').status, "error");
});

test("enforces text and category limits", () => {
  assert.equal(cleanSemanticQueryRows([{ text: "ab" }]).status, "error");
  assert.equal(cleanSemanticQueryRows([{ text: "x".repeat(MAX_SEMANTIC_QUERY_TEXT_LENGTH + 1) }]).status, "error");
  assert.equal(
    cleanSemanticQueryRows([{ text: "valid query", category: "x".repeat(MAX_SEMANTIC_QUERY_CATEGORY_LENGTH + 1) }]).status,
    "error",
  );
});

test("requires at least one valid query", () => {
  assert.equal(parseSemanticQueriesJson("[]").status, "error");
  assert.equal(cleanSemanticQueryRows([{ text: "" }]).status, "error");
});
