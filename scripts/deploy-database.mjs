import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client, escapeIdentifier } = pg;
const connectionString = process.env.DATABASE_URL;
const appUser = process.env.POSTGRES_APP_USER;
const allowFreshBootstrap = process.env.FRESH_DATABASE_BOOTSTRAP === "true";

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

if (!appUser) {
  throw new Error("POSTGRES_APP_USER is required.");
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDir = join(rootDir, "prisma", "migrations");
const client = new Client({ connectionString });

function runPrisma(args) {
  execFileSync(npx, ["prisma", ...args], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
  });
}

async function hasCoreSchema() {
  const result = await client.query(`
    SELECT
      to_regclass('public."User"') IS NOT NULL AS "hasUser",
      to_regclass('public."RedditItem"') IS NOT NULL AS "hasRedditItem"
  `);

  return result.rows[0]?.hasUser === true && result.rows[0]?.hasRedditItem === true;
}

async function bootstrapFreshDatabase() {
  console.warn("Fresh database bootstrap requested; resetting the public schema.");

  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public AUTHORIZATION CURRENT_USER");
  await client.query(`GRANT USAGE ON SCHEMA public TO ${escapeIdentifier(appUser)}`);
  await client.query("CREATE EXTENSION IF NOT EXISTS vector");

  runPrisma(["db", "push"]);

  const escapedAppUser = escapeIdentifier(appUser);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${escapedAppUser}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON ALL TABLES IN SCHEMA public TO ${escapedAppUser}`);
  await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${escapedAppUser}`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, MAINTAIN ON TABLES TO ${escapedAppUser}`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${escapedAppUser}`,
  );
  await client.end();

  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migration of migrations) {
    runPrisma(["migrate", "resolve", "--applied", migration]);
  }

  runPrisma(["migrate", "deploy"]);
  console.log(`Fresh database bootstrapped and ${migrations.length} migrations baselined.`);
}

try {
  await client.connect();

  if (await hasCoreSchema()) {
    await client.end();
    runPrisma(["migrate", "deploy"]);
  } else if (allowFreshBootstrap) {
    await bootstrapFreshDatabase();
  } else {
    throw new Error(
      "Core tables are missing. For a new empty database, rerun with FRESH_DATABASE_BOOTSTRAP=true. " +
        "Do not use that flag on a database containing data.",
    );
  }
} finally {
  await client.end().catch(() => undefined);
}
