import type { ReactNode } from "react";

interface Props {
  title: string;
  action?: ReactNode;
}

export default function SectionHeader({ title, action }: Props) {
  return (
    <div className="card-header">
      <h3 className="text-body-bold text-th-text">{title}</h3>
      {action}
    </div>
  );
}
