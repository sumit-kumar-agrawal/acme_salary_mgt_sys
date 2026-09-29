import { Component, type ReactNode } from "react";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches rendering errors and shows a generic message (R10). React requires a class component for
 * error boundaries; this is the one exception to "functional components". Nothing about the error is
 * shown; logging is done once, name only, by the root's error handlers (see reportRenderError, main.tsx).
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Container
        as="main"
        id="main"
        className="py-5"
        style={{ maxWidth: "36rem" }}
      >
        <h1 className="h4">Something went wrong</h1>
        <p>The page could not be displayed. Reload to try again.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </Container>
    );
  }
}
