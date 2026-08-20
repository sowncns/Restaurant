const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const migrationsDir = path.join(__dirname, "..", "src", "database", "migrations");
const legacyBaseline = "034_enable_supabase_realtime.sql";
const lockId = 724358921;

const checksum = (sql) => crypto.createHash("sha256").update(sql).digest("hex");
const transactionBody = (sql) =>
  sql.replace(/^\s*BEGIN;\s*$/gim, "").replace(/^\s*COMMIT;\s*$/gim, "");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b, "en"));

  const migrations = await Promise.all(
    files.map(async (name) => {
      const sql = await fs.readFile(path.join(migrationsDir, name), "utf8");
      return { name, sql, checksum: checksum(sql) };
    })
  );

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    let applied = await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name");

    // This repository predates its ledger. Adopt history only when the deployed base
    // schema is recognizable, avoiding replay of the legacy 016/028 drop migrations.
    if (applied.rowCount === 0) {
      const existing = await client.query(`
        SELECT to_regclass('public.companies') IS NOT NULL
           AND to_regclass('public.orders') IS NOT NULL
           AND to_regclass('public.invoices') IS NOT NULL AS ready
      `);
      if (existing.rows[0].ready) {
        const baseline = migrations.filter((migration) => migration.name <= legacyBaseline);
        await client.query("BEGIN");
        try {
          for (const migration of baseline) {
            await client.query(
              "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
              [migration.name, migration.checksum]
            );
          }
          await client.query("COMMIT");
          console.log(`Baselined ${baseline.length} legacy migrations through ${legacyBaseline}`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
        applied = await client.query("SELECT name, checksum FROM schema_migrations ORDER BY name");
      }
    }

    const appliedByName = new Map(applied.rows.map((row) => [row.name, row.checksum.trim()]));
    for (const migration of migrations) {
      const previousChecksum = appliedByName.get(migration.name);
      if (previousChecksum && previousChecksum !== migration.checksum) {
        throw new Error(`Applied migration changed: ${migration.name}`);
      }
      if (previousChecksum) continue;

      await client.query("BEGIN");
      try {
        // The runner owns the transaction so applying SQL and recording its ledger
        // entry always succeed or fail together, including for older wrapped files.
        await client.query(transactionBody(migration.sql));
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migration.name, migration.checksum]
        );
        await client.query("COMMIT");
        console.log(`Applied ${migration.name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration failed: ${migration.name}: ${error.message}`, { cause: error });
      }
    }

    console.log("Database migrations are up to date");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockId]).catch(() => {});
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
