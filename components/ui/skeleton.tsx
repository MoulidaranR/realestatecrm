import * as React from "react";

export function SkeletonLine({ width = "full", height = "4" }: { width?: string; height?: string }) {
  return (
    <div className={`skeleton h-${height} w-${width} rounded-md`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="skeleton mb-3 h-3 w-24 rounded" />
      <div className="skeleton h-8 w-16 rounded-lg" />
      <div className="skeleton mt-2 h-3 w-20 rounded" />
    </div>
  );
}

export function SkeletonTableRows({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className={`skeleton h-3 rounded ${j === 0 ? "w-32" : j === cols - 1 ? "w-16" : "w-20"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonMetricGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
