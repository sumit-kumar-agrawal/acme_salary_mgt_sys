import { http, HttpResponse } from "msw";
import type { EmployeeDetail } from "@/services/employee.types";
import { server } from "@/test/server";

// POST /employees and PATCH /employees/:id that record request bodies (API spec §6.3, §6.4).

type Responder = (body: unknown) => Response;

export function mockEmployeeWrites({
  created,
  updated,
  createResponse,
  updateResponse,
}: {
  created?: EmployeeDetail;
  updated?: EmployeeDetail;
  createResponse?: Responder;
  updateResponse?: Responder;
}) {
  const bodies: { method: string; body: unknown }[] = [];
  server.use(
    http.post("*/api/v1/employees", async ({ request }) => {
      const body = await request.json();
      bodies.push({ method: "POST", body });
      if (createResponse) return createResponse(body);
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
    http.patch("*/api/v1/employees/:id", async ({ request }) => {
      const body = await request.json();
      bodies.push({ method: "PATCH", body });
      if (updateResponse) return updateResponse(body);
      return HttpResponse.json({ data: updated });
    }),
  );
  return { bodies };
}

export function validationFailed(details: Record<string, string[]>): Response {
  return HttpResponse.json(
    {
      error: {
        code: "validation_failed",
        message: "Please correct the highlighted fields.",
        details,
      },
    },
    { status: 422 },
  );
}
