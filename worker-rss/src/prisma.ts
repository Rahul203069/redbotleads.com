import { PrismaPg } from "@prisma/adapter-pg";
import { isIP } from "node:net";
import tls from "node:tls";
import { PrismaClient } from "./generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const configuredPoolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);
const poolMax = Number.isInteger(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 2;

function withPostgresSslIdentity(config: { connectionString: string; ssl?: unknown }) {
  const url = new URL(config.connectionString);
  const sslMode = url.searchParams.get("sslmode");
  const host = url.hostname;

  if (sslMode !== "verify-full" || !isIP(host)) {
    return config;
  }

  url.searchParams.delete("sslmode");

  return {
    ...config,
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: true,
      checkServerIdentity: (_hostname: string, cert: tls.PeerCertificate) =>
        tls.checkServerIdentity(host, cert),
    },
  };
}

const adapter = new PrismaPg(
  withPostgresSslIdentity({
    connectionString,
    max: poolMax,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  }),
);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
