import Spinner from "react-bootstrap/Spinner";

interface LoadingStateProps {
  /** What is loading, read by screen readers and shown next to the spinner. */
  label?: string;
  /** Centre in the viewport (used while the app starts). */
  fullPage?: boolean;
}

export default function LoadingState({
  label = "Loading…",
  fullPage = false,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullPage
          ? "d-flex min-vh-100 align-items-center justify-content-center gap-2"
          : "d-flex align-items-center gap-2 py-3"
      }
    >
      <Spinner animation="border" size="sm" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
