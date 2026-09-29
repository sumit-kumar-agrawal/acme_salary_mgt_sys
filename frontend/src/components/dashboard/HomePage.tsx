import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Home placeholder (R9). The analytics dashboard replaces it in F7.1; F5.1 makes "/" open the employee list.
export default function HomePage() {
  useDocumentTitle("Home");

  return (
    <>
      <h1 className="h3">Home</h1>
      <p className="text-body-secondary">
        Employees, salary history, analytics, and reports appear in the
        navigation as they are built.
      </p>
    </>
  );
}
