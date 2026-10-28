import { fmtDurationSec, fmtTonnes } from "../format";

export default function KpiStrip({ kpis }) {
  if (!kpis) return null;
  const tiles = [
    { label: "Camions sur site", value: kpis.camionsSurSite, icon: "🚚" },
    { label: "Entrées du jour", value: kpis.entreesDuJour, icon: "↘" },
    { label: "Sorties du jour", value: kpis.sortiesDuJour, icon: "↗" },
    { label: "Durée moyenne sur site", value: fmtDurationSec(kpis.dureeMoyenneSec), icon: "⏱" },
    { label: "Tonnage net du jour", value: fmtTonnes(kpis.tonnageNetDuJour), icon: "⚖" },
    { label: "Anomalies", value: kpis.anomalies, icon: "⚠", danger: kpis.anomalies > 0 },
  ];
  return (
    <div className="kpi-strip">
      {tiles.map((t) => (
        <div key={t.label} className={`kpi-tile ${t.danger ? "danger" : ""}`}>
          <div className="kpi-head">
            <span className="kpi-icon">{t.icon}</span>
          </div>
          <div className="value">{t.value}</div>
          <div className="label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}
