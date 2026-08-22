import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_SAAS_APP_MODE, normalizeSaasAppMode } from "./app-mode";

test("keeps Daily Mode as the safe default", () => {
  assert.equal(DEFAULT_SAAS_APP_MODE, "DAILY");
  assert.equal(normalizeSaasAppMode(undefined), "DAILY");
  assert.equal(normalizeSaasAppMode("unexpected"), "DAILY");
});

test("accepts both named campaign modes", () => {
  assert.equal(normalizeSaasAppMode("DAILY"), "DAILY");
  assert.equal(normalizeSaasAppMode("LIVE"), "LIVE");
});

test("maps the legacy inbox layout to Live Mode during compatibility reads", () => {
  assert.equal(normalizeSaasAppMode(undefined, "INBOX"), "LIVE");
  assert.equal(normalizeSaasAppMode(undefined, "CLASSIC"), "DAILY");
});
