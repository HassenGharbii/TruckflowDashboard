import { useEffect, useState } from "react";
import { fmtKg, fmtTime, liveDuration } from "../format";

export default function OnSiteTable({ camions, overstayThresholdSec }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function forceSortie(plaque) {
    fetch(`/api/camions/${encodeURIComponent(plaque)}/sortie`, { method: "POST" });
  }

  return (
    <div className="panel">
      <div className="panel-title">Camions sur site</div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Plaque</th>
              <th>Heure d'entrée</th>
              <th>Durée sur site</th>
              <th>Poids entrée</th>
              <th>État</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(!camions || camions.length === 0) && (
              <tr className="empty-row">
                <td colSpan={6}>Aucun camion sur site actuellement.</td>
              </tr>
            )}
            {camions?.map((c) => {
              const overstaying = (now - c.entree_horodatage) / 1000 > overstayThresholdSec;
              return (
                <tr key={c.id} className={overstaying ? "overstay" : ""}>
                  <td>{c.plaque}</td>
                  <td>{fmtTime(c.entree_horodatage)}</td>
                  <td>{liveDuration(c.entree_horodatage, now)}</td>
                  <td>{fmtKg(c.poids_entree)}</td>
                  <td>
                    {overstaying ? (
                      <span className="badge anomalie">⚠ Durée dépassée</span>
                    ) : c.poids_entree ? (
                      <span className="badge pese">Pesé</span>
                    ) : (
                      <span className="badge attente">En attente pesée</span>
                    )}
                  </td>
                  <td>
                    <button className="row-btn" onClick={() => forceSortie(c.plaque)}>
                      Sortie
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
