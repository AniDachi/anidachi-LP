import { Check, Minus, X } from "lucide-react";

export type CompareCellValue = "yes" | "no" | "partial" | string;

export type CompareColumn = {
  id: string;
  label: string;
  highlight?: boolean;
};

export type CompareTableRow = {
  feature: string;
  values: Record<string, CompareCellValue>;
};

function CellIcon({ value }: { value: CompareCellValue }) {
  if (value === "yes")
    return <Check className="h-5 w-5 shrink-0 text-brand-orange" aria-label="Yes" />;
  if (value === "no")
    return <X className="h-5 w-5 text-red-400 shrink-0" aria-label="No" />;
  if (value === "partial")
    return <Minus className="h-5 w-5 text-amber-500 shrink-0" aria-label="Partial" />;
  return <span className="text-sm text-foreground/70 text-right">{value}</span>;
}

function displayValue(value: CompareCellValue): CompareCellValue {
  if (value === "yes" || value === "no" || value === "partial") return value;
  return value;
}

export function ResponsiveCompareTable({
  columns,
  rows,
  className = "mb-8",
}: {
  columns: CompareColumn[];
  rows: CompareTableRow[];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="space-y-3 md:hidden">
        {rows.map((row, i) => (
          <div
            key={row.feature}
            className={`rounded-xl border border-brand-border bg-brand-surface p-4 ${
              i % 2 === 1 ? "bg-brand-surface/80" : ""
            }`}
          >
            <p className="font-semibold text-foreground mb-3">{row.feature}</p>
            <div className="space-y-2">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                    col.highlight
                      ? "bg-brand-orange/10 border border-brand-orange/20"
                      : "bg-background"
                  }`}
                >
                  <span
                    className={
                      col.highlight
                        ? "font-medium text-brand-orange"
                        : "text-foreground/60"
                    }
                  >
                    {col.label}
                  </span>
                  <CellIcon value={displayValue(row.values[col.id] ?? "")} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse border border-brand-border">
          <thead>
            <tr className="bg-brand-surface">
              <th className="border border-brand-border px-4 py-2 text-left">
                Feature
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`border border-brand-border px-4 py-2 text-left ${
                    col.highlight ? "text-brand-orange" : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-foreground/70">
            {rows.map((row, i) => (
              <tr key={row.feature} className={i % 2 === 1 ? "bg-brand-surface/50" : ""}>
                <td className="border border-brand-border px-4 py-2">
                  {row.feature}
                </td>
                {columns.map((col) => {
                  const v = row.values[col.id] ?? "";
                  const isIcon =
                    v === "yes" || v === "no" || v === "partial";
                  return (
                    <td
                      key={col.id}
                      className={`border border-brand-border px-4 py-2 ${
                        col.highlight && !isIcon
                          ? "font-medium text-brand-orange"
                          : ""
                      } ${isIcon ? "text-center" : ""}`}
                    >
                      {isIcon ? (
                        <CellIcon value={v} />
                      ) : (
                        v
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
