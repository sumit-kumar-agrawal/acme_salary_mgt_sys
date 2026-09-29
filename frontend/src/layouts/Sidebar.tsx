import Nav from "react-bootstrap/Nav";
import Offcanvas from "react-bootstrap/Offcanvas";
import { NavLink } from "react-router";

// Feature navigation (R9a): a fixed column on large screens, an offcanvas panel below the lg breakpoint.
// Only pages that exist are listed (R9); each feature adds its link when it is built.
const NAV_ITEMS = [
  { to: "/employees", label: "Employees", end: false },
] as const;

interface SidebarProps {
  show: boolean;
  onHide: () => void;
}

export default function Sidebar({ show, onHide }: SidebarProps) {
  return (
    <Offcanvas
      id="app-sidebar"
      show={show}
      onHide={onHide}
      responsive="lg"
      aria-labelledby="app-sidebar-title"
      className="border-end bg-body-tertiary"
    >
      <Offcanvas.Header closeButton closeLabel="Close navigation">
        <Offcanvas.Title id="app-sidebar-title" as="h2" className="h6 mb-0">
          Navigation
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="p-lg-3" style={{ minWidth: "14rem" }}>
        <Nav
          as="nav"
          variant="pills"
          aria-label="Main"
          className="flex-column w-100"
        >
          {NAV_ITEMS.map((item) => (
            <Nav.Link
              key={item.to}
              as={NavLink}
              to={item.to}
              end={item.end}
              onClick={onHide}
            >
              {item.label}
            </Nav.Link>
          ))}
        </Nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
