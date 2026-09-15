import React from 'react';
import { TrendingUp, ShoppingBag, Wallet, Receipt, Clock } from 'lucide-react';

export const SalesDashboardCard = ({ d, uiT }) => {
  const metrics = [
    {
      label: uiT("Today's Sales", 'आज की बिक्री'),
      value: `₹${(d.todaySales || 0).toLocaleString()}`,
      icon: Wallet,
      accent: 'from-emerald-500/20 to-teal-500/0',
    },
    {
      label: uiT('Collection', 'संग्रह'),
      value: `₹${(d.todayCollection || 0).toLocaleString()}`,
      icon: Receipt,
      accent: 'from-blue-500/20 to-indigo-500/0',
    },
    {
      label: uiT('Orders', 'ऑर्डर'),
      value: d.todayOrders ?? 0,
      icon: ShoppingBag,
      accent: 'from-purple-500/20 to-violet-500/0',
    },
    {
      label: uiT('Pending', 'बाकी'),
      value: d.pendingBills?.length ?? 0,
      icon: Clock,
      accent: 'from-amber-500/20 to-orange-500/0',
    },
  ];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-violet-600/90 via-violet-700 to-indigo-900 p-4 sm:p-6 text-white shadow-xl backdrop-blur-md transition-all duration-500 hover:border-white/30 hover:shadow-2xl hover:shadow-violet-900/40">
      
      {/* Dynamic Glow Overlay on Card Hover */}
      <div className="pointer-events-none absolute -inset-full bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))] opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
      
      {/* Background Decorative Gradient Light */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl transition-all duration-700 group-hover:bg-emerald-400/20" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-2 md:gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <React.Fragment key={idx}>
                <div className="group/item relative flex-1 overflow-hidden rounded-xl bg-white/5 p-3 sm:p-4 backdrop-blur-sm border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:border-white/20 hover:shadow-lg">
                  {/* Subtle hover gradient wash per metric */}
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${metric.accent} opacity-0 transition-opacity duration-300 group-hover/item:opacity-100`} />
                  
                  <div className="relative z-10 flex items-center justify-between">
                    <p className="text-[10px] sm:text-[12px] font-semibold uppercase tracking-wider text-violet-200/80">
                      {metric.label}
                    </p>
                    <Icon className="h-3.5 w-3.5 text-violet-300/60 transition-transform duration-300 group-hover/item:scale-110 group-hover/item:text-white" />
                  </div>
                  
                  <p className="relative z-10 mt-1 text-lg sm:text-2xl font-bold tracking-tight text-white">
                    {metric.value}
                  </p>
                </div>

                {/* Subtle Divider for desktop view */}
                {idx < metrics.length - 1 && (
                  <div className="hidden h-8 w-px bg-white/10 sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Trend Indicator Pill */}
        <div className="flex items-center justify-between lg:justify-end border-t border-white/10 pt-3 lg:border-t-0 lg:pt-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-emerald-500/20 hover:border-emerald-400/50">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span>
              {d.salesTrend === 'N/A'
                ? 'NEW'
                : `${Number(d.salesTrend) >= 0 ? '+' : ''}${d.salesTrend}%`}
            </span>
            <span className="text-violet-200/70 font-normal">
              {uiT('vs last week', 'पिछले सप्ताह')}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};