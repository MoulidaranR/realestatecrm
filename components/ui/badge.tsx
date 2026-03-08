import * as React from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-info-100 text-info-700",
  purple: "bg-primary-100 text-primary-700",
  outline: "border border-slate-300 text-slate-700 bg-transparent"
};

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-slate-500",
  success: "bg-success-600",
  warning: "bg-warning-600",
  danger: "bg-danger-600",
  info: "bg-info-600",
  purple: "bg-primary-600",
  outline: "bg-slate-500"
};

export function Badge({ variant = "default", children, className = "", dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
