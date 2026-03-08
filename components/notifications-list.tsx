"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Notification } from "@/lib/db-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";

type NotificationsListProps = {
  initialNotifications: Notification[];
};

type TabKey = "unread" | "read" | "all";
type DateFilter = "all" | "7d" | "30d";

function fmt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function typeIcon(t: string): string {
  if (t === "assignment") return "👤";
  if (t === "reminder") return "⏰";
  if (t === "system") return "⚙️";
  if (t === "import") return "📥";
  return "🔔";
}

function typeVariant(t: string): "purple" | "info" | "warning" | "success" | "default" {
  if (t === "assignment") return "purple";
  if (t === "reminder") return "warning";
  if (t === "system") return "info";
  if (t === "import") return "success";
  return "default";
}

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [loadingId, setLoadingId] = useState("");
  const [tab, setTab] = useState<TabKey>("unread");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const { toast } = useToast();

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const typeOptions = useMemo(() => Array.from(new Set(notifications.map((n) => n.notification_type))), [notifications]);

  const filteredNotifications = useMemo(() => {
    const now = new Date();
    return notifications.filter((item) => {
      if (tab === "unread" && item.is_read) return false;
      if (tab === "read" && !item.is_read) return false;
      if (typeFilter !== "all" && item.notification_type !== typeFilter) return false;
      if (dateFilter !== "all") {
        const created = new Date(item.created_at);
        if (Number.isNaN(created.valueOf())) return false;
        const days = dateFilter === "7d" ? 7 : 30;
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - days);
        if (created < threshold) return false;
      }
      return true;
    });
  }, [notifications, tab, typeFilter, dateFilter]);

  async function markRead(id: string) {
    setLoadingId(id);
    const res = await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { toast("error", json.error ?? "Failed to update"); setLoadingId(""); return; }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setLoadingId("");
  }

  async function markAllAsRead() {
    setLoadingId("all");
    const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) { toast("error", json.error ?? "Failed to mark all as read"); setLoadingId(""); return; }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast("success", "All notifications marked as read.");
    setLoadingId("");
  }

  const selectCls = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {(["unread", "read", "all"] as TabKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition-colors ${
                  tab === key
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {key}
                {key === "unread" && unreadCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            loading={loadingId === "all"}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="all">All types</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className={selectCls}>
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Showing <strong className="text-text-primary">{filteredNotifications.length}</strong> notifications
        </p>
      </div>

      {/* List */}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <EmptyState
            title="No notifications"
            description="Notifications will appear here when your team assigns leads, completes follow-ups, or triggers workflow events."
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((n) => (
            <article
              key={n.id}
              className={`rounded-xl border bg-surface p-4 shadow-card transition-colors hover:bg-slate-50/60 ${
                n.is_read ? "border-border" : "border-primary-300 bg-primary-50/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm">
                  {typeIcon(n.notification_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{n.title}</h3>
                    <Badge variant={typeVariant(n.notification_type)}>{n.notification_type}</Badge>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary-500" title="Unread" />}
                  </div>
                  <p className="mt-0.5 text-sm text-text-secondary">{n.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    <span className="text-[11px] text-text-disabled">{fmt(n.created_at)}</span>
                    <span className="text-[11px] text-text-disabled">·</span>
                    <span className="text-[11px] font-mono text-text-disabled">{n.event_type}</span>
                    {n.action_url && (
                      <Link href={n.action_url} className="text-[11px] font-semibold text-primary-600 hover:underline">
                        View →
                      </Link>
                    )}
                  </div>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    disabled={loadingId === n.id}
                    className="flex-shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                  >
                    {loadingId === n.id ? "…" : "Mark read"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
