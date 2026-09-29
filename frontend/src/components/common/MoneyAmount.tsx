import { formatMoney } from "@/components/common/format";

interface MoneyAmountProps {
  /** The API's decimal string, already rounded to the currency's minor units. */
  amount: string;
  currencyCode: string;
  /** Adds "/ month" where no column header already says "Monthly". */
  monthly?: boolean;
}

/**
 * A salary amount with its currency (S8): "85,000.00 INR". Shown exactly as the API sent it, with only
 * thousands separators added; currency codes rather than symbols ("$" is ambiguous between USD and SGD).
 */
export default function MoneyAmount({
  amount,
  currencyCode,
  monthly = false,
}: MoneyAmountProps) {
  return (
    <span className="text-nowrap">
      {formatMoney(amount)} {currencyCode}
      {monthly && <span className="text-body-secondary"> / month</span>}
    </span>
  );
}
