import { apiFetch } from "../api";

/**
 * The daily build: ask, look, build, choose.
 *
 * Searching the catalog and generating something new used to be two screens,
 * which meant two answers to the same question and two places for the flow to
 * drift. They are one now: the search runs alongside the build and its results
 * fill the first few slots.
 */

export interface BuiltIngredient {
  name: string;
  amount: string;
  unit: string;
  benefit: string;
}

export interface Appearance {
  stops: string[];
  css: string;
  blend: string;
  onBlend: string;
}

export interface BuiltDrink {
  id: number;
  name: string;
  tagline: string;
  description: string;
  calories: number | null;
  protein: number | null;
  prepTimeMinutes: number;
  ingredients: BuiltIngredient[];
  steps: string[];
  matchScore: number;
  source: string;
  /** Derived from the drink's own ingredients. Absent on catalog recipes. */
  appearance?: Appearance;
  representativeIngredients?: string[];
}

export interface GenerateResult {
  goal: string;
  preset: string;
  generatedCount: number;
  matchCount: number;
  recipes: BuiltDrink[];
}

/**
 * How long people are willing to spend, as offered choices.
 *
 * Minutes rather than an abstract "quick or thorough", because minutes are
 * what someone actually knows about their morning. The server maps these onto
 * the presets that already exist rather than keeping a second notion of speed.
 */
export const TIME_CHOICES = [
  { minutes: 3, label: "3 minutes", line: "Barely a pause." },
  { minutes: 5, label: "5 minutes", line: "Normal morning." },
  { minutes: 8, label: "8 minutes", line: "No rush." },
  { minutes: 15, label: "As long as it takes", line: "Make it good." },
] as const;

/**
 * Preset for a time budget.
 *
 * Mirrors `presetForMinutes` on the server. Duplicated rather than fetched
 * because it decides what the button says before any request is made, and a
 * round trip to label a button is worse than a rule stated twice — but the
 * server remains the one that decides what actually gets built.
 */
export function presetForMinutes(minutes: number): string {
  if (minutes >= 8) return "great";
  if (minutes >= 5) return "light";
  return "quick";
}

export const generateDrinks = (
  body: { preset: string; subGoals: string[]; tastes?: string[]; count?: number },
  token: string | null,
): Promise<GenerateResult> =>
  apiFetch<GenerateResult>("/api/recipes/generate", token, {
    method: "POST",
    body: {
      preset: body.preset,
      secondaryGoals: body.subGoals,
      // Today's taste, when they said one. Omitted rather than sent empty so
      // the server falls back to the profile's standing preference instead of
      // reading "no preference at all".
      ...(body.tastes && body.tastes.length > 0 ? { tastePreference: body.tastes } : {}),
      count: body.count ?? 10,
    },
  });

export interface MatchResult {
  goal: string;
  matchCount: number;
  blockedBySafety: number;
  unenforceableAllergies: string[];
  recipes: BuiltDrink[];
}

export const findMatches = (goal: string, token: string | null): Promise<MatchResult> =>
  apiFetch<MatchResult>(`/api/recipes/match?goal=${encodeURIComponent(goal)}`, token);

/**
 * How many of the six may come off the shelf.
 *
 * Searching before building is right — a recipe that already fits is a real
 * answer and costs nothing to find. But a catalog recipe was written for a
 * goal, not for today's time budget or sub-goals, so it fits less exactly than
 * something built this minute. Three leaves half the set genuinely made for
 * today, which is what the screen promises.
 */
export const MAX_FROM_SHELF = 3;

export const logDrink = (recipeId: number, token: string | null): Promise<{ id: number }> =>
  apiFetch<{ id: number }>("/api/smoothie-logs", token, { method: "POST", body: { recipeId } });

export const editRecipe = (
  id: number,
  patch: { name?: string; description?: string; imageUrl?: string },
  token: string | null,
): Promise<BuiltDrink> =>
  apiFetch<BuiltDrink>(`/api/recipes/${id}`, token, { method: "PATCH", body: patch });

/**
 * Loads the actual published drink behind a community post.
 *
 * This is deliberately the same read used by the public recipe page, rather
 * than reconstructing ingredients from the card. A community card is a
 * summary; the recipe is the constrained build that can safely enter the
 * make flow.
 */
export const getRecipeForMaking = (id: number, token: string | null): Promise<BuiltDrink> =>
  apiFetch<Partial<BuiltDrink>>(`/api/recipes/${id}`, token).then((recipe) => ({
    id: recipe.id ?? id,
    name: recipe.name ?? "Community recipe",
    tagline: recipe.tagline ?? "A recipe shared by the community.",
    description: recipe.description ?? "",
    calories: recipe.calories ?? null,
    protein: recipe.protein ?? null,
    prepTimeMinutes: recipe.prepTimeMinutes ?? 5,
    ingredients: recipe.ingredients ?? [],
    steps: recipe.steps ?? [],
    matchScore: recipe.matchScore ?? 0,
    source: recipe.source ?? "community",
  }));

/**
 * Posts a published drink to the community board.
 *
 * A creation is the social object and a recipe is the drink; publishing has to
 * make both, or the recipe becomes visible to nobody. Publishing used to flip
 * a flag on the recipe alone, which is why a drink built, made and posted
 * appeared in neither the board nor the profile.
 */
export const postToBoard = (
  drink: BuiltDrink,
  token: string | null,
): Promise<{ id: number }> =>
  apiFetch<{ id: number }>("/api/creations", token, {
    method: "POST",
    body: {
      colorHex: drink.appearance?.blend ?? "#3B82F6",
      recipeId: drink.id,
    },
  });

export const publishRecipe = (id: number, token: string | null): Promise<BuiltDrink> =>
  apiFetch<BuiltDrink>(`/api/recipes/${id}/publish`, token, {
    method: "POST",
    body: { published: true },
  });
