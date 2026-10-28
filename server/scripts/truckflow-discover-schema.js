// Run once real TruckFlowDB credentials/network access are available:
//
//   cd server
//   copy .env.example .env   (then fill in TRUCKFLOW_DB_* values)
//   npm run truckflow:discover
//
// This connects read-only, dumps every table, its columns, and a row count,
// to server/truckflow-schema.json AND stdout. Send that file back so the
// real queries in src/adapters/truckflowAdapter.js can be written against
// the actual schema instead of guessed table/column names.
//
// This script only ever runs SELECTs against system catalog views — it
// cannot and does not modify TruckFlowDB.

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { testConnection, getPool, truckflowEnabled } from "../src/adapters/truckflowDb.js";

async function main() {
  if (!truckflowEnabled) {
    console.error(
      "DATA_SOURCE is not set to 'truckflow'. Create server/.env from .env.example, " +
        "set DATA_SOURCE=truckflow and the TRUCKFLOW_DB_* values, then re-run this script."
    );
    process.exit(1);
  }

  console.log("Connecting to TruckFlowDB...");
  const info = await testConnection();
  console.log(`Connected. ${info.db_name} — ${info.version.split("\n")[0]}`);

  const pool = await getPool();

  const tables = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `);

  const columns = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH, ORDINAL_POSITION
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
  `);

  const schema = {};
  for (const t of tables.recordset) {
    const key = `${t.TABLE_SCHEMA}.${t.TABLE_NAME}`;
    schema[key] = { columns: [], rowCount: null };
  }
  for (const c of columns.recordset) {
    const key = `${c.TABLE_SCHEMA}.${c.TABLE_NAME}`;
    if (!schema[key]) schema[key] = { columns: [], rowCount: null };
    schema[key].columns.push({
      name: c.COLUMN_NAME,
      type: c.DATA_TYPE,
      nullable: c.IS_NULLABLE === "YES",
      maxLength: c.CHARACTER_MAXIMUM_LENGTH,
    });
  }

  console.log(`Found ${Object.keys(schema).length} tables. Counting rows...`);
  for (const key of Object.keys(schema)) {
    const [schemaName, tableName] = key.split(".");
    try {
      const countResult = await pool
        .request()
        .query(`SELECT COUNT(*) AS n FROM [${schemaName}].[${tableName}]`);
      schema[key].rowCount = countResult.recordset[0].n;
    } catch (err) {
      schema[key].rowCount = `error: ${err.message}`;
    }
  }

  const outPath = new URL("../truckflow-schema.json", import.meta.url);
  writeFileSync(outPath, JSON.stringify(schema, null, 2));
  console.log(`\nWrote schema for ${Object.keys(schema).length} tables to server/truckflow-schema.json`);

  console.log("\n--- Summary (table: row count) ---");
  for (const [key, val] of Object.entries(schema)) {
    console.log(`  ${key}: ${val.rowCount}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Schema discovery failed:", err.message);
  console.error(
    "\nCommon causes: wrong host/instance name, SQL Server Browser (UDP 1434) blocked by " +
      "firewall (ask for a static TCP port instead), wrong credentials, or no network path " +
      "from this machine to the SQL Server."
  );
  process.exit(1);
});
