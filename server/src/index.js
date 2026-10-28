import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { Engine } from "./engine.js";
import { TruckflowEngine } from "./truckflowEngine.js";
import { passagesToCsv } from "./csv.js";
import { truckflowEnabled } from "./adapters/truckflowDb.js";
import {
  fetchRecentTickets,
  fetchOpenWeighings,
  fetchRecentAccessEvents,
} from "./adapters/truckflowAdapter.js";

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

// DATA_SOURCE=truckflow: the simulator never starts at all, only the real
// DB-backed engine runs. DATA_SOURCE=simulator (default): the reverse.
const engine = truckflowEnabled ? new TruckflowEngine(broadcast) : new Engine(broadcast);

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "snapshot", data: engine.snapshot() }));
});

app.get("/api/state", (req, res) => {
  res.json(engine.snapshot());
});

app.get("/api/history", async (req, res) => {
  try {
    const { from, to, plaque } = req.query;
    res.json(await engine.getHistory({ from, to, plaque }));
  } catch (err) {
    console.error("history error", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/history/export", async (req, res) => {
  try {
    const { from, to, plaque } = req.query;
    const { passages } = await engine.getHistory({ from, to, plaque });
    const csv = passagesToCsv(passages);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="historique_passages.csv"');
    res.send(csv);
  } catch (err) {
    console.error("history export error", err);
    res.status(500).json({ error: err.message });
  }
});

// Manual "Sortie" action from the on-site table — only meaningful for the
// simulator (forces its dwell timer). Never write to the real TruckFlowDB.
app.post("/api/camions/:plaque/sortie", (req, res) => {
  if (truckflowEnabled) {
    return res.status(400).json({ error: "Not available in truckflow mode (read-only by design)." });
  }
  engine.exitTruck(req.params.plaque).catch((err) => console.error("force exit error", err));
  res.json({ ok: true });
});

// --- Real Truckflow DB endpoints (DATA_SOURCE=truckflow) ---
// Separate from the simulator above: these read live production data from
// TruckFlowDB and never touch the in-memory Engine.
function requireTruckflow(req, res, next) {
  if (!truckflowEnabled) {
    return res.status(400).json({
      error: "DATA_SOURCE is not 'truckflow'. Set it in server/.env (see .env.example).",
    });
  }
  next();
}

app.get("/api/truckflow/tickets", requireTruckflow, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const tickets = await fetchRecentTickets(limit);
    res.json({ tickets, count: tickets.length });
  } catch (err) {
    console.error("truckflow tickets error", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/truckflow/on-site", requireTruckflow, async (req, res) => {
  try {
    const weighings = await fetchOpenWeighings();
    res.json({ weighings, count: weighings.length });
  } catch (err) {
    console.error("truckflow on-site error", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/truckflow/access-events", requireTruckflow, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const events = await fetchRecentAccessEvents(limit);
    res.json({ events, count: events.length });
  } catch (err) {
    console.error("truckflow access-events error", err);
    res.status(500).json({ error: err.message });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Pont-bascule demo server listening on http://localhost:${PORT}`);
  engine.start();
});
