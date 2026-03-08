import * as React from "react";
import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
};

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-text-muted" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.label}>
                {index > 0 && (
                  <svg className="h-3 w-3 text-text-disabled flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-text-secondary transition-colors truncate max-w-[120px]"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary font-medium truncate">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold text-text-primary tracking-tight leading-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:ml-4">
          {actions}
        </div>
      )}
    </div>
  );
}
