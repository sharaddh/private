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
    <div className="bg-th-surface rounded-[8px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-th-text">Sales Trend</h3>
          <p className="text-[13px] text-th-secondary mt-0.5">Last 30 days</p>
        </div>
        <span className={`text-[12px] font-medium px-2 py-0.5 rounded-lg ${trendUp ? "text-[#1ed760] bg-[#1ed760]/10" : "text-[#e91429] bg-[#e91429]/10"}`}>{chartTrend === "N/A" ? "NEW" : `${trendUp ? "+" : ""}${chartTrend}%`}</span>
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
                border: "none",
                background: "var(--bg-hover)",
                color: "var(--text-base)",
                boxShadow: "var(--shadow-elevated)",
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
    <div className="bg-th-surface rounded-[8px] p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-bold text-th-text">Order Status</h3>
          <p className="text-[13px] text-th-secondary mt-0.5">{total} total</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-36 w-36 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={28} outerRadius={58} paddingAngle={3}>
                {data.map((d, i) => <Cell key={d.status || i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => [Number(value), "Orders"]} contentStyle={{
                fontSize: 13, borderRadius: 8,
                border: "none",
                background: "var(--bg-hover)",
                color: "var(--text-base)",
                boxShadow: "var(--shadow-elevated)",
              }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.status} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="font-medium text-th-secondary">{d.status}</span>
              <span className="text-th-muted ml-auto">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
