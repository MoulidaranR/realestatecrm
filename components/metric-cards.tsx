type MetricCardsProps = {
  cards: Array<{
    label: string;
    value: number | string;
  }>;
};

export function MetricCards({ cards }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
        </article>
      ))}
    </div>
  );
}
