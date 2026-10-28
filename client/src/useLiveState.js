import { useEffect, useRef, useState } from "react";

const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export function useLiveState() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [alert, setAlert] = useState(null);
  const alertTimer = useRef(null);

  useEffect(() => {
    let socket;
    let retryTimer;

    function connect() {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        retryTimer = setTimeout(connect, 1500);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "snapshot") setState(msg.data);
        if (msg.alert) {
          setAlert(msg.alert);
          clearTimeout(alertTimer.current);
          alertTimer.current = setTimeout(() => setAlert(null), 6000);
        }
      };
    }

    connect();
    return () => {
      clearTimeout(retryTimer);
      clearTimeout(alertTimer.current);
      socket && socket.close();
    };
  }, []);

  return { state, connected, alert, dismissAlert: () => setAlert(null) };
}
