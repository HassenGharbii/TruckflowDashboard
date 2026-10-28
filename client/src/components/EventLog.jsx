import { fmtTime } from "../format";

export default function EventLog({ journal }) {
  return (
    <div className="panel">
      <div className="panel-title">Journal des événements</div>
      <div className="journal-list">
        {(!journal || journal.length === 0) && (
          <p style={{ color: "var(--text-dim)" }}>Aucun événement pour le moment.</p>
        )}
        {journal?.map((e) => (
          <div className="journal-item" key={e.id}>
            <span className="journal-time">{fmtTime(e.horodatage)}</span>
            <span className={`journal-type ${e.type}`}>{e.type}</span>
            <span className="journal-msg">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
