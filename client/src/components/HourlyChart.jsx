import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function HourlyChart({ hourly }) {
  const data = hourly || [];
  const max = Math.max(1, ...data.map((d) => d.entrees));
  return (
    <div className="panel">
      <div className="panel-title">Entrées par heure — aujourd'hui</div>
      <div className="chart-area">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,140,180,0.1)" vertical={false} />
            <XAxis
              dataKey="heure"
              tickFormatter={(h) => `${h}h`}
              fontSize={11}
              stroke="#5b6678"
              tickLine={false}
              axisLine={{ stroke: "rgba(120,140,180,0.2)" }}
            />
            <YAxis
              allowDecimals={false}
              fontSize={11}
              stroke="#5b6678"
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "rgba(56,189,248,0.08)" }}
              formatter={(v) => [v, "Entrées"]}
              labelFormatter={(h) => `${h}h - ${h + 1}h`}
              contentStyle={{
                fontSize: 12,
                background: "#141a26",
                border: "1px solid rgba(120,140,180,0.28)",
                borderRadius: 10,
                color: "#e8edf6",
              }}
            />
            <Bar dataKey="entrees" radius={[5, 5, 0, 0]} maxBarSize={34}>
              {data.map((d, i) => (
                <Cell key={i} fill="url(#barGrad)" opacity={d.entrees === max && max > 0 ? 1 : 0.78} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
