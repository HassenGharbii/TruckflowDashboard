export default function AlertToast({ alert, onDismiss }) {
  if (!alert) return null;
  return (
    <div className="alert-toast">
      <span className="alert-icon">⚠</span>
      <div>
        <strong>Alerte {alert.type === "DureeDepassee" ? "durée dépassée" : alert.type}</strong>
        <div style={{ marginTop: 4 }}>{alert.details}</div>
      </div>
      <button onClick={onDismiss}>✕</button>
    </div>
  );
}
