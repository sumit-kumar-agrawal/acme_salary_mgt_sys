import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { employeeService } from "@/services/employeeService";
import { EMPLOYEES, mockEmployeeList } from "@/test/fixtures/employees";
import { server } from "@/test/server";

describe("employeeService", () => {
  it("lists employees with the given query", async () => {
    const api = mockEmployeeList({ total: 60 });

    const result = await employeeService.list({
      page: 2,
      per_page: 25,
      sort: "-hired_on",
      country_id: "5",
      q: "Rao",
    });

    expect(result.data).toEqual(EMPLOYEES);
    expect(result.meta).toEqual({
      page: 2,
      per_page: 25,
      total_count: 60,
      total_pages: 3,
    });
    expect(api.lastQuery()).toEqual({
      page: "2",
      per_page: "25",
      sort: "-hired_on",
      country_id: "5",
      q: "Rao",
    });
  });

  it("creates and updates with the body wrapped in `employee`", async () => {
    const bodies: unknown[] = [];
    const detail = {
      ...EMPLOYEES[0],
      email: null,
      current_salary: null,
      created_at: "x",
      updated_at: "x",
    };
    server.use(
      http.post("*/api/v1/employees", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: detail }, { status: 201 });
      }),
      http.patch("*/api/v1/employees/101", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: detail });
      }),
    );

    await employeeService.create({
      employee_number: "EMP-10001",
      first_name: "Asha",
      last_name: "Rao",
      country_id: 5,
      department_id: 1,
      initial_salary: {
        amount: "85000.50",
        currency_code: "INR",
        effective_from: "2026-10-01",
      },
    });
    await employeeService.update(101, { department_id: 2 });

    expect(bodies).toEqual([
      {
        employee: {
          employee_number: "EMP-10001",
          first_name: "Asha",
          last_name: "Rao",
          country_id: 5,
          department_id: 1,
          initial_salary: {
            amount: "85000.50",
            currency_code: "INR",
            effective_from: "2026-10-01",
          },
        },
      },
      { employee: { department_id: 2 } },
    ]);
  });

  it("gets one employee's detail", async () => {
    const detail = {
      ...EMPLOYEES[0],
      email: "asha@example.test",
      current_salary: null,
      created_at: "x",
      updated_at: "x",
    };
    server.use(
      http.get("*/api/v1/employees/101", () =>
        HttpResponse.json({ data: detail }),
      ),
    );

    await expect(employeeService.get(101)).resolves.toEqual(detail);
  });
});
