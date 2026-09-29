// Number formatting for record counts (not money: see MoneyAmount for amounts). FRONTEND_PLAN.md S12.
const COUNT_FORMAT = new Intl.NumberFormat("en-US");

/** 9429 → "9,429". */
export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value);
}

/** 1 → "1 employee", 9429 → "9,429 employees". */
export function formatEmployeeCount(value: number): string {
  return `${formatCount(value)} ${value === 1 ? "employee" : "employees"}`;
}

const MONEY_FORMAT = /^(-?)(\d+)(\.\d+)?$/;

/**
 * Adds thousands separators to an API money string by string manipulation only (S8, data-display rules):
 * "85000.00" → "85,000.00", "1500.125" → "1,500.125". The value is never converted to a number, so no
 * precision is lost. A string in an unexpected shape is returned unchanged.
 */
export function formatMoney(amount: string): string {
  const match = MONEY_FORMAT.exec(amount);
  if (!match) return amount;
  const [, sign = "", whole = "", fraction = ""] = match;
  return `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction}`;
}
