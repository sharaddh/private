import type { LucideIcon } from "lucide-react";
import { Package } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon = Package, title = "No items found", message, action }: Props) {
  return (
    <div className="card p-12 text-center">
      <Icon size={40} className="mx-auto text-th-muted mb-3" />
      <p className="text-th-secondary text-body">{title}</p>
      {message && <p className="text-th-muted text-small mt-1">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-4">
          {action.label}
        </button>
      )}
    </div>
  );
}
