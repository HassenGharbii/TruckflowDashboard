// Real-data engine: polls TruckFlowDB directly (read-only) and produces the
// exact same snapshot shape the simulator's Engine does, so the existing
// dashboard components need no changes. Used instead of (never alongside)
// the simulator when DATA_SOURCE=truckflow.
//
// Known limitations vs the simulator, by design (no fabricated data):
//  - `pont` (weighbridge gauge) shows the last *recorded* weight from the DB,
//    not a live ramping animation — Truckflow's DB only gets written once a
//    weighing step completes, so there is no sub-second live reading here.
//  - `lastLecture.sens` (Entree/Sortie) is guessed from the camera's
//    AreaName/DeviceName text (looking for "entr"/"sorti") since
//    AccessHistories has no explicit direction column. Verify this matches
//    reality once you see real device names, and adjust guessDirection().
//  - `lastLecture.fiabilite` (OCR confidence) does not exist in this schema
//    — always null, and the UI simply hides that row.
//  - Alerts table's AlertType is an unconfirmed enum — shown as a raw code
//    until the client tells us what each value means.

import sql from "mssql";
import { getPool } from "./adapters/truckflowDb.js";

const POLL_INTERVAL_MS = Number(process.env.TRUCKFLOW_POLL_INTERVAL_MS) || 4000;
const OVERSTAY_THRESHOLD_SEC = Number(process.env.OVERSTAY_THRESHOLD_SEC) || 7200; // 2h, per ARCHITECTURE.md
const MAX_HISTORY_ROWS = 1000;

function toMs(dateVal) {
  return dateVal ? new Date(dateVal).getTime() : null;
}

function guessDirection(areaName, deviceName) {
  const text = `${areaName || ""} ${deviceName || ""}`.toLowerCase();
  if (text.includes("sorti") || text.includes("exit") || text.includes("out")) return "Sortie";
  return "Entree";
}

function mapOpenToPassage(row) {
  return {
    id: row.Id,
    plaque: row.CustomPlate || row.Plate || "—",
    entree_horodatage: toMs(row.WeightEntryDate || row.Creation),
    sortie_horodatage: null,
    poids_entree: row.EntryWeight,
    poids_sortie: null,
    poids_net: null,
    duree_ms: null,
    operation: null,
    statut: "SurSite",
    remarque: row.HasPlateAnomalie ? "Anomalie de plaque détectée" : "",
  };
}

function mapClosedToPassage(row) {
  const entree = toMs(row.WeightEntryDate);
  const sortie = toMs(row.WeightExitDate);
  return {
    id: row.Id,
    plaque: row.Plate || "—",
    entree_horodatage: entree,
    sortie_horodatage: sortie,
    poids_entree: row.EntryWeight,
    poids_sortie: row.ExitWeight,
    poids_net: row.Net,
    duree_ms:
      entree && sortie
        ? sortie - entree
        : row.TimeSpanWeighingInMinute != null
        ? row.TimeSpanWeighingInMinute * 60000
        : null,
    // Heuristic from real weights (same logic the simulator uses): a truck
    // that leaves lighter than it arrived dropped off a load (Livraison);
    // a truck that leaves heavier picked one up (Enlèvement).
    operation:
      row.EntryWeight != null && row.ExitWeight != null
        ? row.EntryWeight > row.ExitWeight
          ? "Livraison"
          : "Enlèvement"
        : null,
    statut: "Sorti",
    remarque: [row.HasPlateAnomalie ? "Anomalie de plaque détectée" : "", row.OperatorComment || ""]
      .filter(Boolean)
      .join(" — "),
  };
}

function emptySnapshot() {
  return {
    kpis: {
      camionsSurSite: 0,
      entreesDuJour: 0,
      sortiesDuJour: 0,
      dureeMoyenneSec: 0,
      tonnageNetDuJour: 0,
      anomalies: 0,
    },
    pont: { etat: "PontLibre", poids: 0, plaque: null, sens: null },
    lastLecture: null,
    camionsSurSite: [],
    passagesDuJour: [],
    hourly: Array.from({ length: 24 }, (_, i) => ({ heure: i, entrees: 0 })),
    journal: [],
    anomalies: [],
    overstayThresholdSec: OVERSTAY_THRESHOLD_SEC,
    serverTime: Date.now(),
  };
}

export class TruckflowEngine {
  constructor(onBroadcast) {
    this.onBroadcast = onBroadcast || (() => {});
    this.cached = emptySnapshot();
    this.seenAlertIds = new Set();
    this.overstayAlertedIds = new Set();
  }

  start() {
    this.refresh().catch((err) => console.error("truckflow refresh error:", err.message));
    this.pollInterval = setInterval(() => {
      this.refresh().catch((err) => console.error("truckflow refresh error:", err.message));
    }, POLL_INTERVAL_MS);
  }

  stop() {
    clearInterval(this.pollInterval);
  }

  snapshot() {
    return this.cached;
  }

  async refresh() {
    const pool = await getPool();
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [openResult, closedTodayResult, entriesTodayResult, accessResult, alertsResult] = await Promise.all([
      pool.request().query(`
        SELECT Id, Plate, CustomPlate, HasPlateAnomalie, EntryWeight, Creation, WeightEntryDate
        FROM WeighingInProgresses
        WHERE IsCanceled = 0
        ORDER BY Creation DESC
      `),
      pool
        .request()
        .input("todayStart", sql.DateTime2, todayStart)
        .query(`
          SELECT Id, Plate, EntryWeight, ExitWeight, Net, WeightEntryDate, WeightExitDate,
                 TimeSpanWeighingInMinute, HasPlateAnomalie, OperatorComment
          FROM WeighingReports
          WHERE IsCanceled = 0 AND WeightExitDate >= @todayStart
          ORDER BY WeightExitDate DESC
        `),
      pool
        .request()
        .input("todayStart", sql.DateTime2, todayStart)
        .query(`
          SELECT COUNT(*) AS c FROM WeighingReports
          WHERE IsCanceled = 0 AND WeightEntryDate >= @todayStart
        `),
      pool.request().query(`
        SELECT TOP (1) Id, Plate, AccessDate, AreaName, DeviceName
        FROM AccessHistories
        ORDER BY AccessDate DESC
      `),
      pool
        .request()
        .input("todayStart", sql.DateTime2, todayStart)
        .query(`
          SELECT Id, DeviceName, Date, AlertType
          FROM Alerts
          WHERE Date >= @todayStart
          ORDER BY Date DESC
        `),
    ]);

    const openRows = openResult.recordset;
    const closedRows = closedTodayResult.recordset;
    const openToday = openRows.filter(
      (r) => (toMs(r.WeightEntryDate || r.Creation) ?? 0) >= todayStart.getTime()
    );

    const camionsSurSite = openRows
      .map(mapOpenToPassage)
      .sort((a, b) => (b.entree_horodatage || 0) - (a.entree_horodatage || 0));

    const passagesDuJour = [...openToday.map(mapOpenToPassage), ...closedRows.map(mapClosedToPassage)]
      .sort((a, b) => (b.sortie_horodatage || b.entree_horodatage || 0) - (a.entree_horodatage || 0))
      .slice(0, 50);

    const dureeMoyenneMs = closedRows.length
      ? closedRows.reduce((sum, r) => {
          const entree = toMs(r.WeightEntryDate);
          const sortie = toMs(r.WeightExitDate);
          return sum + (entree && sortie ? sortie - entree : 0);
        }, 0) / closedRows.length
      : 0;
    const tonnageNetDuJour = closedRows.reduce((sum, r) => sum + (r.Net || 0), 0) / 1000;

    const hourly = Array.from({ length: 24 }, (_, i) => ({ heure: i, entrees: 0 }));
    for (const r of openToday) {
      const ts = toMs(r.WeightEntryDate || r.Creation);
      const bucket = ts && hourly.find((b) => b.heure === new Date(ts).getHours());
      if (bucket) bucket.entrees += 1;
    }
    for (const r of closedRows) {
      const ts = toMs(r.WeightEntryDate);
      const bucket = ts && hourly.find((b) => b.heure === new Date(ts).getHours());
      if (bucket) bucket.entrees += 1;
    }

    const accessRow = accessResult.recordset[0];
    const lastLecture = accessRow
      ? {
          id: accessRow.Id,
          horodatage: toMs(accessRow.AccessDate),
          sens: guessDirection(accessRow.AreaName, accessRow.DeviceName),
          plaque_lue: accessRow.Plate,
          plaque_corrigee: null,
          fiabilite: null,
        }
      : null;

    const alertRows = alertsResult.recordset.map((r) => ({
      id: r.Id,
      type: `TruckflowAlertType${r.AlertType}`,
      passage_id: null,
      horodatage: toMs(r.Date),
      details: `Alerte Truckflow sur ${r.DeviceName || "appareil inconnu"} (code ${r.AlertType}).`,
    }));
    const newAlerts = alertRows.filter((a) => !this.seenAlertIds.has(a.id));
    this.seenAlertIds = new Set(alertRows.map((a) => a.id));

    const overstayAnomalies = camionsSurSite
      .filter((p) => p.entree_horodatage && (now - p.entree_horodatage) / 1000 > OVERSTAY_THRESHOLD_SEC)
      .map((p) => ({
        id: `overstay-${p.id}`,
        type: "DureeDepassee",
        passage_id: p.id,
        horodatage: now,
        details: `Alerte durée dépassée — le camion ${p.plaque} est présent depuis plus du seuil autorisé.`,
      }));
    // Only toast each overstaying truck once (matches the simulator's
    // one-shot `overstayAlerted` flag) — without this, the same truck
    // re-fires a toast on every poll for as long as it stays overdue.
    const newOverstays = overstayAnomalies.filter((a) => !this.overstayAlertedIds.has(a.id));
    for (const a of newOverstays) this.overstayAlertedIds.add(a.id);

    const anomalies = [...overstayAnomalies, ...alertRows];

    // Last known weighbridge reading — see module header note: this cannot
    // animate live like the simulator, only reflect the latest DB write.
    let pont = { etat: "PontLibre", poids: 0, plaque: null, sens: null };
    const latestOpen = openRows[0];
    const latestClosed = closedRows[0];
    const latestOpenTs = latestOpen ? toMs(latestOpen.WeightEntryDate || latestOpen.Creation) || 0 : 0;
    const latestClosedTs = latestClosed ? toMs(latestClosed.WeightExitDate) || 0 : 0;
    if (latestOpen && latestOpen.EntryWeight != null && latestOpenTs >= latestClosedTs) {
      pont = {
        etat: "PoidsStable",
        poids: Math.round(latestOpen.EntryWeight),
        plaque: latestOpen.CustomPlate || latestOpen.Plate,
        sens: "Entree",
      };
    } else if (latestClosed && latestClosed.ExitWeight != null) {
      pont = {
        etat: "PoidsStable",
        poids: Math.round(latestClosed.ExitWeight),
        plaque: latestClosed.Plate,
        sens: "Sortie",
      };
    }

    const journal = this.buildJournal(openToday, closedRows, accessRow);

    this.cached = {
      kpis: {
        camionsSurSite: camionsSurSite.length,
        entreesDuJour: entriesTodayResult.recordset[0].c + openToday.length,
        sortiesDuJour: closedRows.length,
        dureeMoyenneSec: Math.round(dureeMoyenneMs / 1000),
        tonnageNetDuJour: Number(tonnageNetDuJour.toFixed(1)),
        anomalies: anomalies.length,
      },
      pont,
      lastLecture,
      camionsSurSite,
      passagesDuJour,
      hourly,
      journal,
      anomalies: anomalies.slice(0, 20),
      overstayThresholdSec: OVERSTAY_THRESHOLD_SEC,
      serverTime: now,
    };

    const extra = {};
    if (newAlerts.length) extra.alert = newAlerts[0];
    else if (newOverstays.length) extra.alert = newOverstays[0];

    this.onBroadcast({ type: "snapshot", data: this.cached, ...extra });
  }

  buildJournal(openToday, closedRows, accessRow) {
    const entries = [];
    for (const r of openToday) {
      const ts = toMs(r.WeightEntryDate || r.Creation);
      if (!ts) continue;
      entries.push({
        id: `entry-${r.Id}`,
        horodatage: ts,
        type: "Entree",
        message: `${r.CustomPlate || r.Plate} — entrée enregistrée, poids ${Math.round(r.EntryWeight || 0)} kg.`,
      });
    }
    for (const r of closedRows) {
      const ts = toMs(r.WeightExitDate);
      if (!ts) continue;
      const net = r.Net != null ? (r.Net / 1000).toFixed(2) : "?";
      entries.push({
        id: `exit-${r.Id}`,
        horodatage: ts,
        type: "Sortie",
        message: `${r.Plate} — sortie confirmée, poids net ${net} t.`,
      });
    }
    if (accessRow) {
      entries.push({
        id: `access-${accessRow.Id}`,
        horodatage: toMs(accessRow.AccessDate),
        type: guessDirection(accessRow.AreaName, accessRow.DeviceName),
        message: `Lecture caméra — plaque ${accessRow.Plate} (${accessRow.DeviceName || "caméra"}).`,
      });
    }
    return entries.sort((a, b) => b.horodatage - a.horodatage).slice(0, 30);
  }

  async getHistory({ from, to, plaque } = {}) {
    const pool = await getPool();
    const request = pool.request();
    const conditions = ["IsCanceled = 0"];
    if (from) {
      conditions.push("WeightExitDate >= @from");
      request.input("from", sql.DateTime2, new Date(from));
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push("WeightExitDate <= @to");
      request.input("to", sql.DateTime2, toDate);
    }
    if (plaque) {
      conditions.push("Plate LIKE @plaque");
      request.input("plaque", sql.NVarChar, `%${plaque.trim()}%`);
    }
    const result = await request.query(`
      SELECT TOP (${MAX_HISTORY_ROWS}) Id, Plate, EntryWeight, ExitWeight, Net, WeightEntryDate,
             WeightExitDate, TimeSpanWeighingInMinute, HasPlateAnomalie, OperatorComment
      FROM WeighingReports
      WHERE ${conditions.join(" AND ")}
      ORDER BY WeightExitDate DESC
    `);
    const passages = result.recordset.map(mapClosedToPassage);
    const totalNetTonnes = passages.reduce((sum, p) => sum + (p.poids_net || 0), 0) / 1000;
    return { passages, count: passages.length, totalNetTonnes: Number(totalNetTonnes.toFixed(1)) };
  }
}
