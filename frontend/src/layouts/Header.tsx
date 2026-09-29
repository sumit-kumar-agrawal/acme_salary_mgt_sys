import { useMutation } from "@tanstack/react-query";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  /** Opens the sidebar on small screens. */
  onOpenNavigation: () => void;
  navigationOpen: boolean;
}

/**
 * App name, the signed-in user, and sign-out (R9a). A plain <header> (banner landmark): react-bootstrap's
 * Navbar would add role="navigation", creating a second, unlabelled navigation landmark.
 */
export default function Header({
  onOpenNavigation,
  navigationOpen,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const signOutMutation = useMutation({ mutationFn: signOut });

  return (
    <header className="navbar bg-dark border-bottom" data-bs-theme="dark">
      <Container fluid>
        <Button
          variant="outline-light"
          size="sm"
          className="d-lg-none me-2"
          aria-controls="app-sidebar"
          aria-expanded={navigationOpen}
          onClick={onOpenNavigation}
        >
          Menu
        </Button>
        <span className="navbar-brand">Salary Management</span>
        <div className="ms-auto d-flex align-items-center gap-3">
          <span className="text-light small d-none d-sm-inline">
            Signed in as {user?.email}
          </span>
          <Button
            variant="outline-light"
            size="sm"
            onClick={() => signOutMutation.mutate()}
            disabled={signOutMutation.isPending}
          >
            Sign out
          </Button>
        </div>
      </Container>
    </header>
  );
}
