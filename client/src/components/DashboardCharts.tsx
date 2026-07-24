import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, CartesianGrid, Legend, ComposedChart, Line,
} from "recharts";

const DONUT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const PAYMENT_COLORS: Record<string, string> = {
  Cash: "#10b981", UPI: "#6366f1", Card: "#f59e0b", "Bank Transfer": "#06b6d4",
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const tooltipStyle = {
  fontSize: 14,
  borderRadius: 8,
  border: "none",
  background: "var(--bg-hover, #1a1a2e)",
  color: "var(--text-base, #e4e4e7)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

// ─── Sales Trend (Area) ──────────────────────────────────────────────────────

export function SalesTrendChart({ data, dark }: { data: { date: string; total: number }[]; dark?: boolean }) {
  if (!data || data.length === 0) return null;
  const recent7 = data.slice(-7).reduce((s, d) => s + d.total, 0);
  const prev7 = data.slice(-14, -7).reduce((s, d) => s + d.total, 0);
  const chartTrend = !prev7 && recent7 > 0 ? "N/A" : prev7 > 0 ? ((recent7 - prev7) / prev7 * 100).toFixed(1) : "0";
  const trendUp = chartTrend === "N/A" ? true : Number(chartTrend) >= 0;
  void dark;
  return (
    <div className="bg-th-surface rounded-xl p-3 sm:p-5 shadow-md h-full">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h3 className="text-[14px] sm:text-[17px] font-bold text-th-text uppercase tracking-wider">Sales Trend</h3>
          <p className="text-[12px] sm:text-[15px] text-th-secondary mt-0.5">Last 30 days</p>
        </div>
        <span className={`text-[12px] sm:text-[14px] font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg ${trendUp ? "text-[#1ed760] bg-[#1ed760]/10" : "text-[#e91429] bg-[#e91429]/10"}`}>
          {chartTrend === "N/A" ? "NEW" : `${trendUp ? "+" : ""}${chartTrend}%`}
        </span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 12, fill: "rgba(107,114,128,0.6)" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip labelFormatter={(label) => formatDateLabel(label)} formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Sales"]} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="total" stroke="#818cf8" strokeWidth={2.5} fill="url(#salesGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Order Status Donut ──────────────────────────────────────────────────────

export function OrderStatusDonut({ data, dark }: { data: { status: string; count: number }[]; dark?: boolean }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  void dark;
  return (
    <div className="bg-th-surface rounded-xl p-3 sm:p-5 shadow-md h-full">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h3 className="text-[14px] sm:text-[17px] font-bold text-th-text uppercase tracking-wider">Order Status</h3>
          <p className="text-[12px] sm:text-[15px] text-th-secondary mt-0.5">{total} total orders</p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="h-28 w-28 sm:h-40 sm:w-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={20} outerRadius={40} paddingAngle={3}>
                {data.map((d, i) => <Cell key={d.status || i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value) => [Number(value), "Orders"]} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 sm:space-y-2">
          {data.map((d, i) => (
            <div key={`${d.status}-${i}`} className="flex items-center gap-1.5 sm:gap-2">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-[12px] sm:text-[14px] font-medium text-th-secondary flex-1 truncate">{d.status}</span>
              <span className="text-[12px] sm:text-[14px] font-bold text-th-text">{d.count}</span>
              <span className="text-[10px] sm:text-[12px] text-th-muted">{total > 0 ? Math.round((d.count / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Payment Mode Bar Chart ──────────────────────────────────────────────────

export function PaymentModeBarChart({ data, dark }: { data: { mode: string; total: number; count: number }[]; dark?: boolean }) {
  if (!data || data.length === 0) return null;
  void dark;
  const chartData = data.map((d) => ({
    ...d,
    label: d.mode,
    fill: PAYMENT_COLORS[d.mode] || "#1ed760",
  }));

  return (
    <div className="bg-th-surface rounded-xl p-3 sm:p-5 shadow-md h-full">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h3 className="text-[14px] sm:text-[17px] font-bold text-th-text uppercase tracking-wider">Payment Modes</h3>
          <p className="text-[12px] sm:text-[15px] text-th-secondary mt-0.5">This month</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(107,114,128,0.15)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip formatter={(value, name) => [name === "total" ? `₹${Number(value).toLocaleString()}` : value, name === "total" ? "Amount" : "Count"]} contentStyle={tooltipStyle} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Sales vs Collection (Composed Chart) ────────────────────────────────────

export function SalesVsCollectionChart({ salesData, collectionData, dark }: {
  salesData: { date: string; total: number }[];
  collectionData: { date: string; total: number }[];
  dark?: boolean;
}) {
  if (!salesData || salesData.length === 0) return null;
  void dark;

  const collectionMap = new Map(collectionData.map((c) => [c.date, c.total]));
  const merged = salesData.map((s) => ({
    date: s.date,
    sales: s.total,
    collection: collectionMap.get(s.date) || 0,
  }));

  return (
    <div className="bg-th-surface rounded-xl p-5 shadow-md h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[17px] font-bold text-th-text uppercase tracking-wider">Sales vs Collection</h3>
          <p className="text-[15px] text-th-secondary mt-0.5">Last 30 days</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-[#6366f1]" />
          <span className="text-[13px] text-th-secondary">Sales</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-[#1ed760]" />
          <span className="text-[13px] text-th-secondary">Collection</span>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="collGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1ed760" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#1ed760" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(107,114,128,0.15)" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11, fill: "rgba(107,114,128,0.6)" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
            <Tooltip labelFormatter={(label) => formatDateLabel(label)} formatter={(value, name) => [`₹${Number(value).toLocaleString()}`, name === "sales" ? "Sales" : "Collection"]} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="sales" stroke="#818cf8" strokeWidth={2} fill="rgba(99,102,241,0.1)" />
            <Line type="monotone" dataKey="collection" stroke="#1ed760" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Weekly Orders Bar Chart ─────────────────────────────────────────────────

export function WeeklyOrdersChart({ data, dark }: {
  data: { date: string; count: number }[];
  dark?: boolean;
}) {
  if (!data || data.length === 0) return null;
  void dark;

  const chartData = data.map((d) => ({
    date: d.date,
    day: formatDateLabel(d.date),
    orders: d.count,
  }));

  return (
    <div className="bg-th-surface rounded-xl p-5 shadow-md h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[17px] font-bold text-th-text uppercase tracking-wider">Daily Orders</h3>
          <p className="text-[15px] text-th-secondary mt-0.5">Last 30 days</p>
        </div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(107,114,128,0.15)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "rgba(107,114,128,0.6)" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(value) => [Number(value), "Orders"]} contentStyle={tooltipStyle} />
            <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Inventory Category Pie ──────────────────────────────────────────────────

export function CategoryPieChart({ data, dark }: {
  data: { category: string; count: number; totalValue: number }[];
  dark?: boolean;
}) {
  if (!data || data.length === 0) return null;
  void dark;
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="bg-th-surface rounded-xl p-5 shadow-md h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[17px] font-bold text-th-text uppercase tracking-wider">Inventory Split</h3>
          <p className="text-[15px] text-th-secondary mt-0.5">{total} items</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-40 w-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="category" cx="50%" cy="50%" innerRadius={26} outerRadius={54} paddingAngle={3}>
                {data.map((d, i) => <Cell key={d.category || i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [Number(value), "Items"]} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.slice(0, 5).map((d, i) => (
            <div key={`${d.category}-${i}`} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-[14px] font-medium text-th-secondary flex-1 truncate">{d.category}</span>
              <span className="text-[14px] font-bold text-th-text">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
