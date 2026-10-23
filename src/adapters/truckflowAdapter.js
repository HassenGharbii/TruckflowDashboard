// Domain-level reads against the REAL TruckFlowDB (Precia Molen's Truckflow
// suite). Confirmed schema from the live site (2026-10-23). Read-only: every
// query here is a plain SELECT, nothing ever writes to this database.

import sql from "mssql";
import { getPool } from "./truckflowDb.js";

function mapTicket(row) {
  return {
    id: row.Id,
    ticketNumber: row.TicketNumber,
    tiers: row.TiersLabel,
    entryWeight: row.EntryWeight,
    exitWeight: row.ExitWeight,
    net: row.Net,
    ptac: row.Ptac,
    exitDate: row.WeightExitDate,
    driverCode: row.DriverCode,
    driverLabel: row.DriverLabel,
    plate: row.Plate,
    tareDate: row.TareDate,
    tare: row.Tare,
    productCode: row.ProductCode,
    overload: !!row.Overload,
    tareDsd: row.TareDsd,
    isCanceled: !!row.IsCanceled,
  };
}

function mapOpenWeighing(row) {
  return {
    id: row.Id,
    plate: row.Plate,
    customPlate: row.CustomPlate,
    hasPlateAnomaly: !!row.HasPlateAnomalie,
    tare: row.Tare,
    entryWeight: row.EntryWeight,
    exitWeight: row.ExitWeight,
    net: row.Net,
    direction: row.Direction,
    weighingStep: row.WeighingStep,
    ticketNumber: row.TicketNumber,
    creation: row.Creation,
    weightEntryDate: row.WeightEntryDate,
    entryWeighingDeviceName: row.EntryWeighingDeviceName,
    isCanceled: !!row.IsCanceled,
  };
}

function mapAccessEvent(row) {
  return {
    id: row.Id,
    parkCode: row.ParkCode,
    parkLabel: row.ParkLabel,
    plate: row.Plate,
    accessDate: row.AccessDate,
    areaName: row.AreaName,
    deviceName: row.DeviceName,
    authorized: !!row.Authorized,
    accessControlMessage: row.AccessControlMessage,
  };
}

// "Historique" — closed/completed tickets, most recent first.
export async function fetchRecentTickets(limit = 50) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("limit", sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        Id, TicketNumber, TiersLabel, EntryWeight, ExitWeight, Net, Ptac,
        WeightExitDate, DriverCode, DriverLabel, Plate, TareDate, Tare,
        ProductCode, Overload, TareDsd, IsCanceled
      FROM WeighingReports
      WHERE WeightExitDate IS NOT NULL
      ORDER BY WeightExitDate DESC
    `);
  return result.recordset.map(mapTicket);
}

// "Camions sur site" — currently open weighings (no exit yet).
export async function fetchOpenWeighings() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      Id, Plate, CustomPlate, HasPlateAnomalie, Tare, EntryWeight, ExitWeight,
      Net, Direction, WeighingStep, TicketNumber, Creation, WeightEntryDate,
      EntryWeighingDeviceName, IsCanceled
    FROM WeighingInProgresses
    WHERE IsCanceled = 0
    ORDER BY Creation DESC
  `);
  return result.recordset.map(mapOpenWeighing);
}

// Real LAPI/camera read log — entry and exit plate reads.
export async function fetchRecentAccessEvents(limit = 200) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("limit", sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        Id, ParkCode, ParkLabel, Plate, AccessDate, AreaName, DeviceName,
        Authorized, AccessControlMessage
      FROM AccessHistories
      ORDER BY AccessDate DESC
    `);
  return result.recordset.map(mapAccessEvent);
}
