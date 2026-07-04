import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const DONUT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function SalesTrendChart({ data }: { data: { date: string; total: number }[] }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Sales Trend</h3>
          <p className="text-xs text-white/40 mt-0.5">Last 30 days</p>
        </div>
        <span className="text-xs font-medium text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">+12%</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="salesGradientDark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip
              labelFormatter={(label) => formatDateLabel(label)}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, "Sales"]}
              contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.95)", color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
            />
            <Area type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={2} fill="url(#salesGradientDark)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function OrderStatusDonut({ data }: { data: { status: string; count: number }[] }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-lg h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Order Status</h3>
          <p className="text-xs text-white/40 mt-0.5">{total} total</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-36 w-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={28} outerRadius={58} paddingAngle={3}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => [value, "Orders"]} contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,23,42,0.95)", color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.status} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="font-medium text-white/70">{d.status}</span>
              <span className="text-white/40 ml-auto">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
