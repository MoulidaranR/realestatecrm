"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type SidebarProps = {
  roleKey: string;
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

export function Sidebar({ roleKey }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const items = BASE_ITEMS.filter((item) => {
    if (item.href === "/users" && roleKey !== "company_admin") {
      return false;
    }
    if (item.href === "/imports" && roleKey !== "company_admin" && roleKey !== "manager") {
      return false;
    }
    if (item.href === "/activity-logs" && roleKey === "sales_executive") {
      return false;
    }
    return true;
  });

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

  return (
    <aside className="hidden w-64 flex-shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
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
    </aside>
  );
}
