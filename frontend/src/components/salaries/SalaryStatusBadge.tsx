import Badge from "react-bootstrap/Badge";
import type { SalaryStatus } from "@/services/salary.types";

const DISPLAY: Record<
  SalaryStatus,
  { label: string; bg: string; text?: "dark" }
> = {
  current: { label: "Current", bg: "success" },
  scheduled: { label: "Scheduled", bg: "info", text: "dark" },
  historical: { label: "Historical", bg: "secondary" },
};

/** The API's record status (U3), with its label always shown so meaning does not depend on colour. */
export default function SalaryStatusBadge({
  status,
}: {
  status: SalaryStatus;
}) {
  const { label, bg, text } = DISPLAY[status];
  return (
    <Badge bg={bg} text={text}>
      {label}
    </Badge>
  );
}
