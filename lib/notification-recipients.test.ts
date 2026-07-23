import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseClientNotificationRecipients,
  chooseOwnerNotificationRecipient,
  chooseStrictClientChannel,
  shouldEnqueueNotification,
  type ClientNotificationAccess,
} from "./notification-recipients";

const classificationAt = new Date("2026-07-23T10:00:00.000Z");

function buildAccess(
  overrides: Partial<ClientNotificationAccess> = {},
): ClientNotificationAccess {
  return {
    campaignDisplayName: "Client campaign",
    id: "access-1",
    isAdmin: false,
    minScoreToAlert: 70,
    notificationsEnabledAt: new Date("2026-07-23T09:00:00.000Z"),
    user: {
      id: "client-1",
      preferredAlertChannel: "TELEGRAM",
      slackWebhookUrl: "https://hooks.slack.com/services/example",
      telegramChatId: "chat-1",
    },
    ...overrides,
  };
}

test("preserves the owner's existing preferred-channel fallback behavior", () => {
  assert.deepEqual(
    chooseOwnerNotificationRecipient({
      campaignDisplayName: "Internal campaign",
      email: "owner@example.com",
      emailAlertsEnabled: true,
      existingChannels: ["SLACK"],
      minScoreToAlert: 75,
      preferredAlertChannel: "SLACK",
      recipientUserId: "owner-1",
      score: 90,
      slackWebhookUrl: "https://hooks.slack.com/services/example",
      telegramChatId: "chat-owner",
    }),
    {
      campaignClientAccessId: null,
      campaignDisplayName: "Internal campaign",
      channel: "TELEGRAM",
      recipientRole: "OWNER",
      recipientUserId: "owner-1",
    },
  );
});

test("does not select an owner recipient below the campaign threshold", () => {
  assert.equal(
    chooseOwnerNotificationRecipient({
      campaignDisplayName: "Internal campaign",
      email: "owner@example.com",
      emailAlertsEnabled: true,
      existingChannels: [],
      minScoreToAlert: 75,
      preferredAlertChannel: "SLACK",
      recipientUserId: "owner-1",
      score: 74,
      slackWebhookUrl: "https://hooks.slack.com/services/example",
      telegramChatId: null,
    }),
    null,
  );
});

test("selects each eligible client's exact configured channel and facing name", () => {
  const recipients = chooseClientNotificationRecipients({
    accesses: [
      buildAccess(),
      buildAccess({
        campaignDisplayName: "Second client view",
        id: "access-2",
        minScoreToAlert: 85,
        user: {
          id: "client-2",
          preferredAlertChannel: "SLACK",
          slackWebhookUrl: "https://hooks.slack.com/services/second",
          telegramChatId: null,
        },
      }),
    ],
    hadValidClassification: false,
    score: 90,
    successfulClassificationAt: classificationAt,
  });

  assert.deepEqual(recipients, [
    {
      campaignClientAccessId: "access-1",
      campaignDisplayName: "Client campaign",
      channel: "TELEGRAM",
      recipientRole: "CLIENT",
      recipientUserId: "client-1",
    },
    {
      campaignClientAccessId: "access-2",
      campaignDisplayName: "Second client view",
      channel: "SLACK",
      recipientRole: "CLIENT",
      recipientUserId: "client-2",
    },
  ]);
});

test("excludes admins, pending assignments, and clients below their own threshold", () => {
  const recipients = chooseClientNotificationRecipients({
    accesses: [
      buildAccess({ id: "admin", isAdmin: true }),
      buildAccess({ id: "pending", user: null }),
      buildAccess({ id: "high-threshold", minScoreToAlert: 91 }),
    ],
    hadValidClassification: false,
    score: 90,
    successfulClassificationAt: classificationAt,
  });

  assert.deepEqual(recipients, []);
});

test("does not fall back when a client's selected channel is disconnected", () => {
  assert.equal(
    chooseStrictClientChannel({
      preferredAlertChannel: "TELEGRAM",
      slackWebhookUrl: "https://hooks.slack.com/services/example",
      telegramChatId: null,
    }),
    null,
  );
  assert.equal(
    chooseStrictClientChannel({
      preferredAlertChannel: "EMAIL",
      slackWebhookUrl: "https://hooks.slack.com/services/example",
      telegramChatId: "chat-1",
    }),
    null,
  );
});

test("never replays old valid classifications to clients", () => {
  const access = buildAccess();

  assert.deepEqual(
    chooseClientNotificationRecipients({
      accesses: [access],
      hadValidClassification: true,
      score: 90,
      successfulClassificationAt: classificationAt,
    }),
    [],
  );
  assert.deepEqual(
    chooseClientNotificationRecipients({
      accesses: [buildAccess({
        notificationsEnabledAt: new Date("2026-07-23T10:00:01.000Z"),
      })],
      hadValidClassification: false,
      score: 90,
      successfulClassificationAt: classificationAt,
    }),
    [],
  );
});

test("allows the first successful retry after a prior classification failure", () => {
  assert.equal(
    chooseClientNotificationRecipients({
      accesses: [buildAccess()],
      hadValidClassification: false,
      score: 90,
      successfulClassificationAt: classificationAt,
    }).length,
    1,
  );
});

test("only pending notification rows are eligible for queueing", () => {
  assert.equal(shouldEnqueueNotification("PENDING"), true);
  assert.equal(shouldEnqueueNotification("SENT"), false);
  assert.equal(shouldEnqueueNotification("FAILED"), false);
});
