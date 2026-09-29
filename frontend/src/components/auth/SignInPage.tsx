import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import { Navigate, useLocation } from "react-router";
import { isApiError, userMessage } from "@/services/api";
import type { AuthNotice } from "@/components/auth/authContext";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { safeReturnPath } from "@/routes/returnPath";
import FormField from "@/components/common/FormField";

// Sign-in page (FRONTEND_PLAN.md R8). Only basic checks here; the API decides whether credentials are valid.

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+$/;

const NOTICES: Record<
  Exclude<AuthNotice, null>,
  { variant: string; text: string }
> = {
  expired: {
    variant: "warning",
    text: "Your session has expired. Please sign in again.",
  },
  signedOut: { variant: "info", text: "You have signed out." },
};

interface Credentials {
  email: string;
  password: string;
}

function signInErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === "rate_limited") {
    return "Too many sign-in attempts. Wait a minute and try again.";
  }
  return userMessage(error);
}

export default function SignInPage() {
  const auth = useAuth();
  const location = useLocation();
  useDocumentTitle("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof Credentials, string>>
  >({});

  const signIn = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      auth.signIn(email, password),
    onError: () => setPassword(""),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const errors: typeof fieldErrors = {};
    if (!trimmedEmail) errors.email = "Enter your email address.";
    else if (!EMAIL_FORMAT.test(trimmedEmail))
      errors.email = "Enter a valid email address.";
    if (!password) errors.password = "Enter your password.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    signIn.mutate({ email: trimmedEmail, password });
  }

  // Signed in (just now, or already): continue to the page that was asked for, if it is internal (R7).
  if (auth.status === "signedIn") {
    return <Navigate to={safeReturnPath(location.state)} replace />;
  }

  const notice = auth.notice ? NOTICES[auth.notice] : null;

  return (
    <Container
      as="main"
      id="main"
      className="py-5"
      style={{ maxWidth: "28rem" }}
    >
      <h1 className="h3 mb-4">Salary Management</h1>
      <Card>
        <Card.Body>
          <h2 className="h5 mb-3">Sign in</h2>
          {notice && !signIn.isError && (
            <Alert variant={notice.variant} role="status">
              {notice.text}
            </Alert>
          )}
          {signIn.isError && (
            <Alert variant="danger" role="alert">
              {signInErrorMessage(signIn.error)}
            </Alert>
          )}
          <Form noValidate onSubmit={handleSubmit}>
            <FormField
              groupClassName="mb-3"
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fieldErrors.email}
              required
            />
            <FormField
              groupClassName="mb-4"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              required
            />
            <Button type="submit" className="w-100" disabled={signIn.isPending}>
              {signIn.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
