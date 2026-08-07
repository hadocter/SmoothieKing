/**
 * Turning builds into stored recipes.
 *
 * The flow the product asks for is: look for a recipe that already fits the
 * goal, offer it if there is one, and otherwise generate. Generation makes a
 * batch rather than a single drink, because one deterministic build is one
 * answer and the point of asking is to choose. Each variant is scored on the
 * way in and the score is stored, so ranking a batch later costs a query
 * rather than a rebuild.
 *
 * Every generated recipe is kept. They are the user's history — what they
 * actually drank — and a history with the unremarkable entries pruned out is
 * not a shorter history, it is a wrong one. They are also what gets published
 * if the user wants to publish, which is why `published` starts false: the
 * drink was built from someone's profile and answers, and it stays theirs
 * until they say otherwise.
 */

import { createHash } from "node:crypto";
import {
  buildSmoothie,
  type BuildProfile,
  type BuildResult,
  type BuildableIngredient,
  type Preset,
} from "./builder.ts";
import { scoreRecipe, resolveItems, GOAL_MATCH_THRESHOLD, type GoalScores } from "../scoring/index.ts";
import { fallbackNaming, nameDrink } from "../naming/index.ts";
import { appearanceOf, representativeIngredients } from "./appearance.ts";

/** How many variants a batch produces before ranking. */
export const DEFAULT_BATCH = 10;

export interface GeneratedRecipe {
  name: string;
  slug: string;
  category: string;
  tagline: string;
  description: string;
  prepTimeMinutes: number;
  servings: number;
  calories: number | null;
  protein: number | null;
  benefits: string[];
  ingredients: { name: string; amount: string; unit: string; benefit: string }[];
  steps: string[];
  imageUrl: string;
  isFeatured: boolean;
  difficulty: string;
  tags: string[];
  goalScores: GoalScores;
  source: string;
  published: boolean;
}

/**
 * Preset to the app's existing category vocabulary.
 *
 * "Heavy one" is what someone picks instead of a meal and "quick one" is what
 * they shake and leave with, which is what those two categories already mean
 * here. Nothing new is introduced.
 */
const CATEGORY: Record<Preset, string> = {
  great: "smoothie",
  light: "smoothie",
  heavy: "meal",
  quick: "shaker",
};

/**
 * Slug from the contents, not from a counter.
 *
 * Two builds that produce the same drink are the same recipe, and giving them
 * separate rows would fill the history with duplicates that differ only by
 * when they were made. A content hash makes the collision the useful kind: the
 * caller can insert and do nothing on conflict, and the drink is stored once.
 */
function slugFor(goal: string, names: string[]): string {
  const digest = createHash("sha1")
    .update(`${goal}::${[...names].sort().join("|")}`)
    .digest("hex")
    .slice(0, 10);
  return `gen-${goal}-${digest}`;
}

function toIngredients(result: BuildResult): GeneratedRecipe["ingredients"] {
  return result.picks.map((p) => ({
    name: p.name,
    amount: String(p.grams),
    // The catalog stores one number per ingredient and liquids are measured by
    // volume, so the unit follows the slot rather than being recorded per row.
    unit: p.slot === "liquid" ? "ml" : "g",
    // The `benefit` field is what the recipe card shows beside an ingredient.
    // For a generated drink that is the reason it was picked, which is more
    // use than a nutrition claim nobody sourced.
    benefit: p.reason,
  }));
}

function toSteps(result: BuildResult): string[] {
  const [first, ...rest] = result.picks;
  if (!first) return [];
  return [
    `Pour in the ${first.name.toLowerCase()} first — a liquid at the bottom gives the blades something to work with.`,
    ...rest.map((p) => `Add the ${p.name.toLowerCase()}.`),
    "Blend on high until smooth, about 45 seconds.",
  ];
}

/**
 * Builds one variant and dresses it as a recipe row.
 *
 * The catalog is passed in twice over — once for building and once for scoring
 * — on purpose. Scoring reads the finished ingredient list the same way it
 * reads a hand-written recipe, so a generated drink and a curated one are
 * measured by the same code rather than by a shortcut that happens to know how
 * the drink was made.
 */
export function generateOne(
  profile: BuildProfile,
  catalog: BuildableIngredient[],
  options: { preset?: Preset; seed?: number } = {},
): { recipe: GeneratedRecipe; result: BuildResult } {
  const preset = options.preset ?? "great";
  const result = buildSmoothie(profile, catalog, { preset, seed: options.seed });
  const ingredients = toIngredients(result);

  const { items } = resolveItems(ingredients, catalog);
  const goalScores = scoreRecipe(items);

  const goalLabel = profile.primaryGoal.replace(/-/g, " ");

  return {
    result,
    recipe: {
      // A deterministic placeholder, replaced by `applyNaming` for the drinks
      // that are actually offered. Building stays synchronous and testable
      // without a network; naming is a separate step that may fail.
      name: fallbackNaming({ picks: result.picks, goal: profile.primaryGoal, subGoals: profile.secondaryGoals, preset }).name,
      slug: slugFor(profile.primaryGoal, result.picks.map((p) => p.name)),
      category: CATEGORY[preset],
      // Stated plainly rather than written in the app's marketing voice. A
      // generated drink has no copywriter, and inventing one would put words
      // in the brand's mouth.
      tagline: `Built around ${goalLabel}.`,
      description: `Generated for a ${goalLabel} goal. ${result.picks.length} ingredients.`,
      // Two minutes of setup plus a beat per ingredient to fetch and measure.
      prepTimeMinutes: 2 + result.picks.length,
      servings: 1,
      calories: result.totalKcal,
      protein: result.totalProteinG,
      // For a generated recipe the editorial tags and the computed scores are
      // the same thing, because nobody wrote an opinion for them to differ
      // from. Curated recipes keep both separately and can disagree.
      benefits: Object.entries(goalScores)
        .filter(([, s]) => s >= GOAL_MATCH_THRESHOLD)
        .sort((a, b) => b[1] - a[1])
        .map(([g]) => g),
      ingredients,
      steps: toSteps(result),
      // Empty on purpose. The card falls back to its own placeholder, which is
      // honest; attaching a stock photo of a different drink would not be.
      imageUrl: "",
      isFeatured: false,
      difficulty: "easy",
      tags: [profile.primaryGoal, ...profile.secondaryGoals, preset],
      goalScores,
      source: "generated",
      published: false,
    },
  };
}

/**
 * A batch of variants, deduplicated and ranked on the main goal.
 *
 * Variety comes from the seed, and seeds are consecutive from a base so that
 * the same request produces the same batch. Different seeds often land on the
 * same drink — the ranking is doing its job, and the top of a shortlist is a
 * small place — so identical builds collapse by slug rather than being offered
 * twice with different numbers on them.
 */
/**
 * A generated drink: the row that gets stored, and how it was built.
 *
 * The picks come back alongside because two things downstream need them and
 * the stored row cannot answer either. The gradient is derived from the
 * ingredients' colours, and naming reads slots to know which ingredient is the
 * base — neither is recoverable from a list of `{name, amount, unit}`.
 */
export interface GeneratedDrink {
  recipe: GeneratedRecipe;
  result: BuildResult;
}

export function generateBatch(
  profile: BuildProfile,
  catalog: BuildableIngredient[],
  options: { preset?: Preset; count?: number; seedBase?: number } = {},
): GeneratedDrink[] {
  const count = options.count ?? DEFAULT_BATCH;
  const seedBase = options.seedBase ?? 0;

  const bySlug = new Map<string, GeneratedDrink>();
  for (let n = 0; n < count; n += 1) {
    const drink = generateOne(profile, catalog, {
      preset: options.preset,
      seed: seedBase + n,
    });
    if (drink.recipe.ingredients.length === 0) continue;
    if (!bySlug.has(drink.recipe.slug)) bySlug.set(drink.recipe.slug, drink);
  }

  return [...bySlug.values()].sort(
    (a, b) =>
      (b.recipe.goalScores[profile.primaryGoal] ?? 0) - (a.recipe.goalScores[profile.primaryGoal] ?? 0) ||
      a.recipe.slug.localeCompare(b.recipe.slug),
  );
}

/**
 * Names and describes a set of drinks with the model, in parallel.
 *
 * Applied to the drinks that are actually offered rather than to the whole
 * batch. A batch of ten shows six, and ten model calls to name four drinks
 * nobody will read is cost for nothing — the unoffered ones keep the
 * deterministic name they were built with, which is a real name rather than a
 * placeholder.
 *
 * Parallel and individually fault-tolerant: `nameDrink` never throws, so one
 * slow or failed call costs one plain name rather than the whole screen.
 */
export async function applyNaming(
  drinks: GeneratedDrink[],
  profile: BuildProfile,
  preset: Preset,
): Promise<GeneratedDrink[]> {
  const named = await Promise.all(
    drinks.map(async (drink) => {
      const { name, story } = await nameDrink({
        picks: drink.result.picks,
        goal: profile.primaryGoal,
        subGoals: profile.secondaryGoals,
        preset,
      });
      return { drink, name, story };
    }),
  );

  // Names have to be distinct within a batch, and they are not by default:
  // the drinks in a batch are similar by construction, so the model naming
  // them independently produces collisions — two of six came back as
  // "Blueberry Banana Boost" on the first real run. Two identically-named
  // cards on a choosing screen is not a cosmetic problem; it makes the choice
  // impossible to reason about.
  //
  // A collision falls back to the deterministic ingredient name, which is
  // derived from the picks and therefore differs whenever the drinks do.
  const taken = new Set<string>();
  return named.map(({ drink, name, story }) => {
    let final = name;
    if (taken.has(final.toLowerCase())) {
      final = fallbackNaming({
        picks: drink.result.picks,
        goal: profile.primaryGoal,
        subGoals: profile.secondaryGoals,
        preset,
      }).name;
    }
    // Two drinks that are genuinely the same shape can still collide; the
    // distinguishing ingredient is the honest tiebreak.
    if (taken.has(final.toLowerCase())) {
      const extra = drink.result.picks.find((p) => !final.toLowerCase().includes(p.name.toLowerCase()));
      if (extra) final = `${final} with ${extra.name}`;
    }
    taken.add(final.toLowerCase());
    return { ...drink, recipe: { ...drink.recipe, name: final, description: story } };
  });
}

/**
 * How a drink should look and what to call its ingredients on a card.
 *
 * Derived rather than stored: it is a pure function of the picks, and a column
 * would be a copy that could disagree with them after an edit.
 */
export function presentation(drink: GeneratedDrink, catalog: BuildableIngredient[]) {
  const hexOf = (name: string): string | null =>
    catalog.find((c) => c.name === name)?.hex ?? null;
  return {
    appearance: appearanceOf(drink.result.picks, hexOf),
    representativeIngredients: representativeIngredients(drink.result.picks),
  };
}
