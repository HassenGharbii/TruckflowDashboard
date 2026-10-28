import KpiStrip from "./KpiStrip";
import WeighbridgePanel from "./WeighbridgePanel";
import PlateReadPanel from "./PlateReadPanel";
import OnSiteTable from "./OnSiteTable";
import PassagesTable from "./PassagesTable";
import HourlyChart from "./HourlyChart";
import EventLog from "./EventLog";

export default function TempsReel({ state }) {
  if (!state) {
    return <p className="loading-msg">Connexion au serveur local...</p>;
  }
  return (
    <>
      <KpiStrip kpis={state.kpis} />
      <div className="main-grid">
        <div className="left-col">
          <WeighbridgePanel pont={state.pont} />
          <PlateReadPanel lastLecture={state.lastLecture} />
        </div>
        <div className="right-col">
          <OnSiteTable camions={state.camionsSurSite} overstayThresholdSec={state.overstayThresholdSec} />
          <PassagesTable passages={state.passagesDuJour} />
        </div>
      </div>
      <div className="bottom-grid">
        <HourlyChart hourly={state.hourly} />
        <EventLog journal={state.journal} />
      </div>
    </>
  );
}
