import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { referenceService } from "@/services/referenceService";
import {
  COUNTRIES,
  CURRENCIES,
  DEPARTMENTS,
  mockReferenceData,
} from "@/test/fixtures/referenceData";
import { server } from "@/test/server";

describe("referenceService", () => {
  it("returns the countries, departments, and currencies lists", async () => {
    mockReferenceData();

    await expect(referenceService.getCountries()).resolves.toEqual(COUNTRIES);
    await expect(referenceService.getDepartments()).resolves.toEqual(
      DEPARTMENTS,
    );
    await expect(referenceService.getCurrencies()).resolves.toEqual(CURRENCIES);
  });

  it("passes API errors through as ApiError", async () => {
    server.use(
      http.get("*/api/v1/countries", () =>
        HttpResponse.json(
          { error: { code: "unauthenticated", message: "Please sign in." } },
          { status: 401 },
        ),
      ),
    );

    await expect(referenceService.getCountries()).rejects.toMatchObject({
      status: 401,
      code: "unauthenticated",
    });
  });
});
