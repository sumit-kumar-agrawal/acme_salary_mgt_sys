import { useState } from "react";
import { Outlet } from "react-router";
import Header from "@/layouts/Header";
import Sidebar from "@/layouts/Sidebar";

/** Frame for signed-in pages (R9a, R11): skip link, header, sidebar, and the single main landmark. */
export default function MainLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="d-flex flex-column min-vh-100">
      <a
        href="#main"
        className="visually-hidden-focusable position-absolute top-0 start-0 p-2 bg-body z-3"
      >
        Skip to main content
      </a>
      <Header
        navigationOpen={navigationOpen}
        onOpenNavigation={() => setNavigationOpen(true)}
      />
      <div className="d-flex flex-grow-1">
        <Sidebar
          show={navigationOpen}
          onHide={() => setNavigationOpen(false)}
        />
        {/* minWidth 0: a flex item otherwise grows to its widest table, so tables could not scroll on phones. */}
        <main
          id="main"
          tabIndex={-1}
          className="flex-grow-1 p-4"
          style={{ minWidth: 0 }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
