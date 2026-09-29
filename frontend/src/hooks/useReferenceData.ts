import { useQuery } from "@tanstack/react-query";
import { referenceService } from "@/services/referenceService";

// Reference lists are seeded and read-only, so each is loaded once per session (S6). Signing out clears
// them with the rest of the cache (R6).

export function useCountries() {
  return useQuery({
    queryKey: ["reference", "countries"],
    queryFn: () => referenceService.getCountries(),
    staleTime: Infinity,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["reference", "departments"],
    queryFn: () => referenceService.getDepartments(),
    staleTime: Infinity,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["reference", "currencies"],
    queryFn: () => referenceService.getCurrencies(),
    staleTime: Infinity,
  });
}
