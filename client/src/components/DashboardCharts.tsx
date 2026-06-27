import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function SalesTrendChart({ data }: { data: { date: string; total: number }[] }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Daily Sales (Last 30 Days)</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(label) => formatDateLabel(label)}
              formatter={(value: number) => [`₹${value.toLocaleString()}`, "Sales"]}
              contentStyle={{ fontSize: 13, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PaymentModeChart({ data }: { data: { mode: string; total: number; count: number }[] }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Today's Payment Modes</h3>
      <div className="flex items-center gap-4">
        <div className="h-40 w-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="mode" cx="50%" cy="50%" innerRadius={28} outerRadius={60} paddingAngle={3}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, "Amount"]} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={d.mode} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="font-semibold text-gray-700 dark:text-gray-300">{d.mode}</span>
              <span className="text-gray-400 ml-auto">₹{d.total.toLocaleString()}</span>
              <span className="text-gray-400">({d.count})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrderStatusChart({ data }: { data: { status: string; count: number }[] }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Order Status Distribution</h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(value: number) => [value, "Orders"]} contentStyle={{ fontSize: 13, borderRadius: 8 }} />
            <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
