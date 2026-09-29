import Alert from "react-bootstrap/Alert";
import { fieldErrors, isApiError, userMessage } from "@/services/api";

// The summary alert for a failed salary save (U5, U6). Field messages are shown under their fields;
// any the dialog has no field for are listed here, so no 422 message is lost.

export const NOT_EDITABLE_MESSAGE =
  "This record can no longer be corrected because its period has ended.";

export default function SalarySaveError({
  error,
  fields,
}: {
  error: unknown;
  /** API field names the dialog shows under its own fields. */
  fields: readonly string[];
}) {
  if (error === null || error === undefined) return null;

  const errors = fieldErrors(error);
  const unshown = Object.entries(errors).filter(
    ([field]) => !fields.includes(field),
  );
  let message: string;
  if (Object.keys(errors).length > 0) {
    message =
      unshown.length === 0
        ? "Please correct the highlighted fields."
        : unshown.map(([field, text]) => `${field} ${text}`).join(". ");
  } else if (isApiError(error) && error.code === "salary_record_not_editable") {
    message = NOT_EDITABLE_MESSAGE;
  } else {
    message = userMessage(error);
    if (isApiError(error) && error.code === "invalid_csrf_token")
      message += " Reload the page and try again.";
  }

  return (
    <Alert variant="danger" role="alert">
      {message}
    </Alert>
  );
}
