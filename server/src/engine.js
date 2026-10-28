import { randomUUID } from "node:crypto";
import { randomPlate, maybeMangle } from "./plates.js";

// Demo-paced timing constants. In production these map to real-world durations
// (the overstay threshold is "2h" in the real system) but are compressed here
// so the simulated dashboard stays lively to watch.
const CYCLE_MIN_MS = 5000;
const CYCLE_MAX_MS = 11000;
const WEIGH_RAMP_MS = 2600;
const WEIGH_STEPS = 10;
const DWELL_MIN_MS = 9000;
const DWELL_MAX_MS = 42000;
const OVERSTAY_THRESHOLD_MS = 22000;
const SORTIE_SANS_ENTREE_PROB = 0.08;
const PESEE_SANS_PLAQUE_PROB = 0.05;
const MAX_JOURNAL = 200;
const MAX_PASSAGES_KEPT = 500;

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function fmtKg(v) {
  return Math.round(v);
}

export class Engine {
  constructor(onBroadcast) {
    this.onBroadcast = onBroadcast || (() => {});
    this.passages = new Map(); // id -> passage
    this.journal = [];
    this.anomalies = [];
    this.pont = { etat: "PontLibre", poids: 0, plaque: null, sens: null };
    this.lastLecture = null;
    this.timers = [];
    this.seedHistory();
  }

  // ---- bootstrapping so the dashboard isn't empty on first load ----
  seedHistory() {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(5, 0, 0, 0);
    const count = rand(14, 22);
    for (let i = 0; i < count; i++) {
      const entreeOffset = rand(0, Math.max(1, now - todayStart.getTime() - 20 * 60000));
      const entree = todayStart.getTime() + entreeOffset;
      const duree = rand(6, 90) * 60000; // 6 to 96 minutes of "real" dwell time for history
      const sortie = entree + duree;
      if (sortie > now - 60000) continue;
      const operation = Math.random() < 0.5 ? "Livraison" : "Enlevement";
      const poidsEntree =
        operation === "Livraison" ? rand(18000, 34000) : rand(6000, 14000);
      const poidsSortie =
        operation === "Livraison"
          ? poidsEntree - rand(6000, 16000)
          : poidsEntree + rand(6000, 16000);
      const plaque = randomPlate();
      const id = randomUUID();
      this.passages.set(id, {
        id,
        plaque,
        entree_horodatage: entree,
        sortie_horodatage: sortie,
        poids_entree: fmtKg(poidsEntree),
        poids_sortie: fmtKg(poidsSortie),
        poids_net: fmtKg(Math.abs(poidsSortie - poidsEntree)),
        duree_ms: sortie - entree,
        operation,
        statut: "Sorti",
        remarque: "",
        overstayAlerted: false,
      });
    }
  }

  log(type, message) {
    const entry = { id: randomUUID(), horodatage: Date.now(), type, message };
    this.journal.unshift(entry);
    if (this.journal.length > MAX_JOURNAL) this.journal.length = MAX_JOURNAL;
    return entry;
  }

  addAnomalie(type, details, passageId = null) {
    const anomalie = {
      id: randomUUID(),
      type,
      passage_id: passageId,
      horodatage: Date.now(),
      details,
    };
    this.anomalies.unshift(anomalie);
    this.log("Anomalie", details);
    this.broadcast({ alert: anomalie });
  }

  broadcast(extra = {}) {
    this.onBroadcast({ type: "snapshot", data: this.snapshot(), ...extra });
  }

  // ---- core simulation loop ----
  start() {
    this.scheduleNextCycle();
    this.overstayInterval = setInterval(() => this.checkOverstays(), 2000);
    this.heartbeatInterval = setInterval(() => this.broadcast(), 3000);
  }

  stop() {
    clearInterval(this.overstayInterval);
    clearInterval(this.heartbeatInterval);
    this.timers.forEach(clearTimeout);
  }

  scheduleNextCycle() {
    const delay = rand(CYCLE_MIN_MS, CYCLE_MAX_MS);
    const t = setTimeout(() => {
      this.scheduleNextCycle();
      this.runTruckCycle().catch((err) => console.error("cycle error", err));
    }, delay);
    this.timers.push(t);
  }

  checkOverstays() {
    const now = Date.now();
    for (const passage of this.passages.values()) {
      if (passage.statut !== "SurSite" || passage.overstayAlerted) continue;
      if (now - passage.entree_horodatage > OVERSTAY_THRESHOLD_MS) {
        passage.overstayAlerted = true;
        this.addAnomalie(
          "DureeDepassee",
          `Alerte durée dépassée — le camion ${passage.plaque} est présent depuis plus du seuil autorisé.`,
          passage.id
        );
      }
    }
  }

  async weighSequence(sens, finalWeight, plaque) {
    this.pont = { etat: "PeseeEnCours", poids: 0, plaque, sens };
    this.broadcast();
    for (let i = 1; i <= WEIGH_STEPS; i++) {
      await sleep(WEIGH_RAMP_MS / WEIGH_STEPS);
      const progress = i / WEIGH_STEPS;
      const jitter = i === WEIGH_STEPS ? 0 : rand(-150, 150);
      this.pont = {
        etat: i === WEIGH_STEPS ? "PoidsStable" : "PeseeEnCours",
        poids: fmtKg(finalWeight * progress + jitter),
        plaque,
        sens,
      };
      this.broadcast();
    }
    // brief hold on "Poids stable" before the weighbridge goes idle again
    await sleep(900);
    this.pont = { etat: "PontLibre", poids: 0, plaque: null, sens: null };
  }

  async runTruckCycle() {
    // Rare anomaly: a stray weighing with no associated plate read at all.
    if (Math.random() < PESEE_SANS_PLAQUE_PROB) {
      const poids = rand(6000, 30000);
      await this.weighSequence(null, poids, null);
      this.addAnomalie(
        "PeseeSansPlaque",
        `Pesée de ${fmtKg(poids)} kg détectée sans lecture de plaque associée.`
      );
      this.broadcast();
      return;
    }

    const plaque = randomPlate();
    const openForPlate = [...this.passages.values()].find(
      (p) => p.plaque === plaque && p.statut === "SurSite"
    );

    // Rare anomaly: an exit plate read with no matching open entry.
    if (!openForPlate && Math.random() < SORTIE_SANS_ENTREE_PROB) {
      await this.readPlate("Sortie", plaque);
      const poids = rand(6000, 32000);
      await this.weighSequence("Sortie", poids, plaque);
      const id = randomUUID();
      this.passages.set(id, {
        id,
        plaque,
        entree_horodatage: null,
        sortie_horodatage: Date.now(),
        poids_entree: null,
        poids_sortie: fmtKg(poids),
        poids_net: null,
        duree_ms: null,
        operation: null,
        statut: "AnomalieSortieSansEntree",
        remarque: "Aucune entrée enregistrée pour cette plaque.",
        overstayAlerted: false,
      });
      this.addAnomalie(
        "SortieSansEntree",
        `Sortie détectée pour ${plaque} sans entrée correspondante enregistrée.`,
        id
      );
      this.broadcast();
      return;
    }

    if (openForPlate) {
      // This plate is already on site -> this cycle is its exit.
      await this.readPlate("Sortie", plaque);
      const operation = openForPlate.operation_planned;
      const poidsSortie =
        operation === "Livraison"
          ? openForPlate.poids_entree - rand(6000, 16000)
          : openForPlate.poids_entree + rand(6000, 16000);
      await this.weighSequence("Sortie", poidsSortie, plaque);

      const sortie = Date.now();
      openForPlate.sortie_horodatage = sortie;
      openForPlate.poids_sortie = fmtKg(poidsSortie);
      openForPlate.poids_net = fmtKg(Math.abs(poidsSortie - openForPlate.poids_entree));
      openForPlate.duree_ms = sortie - openForPlate.entree_horodatage;
      openForPlate.operation = operation;
      openForPlate.statut = "Sorti";
      this.log(
        "Sortie",
        `${plaque} — sortie confirmée, poids net ${(openForPlate.poids_net / 1000).toFixed(
          2
        )} t, durée ${Math.round(openForPlate.duree_ms / 1000)}s.`
      );
      this.pruneOldPassages();
      this.broadcast();
      return;
    }

    // Normal case: a brand new truck entering.
    await this.readPlate("Entree", plaque);
    const operation = Math.random() < 0.5 ? "Livraison" : "Enlevement";
    const poidsEntree =
      operation === "Livraison" ? rand(18000, 34000) : rand(6000, 14000);
    await this.weighSequence("Entree", poidsEntree, plaque);

    const id = randomUUID();
    const entree = Date.now();
    this.passages.set(id, {
      id,
      plaque,
      entree_horodatage: entree,
      sortie_horodatage: null,
      poids_entree: fmtKg(poidsEntree),
      poids_sortie: null,
      poids_net: null,
      duree_ms: null,
      operation: null,
      operation_planned: operation,
      statut: "SurSite",
      remarque: "",
      overstayAlerted: false,
    });
    this.log("Entree", `${plaque} — entrée enregistrée, poids ${fmtKg(poidsEntree)} kg.`);
    this.broadcast();

    // Schedule its exit as an independent future cycle so several trucks can
    // be on site concurrently.
    const dwell = rand(DWELL_MIN_MS, DWELL_MAX_MS);
    const t = setTimeout(() => {
      this.exitTruck(plaque).catch((err) => console.error("exit error", err));
    }, dwell);
    this.timers.push(t);
  }

  async exitTruck(plaque) {
    const passage = [...this.passages.values()].find(
      (p) => p.plaque === plaque && p.statut === "SurSite"
    );
    if (!passage) return; // already exited via another path
    await this.readPlate("Sortie", plaque);
    const operation = passage.operation_planned;
    const poidsSortie =
      operation === "Livraison"
        ? passage.poids_entree - rand(6000, 16000)
        : passage.poids_entree + rand(6000, 16000);
    await this.weighSequence("Sortie", poidsSortie, plaque);

    const sortie = Date.now();
    passage.sortie_horodatage = sortie;
    passage.poids_sortie = fmtKg(poidsSortie);
    passage.poids_net = fmtKg(Math.abs(poidsSortie - passage.poids_entree));
    passage.duree_ms = sortie - passage.entree_horodatage;
    passage.operation = operation;
    passage.statut = "Sorti";
    this.log(
      "Sortie",
      `${plaque} — sortie confirmée, poids net ${(passage.poids_net / 1000).toFixed(
        2
      )} t, durée ${Math.round(passage.duree_ms / 1000)}s.`
    );
    this.pruneOldPassages();
    this.broadcast();
  }

  async readPlate(sens, plaque) {
    const { read, mangled } = maybeMangle(plaque);
    const fiabilite = mangled ? rand(72, 91) : rand(93, 99);
    this.lastLecture = {
      id: randomUUID(),
      horodatage: Date.now(),
      sens,
      plaque_lue: read,
      plaque_corrigee: mangled ? plaque : null,
      fiabilite,
    };
    if (mangled) {
      this.log(
        "OCR",
        `Plaque lue « ${read} » : erreur de lecture corrigée automatiquement en « ${plaque} » par rapprochement.`
      );
    } else {
      this.log(sens, `${sens === "Entree" ? "Entrée" : "Sortie"} détectée — plaque ${plaque}.`);
    }
    this.broadcast();
    await sleep(600);
  }

  pruneOldPassages() {
    if (this.passages.size <= MAX_PASSAGES_KEPT) return;
    const sorted = [...this.passages.values()].sort(
      (a, b) => (a.entree_horodatage || 0) - (b.entree_horodatage || 0)
    );
    const toRemove = sorted.slice(0, sorted.length - MAX_PASSAGES_KEPT);
    for (const p of toRemove) this.passages.delete(p.id);
  }

  // ---- derived views ----
  isToday(ts) {
    if (!ts) return false;
    const d = new Date(ts);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }

  snapshot() {
    const all = [...this.passages.values()];
    const today = all.filter(
      (p) => this.isToday(p.entree_horodatage) || this.isToday(p.sortie_horodatage)
    );
    const camionsSurSite = all
      .filter((p) => p.statut === "SurSite")
      .sort((a, b) => b.entree_horodatage - a.entree_horodatage);
    const passagesDuJour = today
      .slice()
      .sort((a, b) => (b.sortie_horodatage || b.entree_horodatage || 0) - (a.entree_horodatage || 0))
      .slice(0, 50);

    const closedToday = today.filter((p) => p.statut === "Sorti");
    const entreesDuJour = today.filter((p) => this.isToday(p.entree_horodatage)).length;
    const sortiesDuJour = today.filter((p) => this.isToday(p.sortie_horodatage)).length;
    const dureeMoyenneMs = closedToday.length
      ? closedToday.reduce((sum, p) => sum + (p.duree_ms || 0), 0) / closedToday.length
      : 0;
    const tonnageNetDuJour = closedToday.reduce((sum, p) => sum + (p.poids_net || 0), 0) / 1000;
    const anomaliesToday = this.anomalies.filter((a) => this.isToday(a.horodatage));

    const hourly = Array.from({ length: 17 }, (_, i) => ({ heure: i + 5, entrees: 0 }));
    for (const p of today) {
      if (!this.isToday(p.entree_horodatage)) continue;
      const h = new Date(p.entree_horodatage).getHours();
      const bucket = hourly.find((b) => b.heure === h);
      if (bucket) bucket.entrees += 1;
    }

    return {
      kpis: {
        camionsSurSite: camionsSurSite.length,
        entreesDuJour,
        sortiesDuJour,
        dureeMoyenneSec: Math.round(dureeMoyenneMs / 1000),
        tonnageNetDuJour: Number(tonnageNetDuJour.toFixed(1)),
        anomalies: anomaliesToday.length,
      },
      pont: this.pont,
      lastLecture: this.lastLecture,
      camionsSurSite,
      passagesDuJour,
      hourly,
      journal: this.journal.slice(0, 30),
      anomalies: this.anomalies.slice(0, 20),
      overstayThresholdSec: Math.round(OVERSTAY_THRESHOLD_MS / 1000),
      serverTime: Date.now(),
    };
  }

  getHistory({ from, to, plaque } = {}) {
    let list = [...this.passages.values()];
    if (plaque) {
      const needle = plaque.trim().toUpperCase();
      list = list.filter((p) => p.plaque.toUpperCase().includes(needle));
    }
    if (from) {
      const fromTs = new Date(from).getTime();
      list = list.filter((p) => (p.entree_horodatage || p.sortie_horodatage || 0) >= fromTs);
    }
    if (to) {
      const toTs = new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1;
      list = list.filter((p) => (p.entree_horodatage || p.sortie_horodatage || 0) <= toTs);
    }
    list.sort((a, b) => (b.entree_horodatage || b.sortie_horodatage || 0) - (a.entree_horodatage || a.sortie_horodatage || 0));
    const totalNetTonnes = list.reduce((sum, p) => sum + (p.poids_net || 0), 0) / 1000;
    return { passages: list, count: list.length, totalNetTonnes: Number(totalNetTonnes.toFixed(1)) };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
