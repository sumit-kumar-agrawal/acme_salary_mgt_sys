import { apiRequest, type DataEnvelope } from "@/services/api";
import type { Country, Currency, Department } from "@/services/reference.types";

// Read-only reference lists (API spec §5): small, seeded, unpaginated.

export const referenceService = {
  /** Countries ordered by name. */
  async getCountries(): Promise<Country[]> {
    const { data } = await apiRequest<DataEnvelope<Country[]>>("/countries");
    return data;
  },

  /** Departments ordered by name. */
  async getDepartments(): Promise<Department[]> {
    const { data } =
      await apiRequest<DataEnvelope<Department[]>>("/departments");
    return data;
  },

  /** Currencies ordered by code, with their minor units. */
  async getCurrencies(): Promise<Currency[]> {
    const { data } = await apiRequest<DataEnvelope<Currency[]>>("/currencies");
    return data;
  },
};
