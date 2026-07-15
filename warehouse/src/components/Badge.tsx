import type { ReactNode } from "react";

type BadgeVariant = "green" | "blue" | "yellow" | "red" | "gray" | "purple";

interface Props {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  green: "badge-green",
  blue: "badge-blue",
  yellow: "badge-yellow",
  red: "badge-red",
  gray: "badge-gray",
  purple: "badge-purple",
};

export default function Badge({ variant = "gray", children, className = "" }: Props) {
  return <span className={`${variantClasses[variant]} ${className}`}>{children}</span>;
}
