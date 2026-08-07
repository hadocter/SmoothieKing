import { apiFetch } from "../api";

/**
 * The daily build: ask, generate, choose.
 *
 * Distinct from `features/recommendation`, which searches the catalog. This is
 * the flow that produces something new, and the two now sit behind one screen.
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
  body: { preset: string; subGoals: string[]; count?: number },
  token: string | null,
): Promise<GenerateResult> =>
  apiFetch<GenerateResult>("/api/recipes/generate", token, {
    method: "POST",
    body: { preset: body.preset, secondaryGoals: body.subGoals, count: body.count ?? 10 },
  });
