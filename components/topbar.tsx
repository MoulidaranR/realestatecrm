import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

type TopbarProps = {
  fullName: string;
  roleKey: string;
  unreadNotifications: number;
};

export function Topbar({ fullName, roleKey, unreadNotifications }: TopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{roleKey}</p>
        <h2 className="text-lg font-bold text-slate-900">{fullName}</h2>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/notifications"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Notifications
          {unreadNotifications > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-white">
              {unreadNotifications}
            </span>
          ) : null}
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
