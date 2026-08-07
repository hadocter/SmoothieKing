import { apiFetch } from "../api";

/**
 * Today's smoothie: find one that fits, or build one.
 *
 * The two calls are separate because they are separate decisions. Searching is
 * cheap and read-only; generating writes rows and is something the user asks
 * for, either because nothing fit or because they want something new. Wrapping
 * both behind one "getRecommendation" would hide which of those happened, and
 * the screen says something different for each.
 */

export interface RecommendedRecipe {
  id: number;
  name: string;
  tagline: string;
  calories: number | null;
  protein: number | null;
  ingredients: { name: string; amount: string; unit: string; benefit: string }[];
  matchScore: number;
  source: string;
}

export interface MatchResponse {
  goal: string;
  /** How many cleared the threshold in total, before the display cap. */
  matchCount: number;
  blockedBySafety: number;
  /** Stated allergies the catalog cannot express. */
  unenforceableAllergies: string[];
  recipes: RecommendedRecipe[];
}

export interface GenerateResponse {
  goal: string;
  preset: string;
  /** Built and saved, against how many are worth offering. */
  generatedCount: number;
  matchCount: number;
  recipes: RecommendedRecipe[];
}

/**
 * The entry menu.
 *
 * Four buttons rather than one, because a single "make me a smoothie" button
 * has to be followed by questions about today — how much time, how hungry —
 * and asking those every morning turns a daily habit into a chore. Making the
 * button the question asks them once, in a tap.
 *
 * Ids must match PRESETS on the server.
 */
export const PRESETS = [
  { id: "great", label: "A great one", line: "Everything working together." },
  { id: "quick", label: "A quick one", line: "Few things to fetch. Out the door." },
  { id: "heavy", label: "A heavy one", line: "This is the meal." },
  { id: "light", label: "A light one", line: "Something, not much." },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];

export function findMatches(goal: string, token: string | null): Promise<MatchResponse> {
  return apiFetch<MatchResponse>(`/api/recipes/match?goal=${encodeURIComponent(goal)}`, token);
}

export function generateRecipes(preset: PresetId, token: string | null): Promise<GenerateResponse> {
  return apiFetch<GenerateResponse>("/api/recipes/generate", token, {
    method: "POST",
    body: { preset },
  });
}

export function logDrink(recipeId: number, token: string | null): Promise<{ id: number }> {
  return apiFetch<{ id: number }>("/api/smoothie-logs", token, {
    method: "POST",
    body: { recipeId },
  });
}
