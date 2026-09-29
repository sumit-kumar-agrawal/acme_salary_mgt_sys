import Container from "react-bootstrap/Container";
import ErrorAlert from "@/components/common/ErrorAlert";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import LoadingState from "@/components/common/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import AppRoutes from "@/routes/AppRoutes";

// Waits for the first session check before routing (R3): "API down" must not look like "signed out",
// and RequireAuth must not redirect while the session is still loading.
export default function App() {
  const auth = useAuth();

  if (auth.status === "loading")
    return <LoadingState label="Loading…" fullPage />;

  if (auth.status === "error") {
    return (
      <Container
        as="main"
        id="main"
        className="py-5"
        style={{ maxWidth: "36rem" }}
      >
        <ErrorAlert
          title="The application could not start"
          error={auth.error}
          onRetry={auth.retry}
        />
      </Container>
    );
  }

  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}
