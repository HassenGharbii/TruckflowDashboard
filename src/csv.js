function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("fr-FR");
}

function fmtDuree(ms) {
  if (!ms && ms !== 0) return "";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

function escapeCsv(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const HEADERS = [
  "Plaque",
  "Entree",
  "Sortie",
  "Duree",
  "Poids entree (kg)",
  "Poids sortie (kg)",
  "Net (kg)",
  "Operation",
  "Statut",
  "Remarque",
];

export function passagesToCsv(passages) {
  const rows = passages.map((p) => [
    p.plaque,
    fmtDate(p.entree_horodatage),
    fmtDate(p.sortie_horodatage),
    fmtDuree(p.duree_ms),
    p.poids_entree ?? "",
    p.poids_sortie ?? "",
    p.poids_net ?? "",
    p.operation ?? "",
    p.statut,
    p.remarque ?? "",
  ]);
  const lines = [HEADERS, ...rows].map((row) => row.map(escapeCsv).join(";"));
  return "﻿" + lines.join("\r\n");
}
