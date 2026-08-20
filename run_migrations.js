const pool = require("./backend/src/config/db");
const fs = require("fs");
const path = require("path");

async function runMigrations() {
  const client = await pool.connect();
  try {
    const p1 = path.join(__dirname, "backend", "src", "database", "migrations", "003_combo_verify_audit.sql");
    const sql1 = fs.readFileSync(p1, "utf8");
    await client.query(sql1);
    console.log("Ran 003_combo_verify_audit.sql");
    
    const p2 = path.join(__dirname, "backend", "src", "database", "migrations", "032_order_combo_support.sql");
    const sql2 = fs.readFileSync(p2, "utf8");
    await client.query(sql2);
    console.log("Ran 032_order_combo_support.sql");

    const p3 = path.join(__dirname, "backend", "src", "database", "migrations", "033_repair_detached_combo_prices.sql");
    const sql3 = fs.readFileSync(p3, "utf8");
    await client.query(sql3);
    console.log("Ran 033_repair_detached_combo_prices.sql");

  } catch (error) {
    console.error("Error running migrations:", error);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigrations();
