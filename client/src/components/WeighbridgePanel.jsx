import { fmtKg } from "../format";

const MAX_SCALE_KG = 60000;
const R = 90;
const CX = 110;
const CY = 110;
const CIRC = 2 * Math.PI * R;
const ARC = CIRC * 0.75; // 270° gauge

const STATE_LABEL = {
  PontLibre: "Pont libre",
  PeseeEnCours: "Pesée en cours...",
  PoidsStable: "Poids stable",
};
const STATE_CLASS = {
  PontLibre: "libre",
  PeseeEnCours: "encours",
  PoidsStable: "stable",
};
const STATE_COLOR = {
  PontLibre: "var(--text-faint)",
  PeseeEnCours: "var(--orange)",
  PoidsStable: "var(--green)",
};

export default function WeighbridgePanel({ pont }) {
  if (!pont) return null;
  const frac = Math.min(1, Math.max(0, pont.poids / MAX_SCALE_KG));
  const offset = ARC * (1 - frac);
  const color = STATE_COLOR[pont.etat];

  return (
    <div className="panel">
      <div className="panel-title">Pont-bascule — poids en direct</div>
      <div className="gauge-wrap">
        <svg className="gauge-svg" width="220" height="220" viewBox="0 0 220 220">
          <circle
            className="gauge-track"
            cx={CX}
            cy={CY}
            r={R}
            strokeWidth="14"
            strokeDasharray={`${ARC} ${CIRC}`}
            transform={`rotate(135 ${CX} ${CY})`}
          />
          <circle
            className="gauge-fill"
            cx={CX}
            cy={CY}
            r={R}
            strokeWidth="14"
            stroke={color}
            strokeDasharray={`${ARC} ${CIRC}`}
            strokeDashoffset={pont.etat === "PontLibre" ? ARC : offset}
            transform={`rotate(135 ${CX} ${CY})`}
            style={{ color }}
          />
          {/* scale ticks */}
          {[0, 20, 40, 60].map((t, i) => {
            const a = (135 + (i / 3) * 270) * (Math.PI / 180);
            const x1 = CX + (R - 16) * Math.cos(a);
            const y1 = CY + (R - 16) * Math.sin(a);
            const x2 = CX + (R - 24) * Math.cos(a);
            const y2 = CY + (R - 24) * Math.sin(a);
            return (
              <g key={t}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-faint)" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
        <div className="gauge-center">
          <div className="gauge-value">
            {pont.poids.toLocaleString("fr-FR")}
            <span className="gauge-unit">kg</span>
          </div>
          <div className={`weigh-state ${STATE_CLASS[pont.etat]}`} style={{ marginTop: 10 }}>
            {pont.etat === "PoidsStable" ? (
              "✓"
            ) : (
              <span className="pill-dot" />
            )}
            {STATE_LABEL[pont.etat]}
          </div>
        </div>
      </div>
    </div>
  );
}
