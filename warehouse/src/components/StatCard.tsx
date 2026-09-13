import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  value: ReactNode;
  label: string;
  badge?: { text: string; variant: string };
}

const BADGE_STYLES: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-500',
  blue: 'bg-announcement-500/15 text-announcement-500',
  yellow: 'bg-amber-500/15 text-amber-500',
  red: 'bg-negative/15 text-negative',
  gray: 'bg-th-elevated text-th-secondary',
  purple: 'bg-purple-500/15 text-purple-400',
};

export default function StatCard({ icon: Icon, iconColor, iconBg, value, label, badge }: Props) {
  const badgeStyle = badge ? BADGE_STYLES[badge.variant] || BADGE_STYLES.gray : '';
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-th-border bg-th-surface px-3.5 py-2.5 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 ${iconBg} rounded-lg flex items-center justify-center shrink-0`}>
          <Icon size={16} className={iconColor} />
        </div>
        <p className="text-body-bold text-th-text leading-tight">{value}</p>
      </div>
      {badge && (
        <span className={`ml-1.5 align-middle px-1.5 py-0.5 rounded-pill text-badge font-bold ${badgeStyle}`}>
          {badge.text}
        </span>
      )}
      <p className="text-caption text-th-secondary">{label}</p>
    </div>
  );
}