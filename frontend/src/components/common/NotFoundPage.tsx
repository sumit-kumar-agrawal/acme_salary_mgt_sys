import { Link } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/** Unknown URL inside the app (R9). Generic: it never echoes the requested path. */
export default function NotFoundPage() {
  useDocumentTitle("Page not found");

  return (
    <>
      <h1 className="h3">Page not found</h1>
      <p>The page you asked for does not exist.</p>
      <Link to="/employees">Go to employees</Link>
    </>
  );
}
