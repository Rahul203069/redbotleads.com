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
    status: "PARTIAL",
  });
});

test("handles no notification deliveries safely", () => {
  assert.equal(summarizeNotificationDeliveries([]), null);
});
