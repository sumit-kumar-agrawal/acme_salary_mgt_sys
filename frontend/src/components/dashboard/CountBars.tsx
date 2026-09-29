import type { ReactNode } from "react";
import Table from "react-bootstrap/Table";
import { formatCount } from "@/components/common/format";

// A table of counts with a bar per row (FRONTEND_PLAN.md V8 a: no chart library). Bars are scaled to the
// largest count in this table only, and only counts are drawn: money is never converted to a number.

export interface CountBarRow {
  key: string;
  label: ReactNode;
  count: number;
  /** Optional extra column, e.g. a per-currency average shown as text. */
  detail?: ReactNode;
}

interface CountBarsProps {
  /** Accessible table name (visually hidden; a heading is visible). */
  caption: string;
  labelHeader: string;
  countHeader?: string;
  detailHeader?: string;
  rows: CountBarRow[];
}

export default function CountBars({
  caption,
  labelHeader,
  countHeader = "Employees",
  detailHeader,
  rows,
}: CountBarsProps) {
  const largest = Math.max(0, ...rows.map((row) => row.count));
  return (
    <Table responsive size="sm" className="align-middle mb-0">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col" className="w-50">
            {countHeader}
          </th>
          {detailHeader && <th scope="col">{detailHeader}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="text-nowrap">{row.label}</td>
            <td>
              <div className="d-flex align-items-center gap-2">
                <span className="text-end" style={{ minWidth: "3.5rem" }}>
                  {formatCount(row.count)}
                </span>
                <div
                  className="bg-primary rounded"
                  data-testid="count-bar"
                  aria-hidden="true"
                  style={{
                    height: "0.75rem",
                    width: `${largest > 0 ? (row.count / largest) * 100 : 0}%`,
                  }}
                />
              </div>
            </td>
            {detailHeader && <td className="text-nowrap">{row.detail}</td>}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
