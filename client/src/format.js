export function fmtKg(v) {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("fr-FR")} kg`;
}

export function fmtTonnes(v) {
  if (v === null || v === undefined) return "—";
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} t`;
}

export function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function fmtDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDurationMs(ms) {
  if (ms === null || ms === undefined) return "—";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function fmtDurationSec(sec) {
  return fmtDurationMs(sec * 1000);
}

export function liveDuration(entreeTs, now) {
  if (!entreeTs) return "—";
  return fmtDurationMs((now ?? Date.now()) - entreeTs);
}

export const STATUT_LABELS = {
  SurSite: "Sur site",
  Sorti: "Sorti",
  AnomalieSortieSansEntree: "⚠ Sortie sans entrée",
};
