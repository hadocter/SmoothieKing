import { apiFetch } from "../api";

/**
 * The allergen check.
 *
 * The types mirror the server's report exactly. They are duplicated rather
 * than generated because these endpoints are not in the OpenAPI spec yet; when
 * they are, this file is the one place that changes.
 */

export interface IngredientCheck {
  name: string;
  contains: string[];
  animal: boolean;
  violations: string[];
  passed: boolean;
}

export interface SafetyReport {
  safe: boolean;
  checks: IngredientCheck[];
  unknownIngredients: string[];
  unresolvedConstraints: string[];
  blockedBy: string[];
  checkedAgainst: { allergens: string[]; excludedNames: string[]; vegan: boolean };
}

/** True when the caller stated anything for the check to act on. */
export function hasConstraints(report: SafetyReport): boolean {
  const { allergens, excludedNames, vegan } = report.checkedAgainst;
  return allergens.length > 0 || excludedNames.length > 0 || vegan;
}

export function verifyIngredients(
  names: string[],
  token: string | null,
): Promise<SafetyReport> {
  return apiFetch<SafetyReport>("/api/safety/verify", token, {
    method: "POST",
    body: { ingredients: names.map((name) => ({ name })) },
  });
}

export { AllergenScan } from "./AllergenScan";
