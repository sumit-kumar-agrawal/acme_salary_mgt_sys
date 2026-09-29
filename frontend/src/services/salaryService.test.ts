import { describe, expect, it } from "vitest";
import { salaryService } from "@/services/salaryService";
import {
  mockSalaryRecords,
  mockSalaryWrites,
  SALARY_HISTORY,
} from "@/test/fixtures/salaryRecords";

describe("salaryService", () => {
  it("lists one employee's salary history as the API returns it", async () => {
    mockSalaryRecords();

    await expect(salaryService.list(101)).resolves.toEqual(SALARY_HISTORY);
  });

  it("records a salary change with the amount as a string", async () => {
    const { requests } = mockSalaryWrites();

    const saved = await salaryService.change(101, {
      amount: "92000.50",
      currency_code: "INR",
      effective_from: "2027-04-01",
    });

    expect(requests).toEqual([
      {
        method: "POST",
        path: "/api/v1/employees/101/salary_records",
        body: {
          salary_record: {
            amount: "92000.50",
            currency_code: "INR",
            effective_from: "2027-04-01",
          },
        },
      },
    ]);
    expect(saved.amount).toBe("92000.50");
  });

  it("corrects one record with only the given fields", async () => {
    const { requests } = mockSalaryWrites();

    await salaryService.correct(101, 4, { amount: "93000.00" });

    expect(requests).toEqual([
      {
        method: "PATCH",
        path: "/api/v1/employees/101/salary_records/4",
        body: { salary_record: { amount: "93000.00" } },
      },
    ]);
  });
});
