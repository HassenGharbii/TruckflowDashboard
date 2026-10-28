import { useState } from "react";
import "./App.css";
import Header from "./components/Header";
import TempsReel from "./components/TempsReel";
import Historique from "./components/Historique";
import AlertToast from "./components/AlertToast";
import { useLiveState } from "./useLiveState";

export default function App() {
  const [tab, setTab] = useState("temps-reel");
  const { state, connected, alert, dismissAlert } = useLiveState();

  return (
    <>
      <Header tab={tab} onTab={setTab} connected={connected} />
      <AlertToast alert={alert} onDismiss={dismissAlert} />
      <div className="app-body">
        {tab === "temps-reel" ? <TempsReel state={state} /> : <Historique />}
      </div>
    </>
  );
}
