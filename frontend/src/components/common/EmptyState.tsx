import type { ReactNode } from "react";

interface EmptyStateProps {
  message: string;
  /** Optional next step, e.g. a "Clear filters" button. */
  action?: ReactNode;
}

/** Shown when a list or report has nothing to display (S11). */
export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="text-center text-body-secondary py-5 border rounded"
    >
      <p className="mb-2">{message}</p>
      {action}
    </div>
  );
}
