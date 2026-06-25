ALTER TYPE "NotifyChannel" ADD VALUE IF NOT EXISTS 'TELEGRAM';

ALTER TABLE "User"
  ADD COLUMN "preferredAlertChannel" "NotifyChannel" NOT NULL DEFAULT 'SLACK',
  ADD COLUMN "telegramChatId" TEXT,
  ADD COLUMN "telegramUsername" TEXT,
  ADD COLUMN "telegramConnectedAt" TIMESTAMP(3);

CREATE TABLE "TelegramPairing" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramPairing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramPairing_code_key" ON "TelegramPairing"("code");
CREATE INDEX "TelegramPairing_userId_createdAt_idx" ON "TelegramPairing"("userId", "createdAt" DESC);
CREATE INDEX "TelegramPairing_expiresAt_idx" ON "TelegramPairing"("expiresAt");

ALTER TABLE "TelegramPairing"
  ADD CONSTRAINT "TelegramPairing_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
