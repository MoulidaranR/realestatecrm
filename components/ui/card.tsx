import * as React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
};

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6"
};

export function Card({ children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-card ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
