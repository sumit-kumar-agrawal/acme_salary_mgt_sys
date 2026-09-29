import type { ReactNode } from "react";
import Nav from "react-bootstrap/Nav";
import Offcanvas from "react-bootstrap/Offcanvas";
import { NavLink } from "react-router";
import "@/layouts/Sidebar.css";

// Feature navigation (R9a): a fixed column on large screens, an offcanvas panel below the lg breakpoint.
// Links are grouped into labelled sections; the current page is highlighted (aria-current from NavLink).
// Only pages that exist are listed (R9).

/** Simple line icons (16 × 16, drawn here: no icon library). Decorative: the link text names the page. */
const ICONS = {
  dashboard: (
    <>
      <rect x="1.75" y="1.75" width="5" height="5" rx="1" />
      <rect x="9.25" y="1.75" width="5" height="5" rx="1" />
      <rect x="1.75" y="9.25" width="5" height="5" rx="1" />
      <rect x="9.25" y="9.25" width="5" height="5" rx="1" />
    </>
  ),
  employees: (
    <>
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 14c0-2.5 2-4.25 4.5-4.25s4.5 1.75 4.5 4.25" />
      <circle cx="11.5" cy="5.5" r="2" />
      <path d="M11.5 9.75c1.9 0 3.25 1.4 3.25 3.5" />
    </>
  ),
  analytics: (
    <>
      <path d="M1.75 14.25h12.5" />
      <rect x="3" y="8" width="2.5" height="6.25" rx="0.5" />
      <rect x="7" y="3.5" width="2.5" height="10.75" rx="0.5" />
      <rect x="11" y="10" width="2.5" height="4.25" rx="0.5" />
    </>
  ),
  report: (
    <>
      <path d="M3.75 1.75h5.5l3 3v9.5h-8.5z" />
      <path d="M9.25 1.75v3h3" />
      <path d="M6 8.25h4M6 10.5h4M6 12.75h2.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

type IconName = keyof typeof ICONS;

const NAV_SECTIONS: {
  label: string;
  items: { to: string; label: string; end: boolean; icon: IconName }[];
}[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", end: true, icon: "dashboard" },
      { to: "/analytics", label: "Analytics", end: false, icon: "analytics" },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/employees", label: "Employees", end: false, icon: "employees" },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        to: "/reports/salaries",
        label: "Salary report",
        end: false,
        icon: "report",
      },
    ],
  },
];

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

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
      className="app-sidebar border-end bg-body-tertiary"
    >
      <Offcanvas.Header closeButton closeLabel="Close navigation">
        <Offcanvas.Title id="app-sidebar-title" as="h2" className="h6 mb-0">
          Navigation
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="p-lg-3">
        <Nav
          as="nav"
          aria-label="Main"
          className="app-sidebar-nav flex-column w-100"
        >
          {NAV_SECTIONS.map((section) => {
            const labelId = `nav-section-${section.label.toLowerCase()}`;
            return (
              <div key={section.label} role="group" aria-labelledby={labelId}>
                <div id={labelId} className="app-sidebar-section">
                  {section.label}
                </div>
                {section.items.map((item) => (
                  <Nav.Link
                    key={item.to}
                    as={NavLink}
                    to={item.to}
                    end={item.end}
                    onClick={onHide}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Nav.Link>
                ))}
              </div>
            );
          })}
        </Nav>
      </Offcanvas.Body>
    </Offcanvas>
  );
}
