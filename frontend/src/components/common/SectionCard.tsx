import { useId, type ReactNode } from "react";
import Card from "react-bootstrap/Card";

interface SectionCardProps {
  /** Visible heading; also names the section (a region landmark). */
  title: string;
  /** Controls on the right of the heading, e.g. "Clear filters". */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A titled card that sets one part of a page apart, e.g. the filters from the results. Rendered as a
 * <section> named by its heading, so each part is its own landmark for screen readers.
 */
export default function SectionCard({
  title,
  actions,
  children,
  className = "mb-4",
}: SectionCardProps) {
  const headingId = useId();
  return (
    <Card
      as="section"
      aria-labelledby={headingId}
      className={`app-section-card shadow-sm ${className}`}
    >
      <Card.Header className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <h2 id={headingId} className="h6 mb-0">
          {title}
        </h2>
        {actions}
      </Card.Header>
      <Card.Body>{children}</Card.Body>
    </Card>
  );
}
