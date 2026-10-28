import { fmtDurationMs, fmtKg, fmtTime, STATUT_LABELS } from "../format";

function statutBadge(statut) {
  if (statut === "SurSite") return <span className="badge sursite">Sur site</span>;
  if (statut === "Sorti") return <span className="badge sorti">Sorti</span>;
  return <span className="badge anomalie">{STATUT_LABELS[statut] || statut}</span>;
}

export default function PassagesTable({ passages }) {
  return (
    <div className="panel">
      <div className="panel-title">Passages du jour</div>
      <div className="table-scroll">
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
            </tr>
          </thead>
          <tbody>
            {(!passages || passages.length === 0) && (
              <tr className="empty-row">
                <td colSpan={9}>Aucun passage aujourd'hui.</td>
              </tr>
            )}
            {passages?.map((p) => (
              <tr key={p.id}>
                <td>{p.plaque}</td>
                <td>{fmtTime(p.entree_horodatage)}</td>
                <td>{fmtTime(p.sortie_horodatage)}</td>
                <td>{fmtDurationMs(p.duree_ms)}</td>
                <td>{fmtKg(p.poids_entree)}</td>
                <td>{fmtKg(p.poids_sortie)}</td>
                <td>{fmtKg(p.poids_net)}</td>
                <td>{p.operation || "—"}</td>
                <td>{statutBadge(p.statut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
