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
    return <Check className="h-5 w-5 shrink-0 text-ani-progress" aria-label="Yes" />;
  if (value === "no")
    return <X className="h-5 w-5 shrink-0 text-ani-muted" aria-label="No" />;
  if (value === "partial")
    return <Minus className="h-5 w-5 shrink-0 text-ani-muted" aria-label="Partial" />;
  return <span className="text-right text-sm text-ani-muted">{value}</span>;
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
        {rows.map((row) => (
          <div
            key={row.feature}
            className="rounded-[12px] border border-ani-line p-4"
          >
            <p className="mb-3 font-semibold text-ani-text">{row.feature}</p>
            <div className="space-y-2">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className={`flex items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-sm ${
                    col.highlight ? "bg-ani-selected-quiet" : ""
                  }`}
                >
                  <span
                    className={
                      col.highlight
                        ? "font-medium text-ani-text"
                        : "text-ani-muted"
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

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ani-line">
              <th className="px-4 py-3 text-left font-medium text-ani-muted">
                Feature
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-4 py-3 text-left font-medium ${
                    col.highlight ? "text-ani-text" : "text-ani-muted"
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-ani-muted">
            {rows.map((row) => (
              <tr key={row.feature} className="border-b border-ani-line">
                <td className="px-4 py-3 text-ani-text">{row.feature}</td>
                {columns.map((col) => {
                  const v = row.values[col.id] ?? "";
                  const isIcon =
                    v === "yes" || v === "no" || v === "partial";
                  return (
                    <td
                      key={col.id}
                      className={`px-4 py-3 ${
                        col.highlight && !isIcon
                          ? "font-medium text-ani-text"
                          : ""
                      } ${isIcon ? "text-center" : ""} ${
                        col.highlight ? "bg-ani-selected-quiet" : ""
                      }`}
                    >
                      {isIcon ? <CellIcon value={v} /> : v}
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
