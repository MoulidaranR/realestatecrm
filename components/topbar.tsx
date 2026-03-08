import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

type TopbarProps = {
  fullName: string;
  roleKey: string;
  unreadNotifications: number;
  onMenuToggle?: () => void;
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function roleLabel(key: string): string {
  const map: Record<string, string> = {
    company_admin: "Company Admin",
    manager: "Manager",
    sales_executive: "Sales Executive",
    view_only: "View Only",
    telecaller: "Telecaller"
  };
  return map[key.toLowerCase()] ?? key;
}

export function Topbar({ fullName, roleKey, unreadNotifications, onMenuToggle }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur-md">
      {/* Left: hamburger + page context */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden transition-colors"
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          aria-label={`Notifications${unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ""}`}
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadNotifications > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-600 px-1 text-[9px] font-bold text-white leading-none">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Link>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200" />

        {/* User info */}
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-bold text-primary-700">
            {getInitials(fullName)}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{fullName}</p>
            <p className="text-[10px] text-text-muted">{roleLabel(roleKey)}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200" />

        <LogoutButton />
      </div>
    </header>
  );
}
