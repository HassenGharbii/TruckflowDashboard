import { fmtTime } from "../format";
import Truck3D from "./Truck3D";

export default function PlateReadPanel({ lastLecture }) {
  return (
    <div className="panel">
      <div className="panel-title">Dernière lecture de plaque</div>
      <Truck3D plate={lastLecture?.plaque_lue} sens={lastLecture?.sens} />
      {!lastLecture ? (
        <p className="plate-waiting">En attente d'un passage...</p>
      ) : (
        <div className="plate-meta-block">
          <span className={`sens-chip ${lastLecture.sens}`}>
            {lastLecture.sens === "Entree" ? "Entrée" : "Sortie"}
          </span>
          <div className="row">
            <span>Plaque</span>
            <span className="plate-value">{lastLecture.plaque_lue}</span>
          </div>
          <div className="row">
            <span>Heure</span>
            <span>{fmtTime(lastLecture.horodatage)}</span>
          </div>
          {lastLecture.fiabilite != null && (
            <div className="row">
              <span>Fiabilité OCR</span>
              <span>{lastLecture.fiabilite}%</span>
            </div>
          )}
          {lastLecture.plaque_corrigee && (
            <div className="row">
              <span>Corrigée en</span>
              <span>{lastLecture.plaque_corrigee}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
