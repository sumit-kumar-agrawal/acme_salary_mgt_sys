import Badge from "react-bootstrap/Badge";
import {
  EMPLOYMENT_STATUS_LABELS,
  type EmploymentStatus,
} from "@/services/reference.types";

const VARIANTS: Record<EmploymentStatus, { bg: string; text?: "dark" }> = {
  active: { bg: "success" },
  on_leave: { bg: "warning", text: "dark" },
  terminated: { bg: "secondary" },
};

/** Employment status with its label always shown, so meaning does not depend on colour (S9). */
export default function EmploymentStatusBadge({
  status,
}: {
  status: EmploymentStatus;
}) {
  const { bg, text } = VARIANTS[status];
  return (
    <Badge bg={bg} text={text}>
      {EMPLOYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
