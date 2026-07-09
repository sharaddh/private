import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const DONUT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function SalesTrendChart({ data, dark }: { data: { date: string; total: number }[]; dark?: boolean }) {
  if (!data || data.length === 0) return null;
  const recent7 = data.slice(-7).reduce((s, d) => s + d.total, 0);
  const prev7 = data.slice(-14, -7).reduce((s, d) => s + d.total, 0);
  const chartTrend = !prev7 && recent7 > 0 ? "N/A" : prev7 > 0 ? ((recent7 - prev7) / prev7 * 100).toFixed(1) : "0";
  const trendUp = chartTrend === "N/A" ? true : Number(chartTrend) >= 0;
  return (
    <div className={`bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md border rounded-2xl p-5 transition-shadow duration-300`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sales Trend</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Last 30 days</p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${trendUp ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-800" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-800"}`}>{chartTrend === "N/A" ? "NEW" : `${trendUp ? "+" : ""}${chartTrend}%`}</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11, fill: "rgba(107,114,128,0.6)" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip
              labelFormatter={(label) => formatDateLabel(label)}
              formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Sales"]}
              contentStyle={{
                fontSize: 13, borderRadius: 8,
                border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
                background: dark ? "rgba(15,23,42,0.95)" : "#fff",
                color: dark ? "#fff" : "#111",
                boxShadow: dark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 4px 20px rgba(0,0,0,0.08)",
              }}
            />
            <Area type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={2} fill="url(#salesGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function OrderStatusDonut({ data, dark }: { data: { status: string; count: number }[]; dark?: boolean }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  void dark;
  return (
    <div className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md border rounded-2xl p-5 transition-shadow duration-300 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Order Status</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{total} total</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-36 w-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={28} outerRadius={58} paddingAngle={3}>
                {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => [Number(value), "Orders"]} contentStyle={{
                fontSize: 13, borderRadius: 8,
                border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
                background: dark ? "rgba(15,23,42,0.95)" : "#fff",
                color: dark ? "#fff" : "#111",
              }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.status} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="font-medium text-slate-700 dark:text-slate-300">{d.status}</span>
              <span className="text-slate-400 dark:text-slate-500 ml-auto">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
