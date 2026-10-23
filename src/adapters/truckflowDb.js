import sql from "mssql";

// Confirmed from the real site install (Truckflow/*.exe.config):
//   Data Source=localhost\PMSQLSERVER; Initial Catalog=TruckFlowDB;
//   User Id=PMTruckflowUser; provider=System.Data.SqlClient
// "Truckflow" is Precia Molen's own site-management suite (namespace
// PM.Truckflow.*) — it already does plate↔weight reconciliation and
// ticketing. This module is a READ-ONLY client against its SQL Server
// database; it should never write to TruckFlowDB.
//
// None of this is wired into the live dashboard yet — the schema (table/
// column names) is unknown because no EDMX/backup/sample data survived in
// the copied folders. Run `npm run truckflow:discover` once real DB
// credentials are available to get the schema, then fill in real queries
// in truckflowAdapter.js.

export const DATA_SOURCE = process.env.DATA_SOURCE || "simulator"; // "simulator" | "truckflow"
export const truckflowEnabled = DATA_SOURCE === "truckflow";

function buildConfig() {
  const instanceName = process.env.TRUCKFLOW_DB_INSTANCE || "PMSQLSERVER";
  const port = process.env.TRUCKFLOW_DB_PORT ? Number(process.env.TRUCKFLOW_DB_PORT) : undefined;

  return {
    server: process.env.TRUCKFLOW_DB_HOST || "localhost",
    database: process.env.TRUCKFLOW_DB_NAME || "TruckFlowDB",
    user: process.env.TRUCKFLOW_DB_USER,
    password: process.env.TRUCKFLOW_DB_PASSWORD,
    port,
    options: {
      // Named instances (e.g. PMSQLSERVER) are normally resolved via the
      // SQL Server Browser service (UDP 1434) rather than a fixed port.
      // If the site firewall blocks UDP 1434, ask for a static TCP port
      // instead and set TRUCKFLOW_DB_PORT (and drop the instance name).
      instanceName: port ? undefined : instanceName,
      encrypt: process.env.TRUCKFLOW_DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.TRUCKFLOW_DB_TRUST_CERT !== "false",
    },
    connectionTimeout: 8000,
  };
}

let poolPromise = null;

export function getPool() {
  if (!truckflowEnabled) {
    throw new Error("DATA_SOURCE is not 'truckflow' — set it in server/.env to enable this adapter.");
  }
  if (!process.env.TRUCKFLOW_DB_USER || !process.env.TRUCKFLOW_DB_PASSWORD) {
    throw new Error(
      "TRUCKFLOW_DB_USER / TRUCKFLOW_DB_PASSWORD are not set — see server/.env.example."
    );
  }
  if (!poolPromise) {
    poolPromise = sql.connect(buildConfig()).catch((err) => {
      poolPromise = null; // allow retry on next call instead of caching a dead connection
      throw err;
    });
  }
  return poolPromise;
}

export async function testConnection() {
  const pool = await getPool();
  const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS db_name");
  return result.recordset[0];
}
