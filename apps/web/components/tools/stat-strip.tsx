export type Stat = { label: string; value: string; hint?: string };

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="not-prose mb-10 grid grid-cols-2 overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex flex-col gap-1 px-4 py-4 sm:px-5 ${
            i % 2 === 1 ? "border-l border-ani-line" : ""
          } ${i >= 2 ? "border-t border-ani-line sm:border-t-0" : ""} ${
            i === 2 ? "sm:border-l" : ""
          }`}
        >
          <dt className="order-2 text-xs leading-snug text-ani-muted">{stat.label}</dt>
          <dd className="order-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-ani-text sm:text-[1.75rem]">
            {stat.value}
          </dd>
          {stat.hint ? <dd className="order-3 text-xs text-ani-muted">{stat.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
