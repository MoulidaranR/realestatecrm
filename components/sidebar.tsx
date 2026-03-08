"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type SidebarProps = {
  roleKey: string;
  mobileOpen?: boolean;
  onClose?: () => void;
};

const BASE_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/follow-ups", label: "Follow-ups" },
  { href: "/site-visits", label: "Site Visits" },
  { href: "/reports", label: "Reports" },
  { href: "/notifications", label: "Notifications" },
  { href: "/imports", label: "Imports" },
  { href: "/activity-logs", label: "Activity Logs" },
  { href: "/users", label: "Users" }
];

export function Sidebar({ roleKey, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedRoleKey = roleKey.toLowerCase();
  const items = BASE_ITEMS.filter((item) => {
    if (item.href === "/users" && normalizedRoleKey !== "company_admin") {
      return false;
    }
    if (
      item.href === "/imports" &&
      normalizedRoleKey !== "company_admin" &&
      normalizedRoleKey !== "manager"
    ) {
      return false;
    }
    if (item.href === "/activity-logs" && normalizedRoleKey === "sales_executive") {
      return false;
    }
    return true;
  });

  // Close mobile sidebar on route change
  useEffect(() => {
    if (mobileOpen && onClose) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const preload = () => {
      items.forEach((item) => {
        if (item.href !== pathname) {
          router.prefetch(item.href);
        }
      });
    };

    if ("requestIdleCallback" in globalThis) {
      const handle = globalThis.requestIdleCallback(preload);
      return () => globalThis.cancelIdleCallback(handle);
    }

    const timeout = setTimeout(preload, 150);
    return () => clearTimeout(timeout);
  }, [items, pathname, router]);

  const navContent = (
    <>
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary">Real Estate CRM</h1>
      </div>
      <nav className="flex-1 px-4">
        <ul className="space-y-2">
          {items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {navContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-xl animate-slide-in">
            <div className="flex items-center justify-between px-6 pt-6">
              <h1 className="text-xl font-bold text-primary">Real Estate CRM</h1>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="mt-4 flex-1 px-4">
              <ul className="space-y-2">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch
                        className={`block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
