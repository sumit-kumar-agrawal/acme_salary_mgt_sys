import { http, HttpResponse } from "msw";
import type { Country, Currency, Department } from "@/services/reference.types";
import { server } from "@/test/server";

// Synthetic reference data (API spec §5 shapes and order) with request counters.

export const COUNTRIES: Country[] = [
  { id: 3, code: "DE", name: "Germany" },
  { id: 5, code: "IN", name: "India" },
];
export const DEPARTMENTS: Department[] = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Finance" },
];
export const CURRENCIES: Currency[] = [
  { code: "INR", name: "Indian Rupee", minor_units: 2 },
  { code: "JPY", name: "Japanese Yen", minor_units: 0 },
  { code: "KWD", name: "Kuwaiti Dinar", minor_units: 3 },
];

export function mockReferenceData({ fail = false }: { fail?: boolean } = {}) {
  const requests = { countries: 0, departments: 0, currencies: 0 };
  const respond = (key: keyof typeof requests, data: unknown) => () => {
    requests[key] += 1;
    if (fail)
      return HttpResponse.json(
        { error: { code: "internal_error", message: "Something went wrong." } },
        { status: 500 },
      );
    return HttpResponse.json({ data });
  };
  server.use(
    http.get("*/api/v1/countries", respond("countries", COUNTRIES)),
    http.get("*/api/v1/departments", respond("departments", DEPARTMENTS)),
    http.get("*/api/v1/currencies", respond("currencies", CURRENCIES)),
  );
  return requests;
}
