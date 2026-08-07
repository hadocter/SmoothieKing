/**
 * Picking recipes for a goal.
 *
 * Kept apart from the route so the ordering rule below is a testable function
 * rather than a shape that happens to fall out of how a handler was written.
 */

import type { Recipe } from "@workspace/db";
import { GOAL_MATCH_THRESHOLD, MAX_OFFERED, type GoalScores } from "../scoring/index.ts";
import { checkRecipe, type CheckableIngredient, type SafetyConstraints } from "../safety/index.ts";

/** Reads the stored scores defensively — it is a jsonb column, not a type. */
export function scoresOf(recipe: Pick<Recipe, "goalScores">): GoalScores {
  const raw = recipe.goalScores;
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as GoalScores) : {};
}

export interface MatchResult {
  /** Everything that cleared the threshold, ranked. Not yet capped. */
  ranked: { recipe: Recipe; score: number }[];
  /** How many were removed by a safety rule, for saying so. */
  blockedBySafety: number;
}

/**
 * Safety first, then the goal threshold, then ranking.
 *
 * The order is fixed and it matters. Ranking first and checking safety when
 * rendering would produce the same list today, but it makes safety a property
 * of the presentation rather than of the set — and the first thing to cache or
 * paginate the ranked list puts an unsafe recipe in it.
 */
export function matchRecipes(
  recipes: Recipe[],
  goal: string,
  catalog: CheckableIngredient[],
  constraints: SafetyConstraints,
): MatchResult {
  const ranked: { recipe: Recipe; score: number }[] = [];
  let blockedBySafety = 0;

  for (const recipe of recipes) {
    if (!checkRecipe(recipe.ingredients, catalog, constraints).safe) {
      blockedBySafety += 1;
      continue;
    }
    const score = scoresOf(recipe)[goal] ?? 0;
    if (score >= GOAL_MATCH_THRESHOLD) ranked.push({ recipe, score });
  }

  // Ties broken by id so the same request never reorders between calls.
  ranked.sort((a, b) => b.score - a.score || a.recipe.id - b.recipe.id);
  return { ranked, blockedBySafety };
}

/**
 * The slice to show, and the number that actually qualified.
 *
 * Capped, never padded: everything returned genuinely clears the bar, and the
 * count is the true one so a client can say "6 of 11" rather than implying six
 * is all there is. See MAX_OFFERED for why six.
 */
export function offer<T>(ranked: T[]): { shown: T[]; total: number } {
  return { shown: ranked.slice(0, MAX_OFFERED), total: ranked.length };
}
