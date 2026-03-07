"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Notification } from "@/lib/db-types";

type NotificationsListProps = {
  initialNotifications: Notification[];
};

type TabKey = "unread" | "read" | "all";
type DateFilter = "all" | "7d" | "30d";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }
  return date.toLocaleString();
}

export function NotificationsList({ initialNotifications }: NotificationsListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [loadingId, setLoadingId] = useState("");
  const [tab, setTab] = useState<TabKey>("unread");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [error, setError] = useState("");

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const typeOptions = useMemo(
    () => Array.from(new Set(notifications.map((item) => item.notification_type))),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const now = new Date();
    return notifications.filter((item) => {
      if (tab === "unread" && item.is_read) {
        return false;
      }
      if (tab === "read" && !item.is_read) {
        return false;
      }
      if (typeFilter !== "all" && item.notification_type !== typeFilter) {
        return false;
      }
      if (dateFilter !== "all") {
        const createdAt = new Date(item.created_at);
        if (Number.isNaN(createdAt.valueOf())) {
          return false;
        }
        const days = dateFilter === "7d" ? 7 : 30;
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - days);
        if (createdAt < threshold) {
          return false;
        }
      }
      return true;
    });
  }, [notifications, tab, typeFilter, dateFilter]);

  async function markRead(id: string) {
    setLoadingId(id);
    setError("");
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH"
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to update notification");
      setLoadingId("");
      return;
    }
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, is_read: true } : notification
      )
    );
    setLoadingId("");
  }

  async function markAllAsRead() {
    setLoadingId("all");
    setError("");
    const response = await fetch("/api/notifications/read-all", {
      method: "PATCH"
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Failed to mark all as read");
      setLoadingId("");
      return;
    }
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
    setLoadingId("");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["unread", "read", "all"] as TabKey[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                  tab === item
                    ? "bg-primary text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                {item}
                {item === "unread" ? ` (${unreadCount})` : ""}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={loadingId === "all" || unreadCount === 0}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            {loadingId === "all" ? "Saving..." : "Mark all as read"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          >
            <option value="all">All types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as DateFilter)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
          >
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}
      </div>

      {filteredNotifications.map((notification) => (
        <article
          key={notification.id}
          className={`rounded-2xl border bg-white p-4 shadow-sm ${
            notification.is_read ? "border-slate-200" : "border-primary/50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{notification.title}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                  {notification.notification_type}
                </span>
              </div>
              <p className="text-sm text-slate-600">{notification.message}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {notification.event_type} | {formatDateTime(notification.created_at)}
              </p>
              {notification.action_url ? (
                <Link href={notification.action_url} className="text-xs font-semibold text-primary hover:underline">
                  Open related record
                </Link>
              ) : null}
            </div>
            {!notification.is_read ? (
              <button
                type="button"
                onClick={() => markRead(notification.id)}
                disabled={loadingId === notification.id}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                {loadingId === notification.id ? "Saving..." : "Mark read"}
              </button>
            ) : null}
          </div>
        </article>
      ))}
      {filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          No notifications match your current filters.
        </div>
      ) : null}
    </div>
  );
}
