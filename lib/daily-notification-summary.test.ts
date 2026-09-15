import assert from "node:assert/strict";
import test from "node:test";

import { summarizeNotificationDeliveries } from "./notification-delivery-summary";

test("summarizes multiple recipient deliveries without counting a lead only once", () => {
  const createdAt = new Date("2026-07-23T10:00:00.000Z");
  const sentAt = new Date("2026-07-23T10:01:00.000Z");
  const summary = summarizeNotificationDeliveries([
    {
      channel: "SLACK",
      createdAt,
      error: null,
      sentAt,
      status: "SENT" as const,
    },
    {
      channel: "TELEGRAM",
      createdAt: new Date("2026-07-23T10:00:01.000Z"),
      error: "Telegram unavailable",
      sentAt: null,
      status: "FAILED" as const,
    },
  ]);

  assert.deepEqual(summary, {
    channel: "SLACK, TELEGRAM",
    createdAt: new Date("2026-07-23T10:00:01.000Z"),
    error: "Telegram unavailable",
    failedCount: 1,
    pendingCount: 0,
    recipientCount: 2,
    sentAt,
    sentCount: 1,
    skippedCount: 0,
    status: "PARTIAL",
  });
});

test("reports notifications suppressed by a campaign pause as skipped", () => {
  const createdAt = new Date("2026-09-16T10:00:00.000Z");
  const summary = summarizeNotificationDeliveries([
    {
      channel: "TELEGRAM",
      createdAt,
      error: null,
      sentAt: null,
      status: "SKIPPED" as const,
    },
  ]);

  assert.deepEqual(summary, {
    channel: "TELEGRAM",
    createdAt,
    error: null,
    failedCount: 0,
    pendingCount: 0,
    recipientCount: 1,
    sentAt: null,
    sentCount: 0,
    skippedCount: 1,
    status: "SKIPPED",
  });
});

test("handles no notification deliveries safely", () => {
  assert.equal(summarizeNotificationDeliveries([]), null);
});
