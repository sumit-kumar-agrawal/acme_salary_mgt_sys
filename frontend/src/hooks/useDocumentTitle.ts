import { useEffect } from "react";

const APP_NAME = "Salary Management";

/** Sets the browser tab title for the current page (R11), e.g. "Employees · Salary Management". */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
