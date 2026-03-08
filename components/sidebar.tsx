"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type SidebarProps = {
  roleKey: string;
  fullName: string;
  companyName?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  hideFor?: string[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const Icon = ({ d, className = "h-4.5 w-4.5" }: { d: string; className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Main",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      },
      {
        href: "/leads",
        label: "Leads",
        icon: <Icon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      },
      {
        href: "/follow-ups",
        label: "Follow-ups",
        icon: <Icon d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      },
      {
        href: "/site-visits",
        label: "Site Visits",
        icon: <Icon d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      }
    ]
  },
  {
    title: "Management",
    items: [
      {
        href: "/users",
        label: "Users",
        icon: <Icon d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
        adminOnly: true
      },
      {
        href: "/roles",
        label: "Roles & Permissions",
        icon: <Icon d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
        adminOnly: true
      },
      {
        href: "/reports",
        label: "Reports",
        icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
        hideFor: ["view_only"]
      },
      {
        href: "/imports",
        label: "Imports",
        icon: <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
        hideFor: ["sales_executive", "view_only"]
      }
    ]
  },
  {
    title: "System",
    items: [
      {
        href: "/notifications",
        label: "Notifications",
        icon: <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      },
      {
        href: "/activity-logs",
        label: "Activity Logs",
        icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
        hideFor: ["sales_executive"]
      },
      {
        href: "/settings",
        label: "Settings",
        icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
        adminOnly: true
      }
    ]
  }
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

export function Sidebar({ roleKey, fullName, companyName, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedRole = roleKey.toLowerCase();

  function shouldShow(item: NavItem): boolean {
    if (item.adminOnly && normalizedRole !== "company_admin") return false;
    if (item.hideFor?.includes(normalizedRole)) return false;
    return true;
  }

  useEffect(() => {
    if (mobileOpen && onClose) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const items = NAV_SECTIONS.flatMap((s) => s.items);
    const preload = () => {
      items.forEach((item) => {
        if (shouldShow(item) && item.href !== pathname) router.prefetch(item.href);
      });
    };
    if ("requestIdleCallback" in globalThis) {
      const handle = globalThis.requestIdleCallback(preload);
      return () => globalThis.cancelIdleCallback(handle);
    }
    const t = setTimeout(preload, 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navContent = (
    <div className="flex h-full flex-col">
      {/* Logo area */}
      <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
          <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate leading-tight">
            {companyName || "Real Estate CRM"}
          </p>
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Admin Panel</p>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <div className="space-y-5">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(shouldShow);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-text-disabled">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          prefetch
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                            active
                              ? "bg-primary-50 text-primary-700 shadow-sm"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          }`}
                        >
                          {/* Active indicator bar */}
                          <span
                            className={`flex-shrink-0 transition-opacity ${active ? "opacity-100 text-primary-600" : "opacity-60"}`}
                          >
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-600" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      {/* User profile footer */}
      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
            {getInitials(fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{fullName}</p>
            <p className="text-[10px] text-text-muted">{roleLabel(roleKey)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface shadow-modal animate-slide-in">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
