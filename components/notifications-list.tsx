"use client";

import { useState } from "react";
import type { Notification } from "@/lib/db-types";

type NotificationsListProps = {
  initialNotifications: Notification[];
};

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

  async function markRead(id: string) {
    setLoadingId(id);
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH"
    });
    if (response.ok) {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
    }
    setLoadingId("");
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={`rounded-2xl border bg-white p-4 shadow-sm ${
            notification.is_read ? "border-slate-200" : "border-primary/50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{notification.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                {notification.event_type} • {formatDateTime(notification.created_at)}
              </p>
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
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          No notifications.
        </div>
      ) : null}
    </div>
  );
}
