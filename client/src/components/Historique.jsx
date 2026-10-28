import { useEffect, useState } from "react";
import { fmtDurationMs, fmtKg, fmtTime, fmtTonnes, STATUT_LABELS } from "../format";

function buildQuery({ from, to, plaque }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (plaque) params.set("plaque", plaque);
  return params.toString();
}

export default function Historique() {
  const [filters, setFilters] = useState({ from: "", to: "", plaque: "" });
  const [result, setResult] = useState({ passages: [], count: 0, totalNetTonnes: 0 });
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?${buildQuery(filters)}`);
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportCsv() {
    window.location.href = `/api/history/export?${buildQuery(filters)}`;
  }

  return (
    <div className="panel">
      <div className="panel-title">Historique des passages</div>
      <div className="filters-row">
        <div className="field">
          <label>Du</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Au</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Plaque</label>
          <input
            type="text"
            placeholder="AB-123-CD"
            value={filters.plaque}
            onChange={(e) => setFilters((f) => ({ ...f, plaque: e.target.value }))}
          />
        </div>
        <button className="btn primary" onClick={search} disabled={loading}>
          Rechercher
        </button>
        <button className="btn" onClick={exportCsv}>
          Exporter CSV (Excel)
        </button>
        <span className="result-count">
          {result.count} passage(s) · {fmtTonnes(result.totalNetTonnes)} net
        </span>
      </div>

      <div className="table-scroll" style={{ marginTop: 14, maxHeight: 560 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Plaque</th>
              <th>Entrée</th>
              <th>Sortie</th>
              <th>Durée</th>
              <th>Poids entrée</th>
              <th>Poids sortie</th>
              <th>Net</th>
              <th>Opération</th>
              <th>Statut</th>
              <th>Remarque</th>
            </tr>
          </thead>
          <tbody>
            {result.passages.length === 0 && (
              <tr className="empty-row">
                <td colSpan={10}>Aucun résultat pour ces critères.</td>
              </tr>
            )}
            {result.passages.map((p) => (
              <tr key={p.id}>
                <td>{p.plaque}</td>
                <td>{fmtTime(p.entree_horodatage)}</td>
                <td>{fmtTime(p.sortie_horodatage)}</td>
                <td>{fmtDurationMs(p.duree_ms)}</td>
                <td>{fmtKg(p.poids_entree)}</td>
                <td>{fmtKg(p.poids_sortie)}</td>
                <td>{fmtKg(p.poids_net)}</td>
                <td>{p.operation || "—"}</td>
                <td>{STATUT_LABELS[p.statut] || p.statut}</td>
                <td>{p.remarque || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
