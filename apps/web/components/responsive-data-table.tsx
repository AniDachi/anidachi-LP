export type DataTableColumn = {
  key: string;
  label: string;
};

export function ResponsiveDataTable({
  columns,
  rows,
  titleKey,
  className = "mb-8",
}: {
  columns: DataTableColumn[];
  rows: Record<string, string>[];
  titleKey: string;
  className?: string;
}) {
  const detailColumns = columns.filter((col) => col.key !== titleKey);

  return (
    <div className={className}>
      <div className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <div
            key={`${row[titleKey]}-${i}`}
            className={`rounded-xl border border-brand-border bg-brand-surface p-4 ${
              i % 2 === 1 ? "bg-brand-surface/80" : ""
            }`}
          >
            <p className="mb-3 font-semibold text-foreground">{row[titleKey]}</p>
            <dl className="space-y-2">
              {detailColumns.map((col) => (
                <div key={col.key} className="flex flex-col gap-0.5 rounded-lg bg-background px-3 py-2 text-sm">
                  <dt className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                    {col.label}
                  </dt>
                  <dd className="text-foreground/80">{row[col.key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse rounded-lg border border-brand-border text-sm">
          <thead>
            <tr className="bg-brand-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="border border-brand-border px-4 py-2 text-left"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-foreground/80">
            {rows.map((row, i) => (
              <tr key={`${row[titleKey]}-${i}`} className={i % 2 === 1 ? "bg-brand-surface/50" : ""}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`border border-brand-border px-4 py-2 ${
                      col.key === titleKey ? "font-medium text-foreground" : ""
                    }`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
