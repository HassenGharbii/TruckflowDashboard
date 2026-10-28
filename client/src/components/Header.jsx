import { useEffect, useState } from "react";

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <div className="clock-time">{now.toLocaleTimeString("fr-FR")}</div>
      <div className="clock-date">
        {now.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
      </div>
    </div>
  );
}

export default function Header({ tab, onTab, connected }) {
  return (
    <header className="app-header">
      <div className="logo-chip">PB</div>
      <div className="app-title">
        <h1>Pont-bascule — Démonstration</h1>
        <p>Pesée + lecture de plaques (LAPI)</p>
      </div>
      <div className="tabs">
        <button className={tab === "temps-reel" ? "active" : ""} onClick={() => onTab("temps-reel")}>
          Temps réel
        </button>
        <button className={tab === "historique" ? "active" : ""} onClick={() => onTab("historique")}>
          Historique
        </button>
      </div>
      <div className="status-chips">
        <span className="status-chip">
          <span className={`dot ${connected ? "" : "off"}`} /> Caméra entrée
        </span>
        <span className="status-chip">
          <span className={`dot ${connected ? "" : "off"}`} /> Caméra sortie
        </span>
        <span className="status-chip">
          <span className={`dot ${connected ? "" : "off"}`} /> Indicateur pesage
        </span>
      </div>
      <Clock />
    </header>
  );
}
