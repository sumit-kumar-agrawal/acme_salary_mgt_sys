import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import { userMessage } from "@/services/api";

interface ErrorAlertProps {
  error: unknown;
  title?: string;
  /** Shows a Retry button when given. */
  onRetry?: () => void;
}

/** Shows a safe message for an API or unexpected error (never payloads or technical detail). */
export default function ErrorAlert({ error, title, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="danger" role="alert">
      {title && (
        <Alert.Heading as="h2" className="h5">
          {title}
        </Alert.Heading>
      )}
      <p className="mb-0">{userMessage(error)}</p>
      {onRetry && (
        <Button
          variant="outline-danger"
          size="sm"
          className="mt-3"
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </Alert>
  );
}
