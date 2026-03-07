"use client";

import { useEffect, useMemo, useState } from "react";

type PeriodKey = "today" | "week" | "month";

type ChartDataset = {
  title: string;
  legendCurrent: string;
  legendPrevious: string;
  labels: [string, string][];
  currentSeries: number[];
  previousSeries: number[];
  highlightIndex: number;
};

const chartData: Record<PeriodKey, ChartDataset> = {
  today: {
    title: "Today",
    legendCurrent: "Today",
    legendPrevious: "Yesterday",
    labels: [
      ["10:23 PM", "10/11"],
      ["10:30 PM", "10/11"],
      ["10:40 PM", "10/11"],
      ["10:50 PM", "10/11"],
      ["11:00 PM", "10/11"],
      ["11:10 PM", "10/11"],
      ["11:20 PM", "10/11"],
      ["11:30 PM", "10/11"],
      ["11:40 PM", "10/11"]
    ],
    currentSeries: [18, 22, 25, 28, 33, 29, 31, 35, 32],
    previousSeries: [14, 16, 17, 19, 23, 22, 21, 22, 24],
    highlightIndex: 4
  },
  week: {
    title: "This Week",
    legendCurrent: "This Week",
    legendPrevious: "Last Week",
    labels: [
      ["Mon", "W1"],
      ["Tue", "W1"],
      ["Wed", "W1"],
      ["Thu", "W1"],
      ["Fri", "W1"],
      ["Sat", "W1"],
      ["Sun", "W1"],
      ["Mon", "W2"],
      ["Tue", "W2"]
    ],
    currentSeries: [26, 32, 28, 38, 42, 36, 40, 45, 48],
    previousSeries: [20, 24, 23, 30, 35, 31, 33, 36, 37],
    highlightIndex: 8
  },
  month: {
    title: "This Month",
    legendCurrent: "This Month",
    legendPrevious: "Last Month",
    labels: [
      ["Wk 1", "Oct"],
      ["Wk 2", "Oct"],
      ["Wk 3", "Oct"],
      ["Wk 4", "Oct"],
      ["Wk 1", "Nov"],
      ["Wk 2", "Nov"],
      ["Wk 3", "Nov"],
      ["Wk 4", "Nov"],
      ["Wk 1", "Dec"]
    ],
    currentSeries: [120, 132, 128, 145, 154, 166, 172, 181, 196],
    previousSeries: [103, 110, 116, 124, 136, 141, 149, 155, 163],
    highlightIndex: 8
  }
};

function buildPath(values: number[], width: number, height: number): string {
  const maxValue = Math.max(...values);
  const padding = 14;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const usableHeight = height - padding * 2;
      const y = height - padding - (value / maxValue) * usableHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

async function fetchChartData(period: PeriodKey): Promise<ChartDataset> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  return chartData[period];
}

export function ChartCard() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<ChartDataset>(chartData.today);

  async function loadData(target: PeriodKey) {
    setLoading(true);
    const result = await fetchChartData(target);
    setDataset(result);
    setLoading(false);
  }

  useEffect(() => {
    loadData(period);
  }, [period]);

  const currentPath = useMemo(
    () => buildPath(dataset.currentSeries, 800, 200),
    [dataset.currentSeries]
  );
  const previousPath = useMemo(
    () => buildPath(dataset.previousSeries, 800, 200),
    [dataset.previousSeries]
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-slate-900">{dataset.title}</h3>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodKey)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={() => loadData(period)}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>
      <div className="relative h-[250px] rounded-xl bg-slate-50 p-2">
        {loading ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/70">
            <p className="text-xs font-semibold text-slate-500">Loading chart data...</p>
          </div>
        ) : null}
        <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 800 200">
          <path d={previousPath} fill="none" stroke="rgb(148 163 184)" strokeWidth={2} />
          <path d={currentPath} fill="none" stroke="rgb(124 58 237)" strokeWidth={3} />
        </svg>
        <div className="absolute left-4 top-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px]">
          <p className="text-slate-500">{dataset.legendCurrent}</p>
          <p className="font-bold text-slate-900">
            {dataset.currentSeries[dataset.highlightIndex]}
          </p>
          <p className="mt-1 text-slate-500">{dataset.legendPrevious}</p>
          <p className="font-bold text-slate-900">
            {dataset.previousSeries[dataset.highlightIndex]}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-between gap-2 overflow-x-auto text-[10px] font-medium text-slate-500">
        {dataset.labels.map((label, index) => (
          <div key={`${label[0]}-${index}`} className="min-w-[70px] text-center">
            <p>{label[0]}</p>
            <p>{label[1]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
