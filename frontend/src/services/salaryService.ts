import { apiRequest, type DataEnvelope } from "@/services/api";
import type {
  SalaryChangeInput,
  SalaryCorrectionInput,
  SalaryRecord,
} from "@/services/salary.types";

// Salary record endpoints (API spec §7). There is no delete: history is always preserved.

export const salaryService = {
  /** One employee's full history, newest first (unpaginated; bounded per employee). */
  async list(employeeId: number): Promise<SalaryRecord[]> {
    const { data } = await apiRequest<DataEnvelope<SalaryRecord[]>>(
      `/employees/${employeeId}/salary_records`,
    );
    return data;
  },

  /** Salary change: the API closes the previous period the day before and adds the new record (§7.3). */
  async change(
    employeeId: number,
    input: SalaryChangeInput,
  ): Promise<SalaryRecord> {
    const { data } = await apiRequest<DataEnvelope<SalaryRecord>>(
      `/employees/${employeeId}/salary_records`,
      { method: "POST", body: JSON.stringify({ salary_record: input }) },
    );
    return data;
  },

  /** Correction of a current or scheduled record's amount and/or currency (§7.5). */
  async correct(
    employeeId: number,
    recordId: number,
    changes: SalaryCorrectionInput,
  ): Promise<SalaryRecord> {
    const { data } = await apiRequest<DataEnvelope<SalaryRecord>>(
      `/employees/${employeeId}/salary_records/${recordId}`,
      { method: "PATCH", body: JSON.stringify({ salary_record: changes }) },
    );
    return data;
  },
};
