import { describe, expect, it } from "vitest";
import {
  changedFields,
  EMPTY_EMPLOYEE,
  requiredFieldErrors,
  toCreateInput,
  valuesFromEmployee,
  type EmployeeFormValues,
} from "@/components/employees/employeeFormValues";
import { employeeDetail } from "@/test/fixtures/employeeDetail";

const FILLED: EmployeeFormValues = {
  ...EMPTY_EMPLOYEE,
  employee_number: " EMP-10001 ",
  first_name: "Asha",
  last_name: "Rao",
  country_id: "5",
  department_id: "1",
};

describe("employee form values (T7–T9)", () => {
  it("builds the create body, leaving out empty optional fields", () => {
    expect(toCreateInput(FILLED)).toEqual({
      employee_number: "EMP-10001",
      first_name: "Asha",
      last_name: "Rao",
      country_id: 5,
      department_id: 1,
      employment_status: "active",
    });
  });

  it("includes the initial salary with the amount exactly as typed (T8)", () => {
    const input = toCreateInput({
      ...FILLED,
      email: "asha@example.test",
      hired_on: "2026-10-01",
      addSalary: true,
      amount: " 85000.5 ",
      currency_code: "INR",
      effective_from: "2026-10-01",
    });

    expect(input.initial_salary).toEqual({
      amount: "85000.5",
      currency_code: "INR",
      effective_from: "2026-10-01",
    });
    expect(typeof input.initial_salary?.amount).toBe("string");
    expect(input).toMatchObject({
      email: "asha@example.test",
      hired_on: "2026-10-01",
    });
  });

  it('finds only the changed fields; clearing email sends "" and clearing the hire date sends null (T9)', () => {
    const initial = valuesFromEmployee(employeeDetail());

    expect(changedFields(initial, initial)).toEqual({});
    expect(changedFields(initial, { ...initial, department_id: "2" })).toEqual({
      department_id: 2,
    });
    expect(
      changedFields(initial, { ...initial, email: "", hired_on: "" }),
    ).toEqual({ email: "", hired_on: null });
    expect(
      changedFields(initial, {
        ...initial,
        employment_status: "terminated",
        last_name: " Rao-Menon ",
      }),
    ).toEqual({
      employment_status: "terminated",
      last_name: "Rao-Menon",
    });
  });

  it("requires the mandatory fields, and the salary fields only when a salary is added on create", () => {
    expect(
      Object.keys(requiredFieldErrors(EMPTY_EMPLOYEE, "create")).sort(),
    ).toEqual([
      "country_id",
      "department_id",
      "employee_number",
      "first_name",
      "last_name",
    ]);
    expect(
      Object.keys(
        requiredFieldErrors({ ...FILLED, addSalary: true }, "create"),
      ).sort(),
    ).toEqual([
      "initial_salary.amount",
      "initial_salary.currency_code",
      "initial_salary.effective_from",
    ]);
    expect(requiredFieldErrors({ ...FILLED, addSalary: true }, "edit")).toEqual(
      {},
    );
  });
});
