/**
 * How well does a recipe serve a goal?
 *
 * This runs the build backwards. A generated smoothie is assembled by picking
 * ingredients that serve a goal; scoring reads a finished recipe and asks how
 * much of it was, in effect, picked that way. The same function scores the
 * hand-written recipes that were already here, so curated and generated
 * recipes are ranked on one scale rather than two.
 *
 * The output is one number per goal in 0..1, stored on the recipe. Matching
 * then filters on the *main* goal only — a score is a property of the drink,
 * not of the person asking for it, so nothing about a user profile belongs in
 * here.
 *
 *
 * Why two different measures
 *
 * The obvious method is to count tags: what share of the ingredients carry
 * this goal in `benefits`. Applied to the four recipes already in the
 * database, that method ranks "Cloud Nine Shaker" — the 42g protein shaker,
 * the one recipe explicitly built for protein — at 0.29 for protein-power,
 * below glowy-skin at 0.58. It would never surface for the goal it exists to
 * serve.
 *
 * The reason is that counting cannot see dose. Two scoops of whey isolate and
 * a quarter of an avocado are one tag each. What makes a protein drink a
 * protein drink is the grams, and the grams are exactly what the USDA columns
 * on `ingredients` were sourced for. Computing protein from those columns
 * separates the same four recipes cleanly: 26.8g against 2.7, 5.1 and 3.0.
 *
 * So protein-power is scored on dose and every other goal on tags. Not for
 * symmetry — because protein is the only goal in this taxonomy with a
 * measurable correlate in the data we actually have. "Glowy skin" has no
 * column. Caffeine would give energy-focus one, but there is no caffeine
 * column, and inventing a proxy out of the columns that do exist would be
 * making the number up. Those goals stay on tags until there is something real
 * to measure them with.
 */

/** Goal ids, matching GOAL_LABELS in the web app. */
export const GOALS = [
  "glowy-skin",
  "hydration",
  "sun-ritual",
  "protein-power",
  "anti-inflammatory",
  "detox-clarity",
  "gut-health",
  "energy-focus",
] as const;

export type Goal = (typeof GOALS)[number];

export type GoalScores = Record<string, number>;

/**
 * A recipe must clear this on the user's main goal to be offered for it.
 * Chosen by the product owner, not derived.
 */
export const GOAL_MATCH_THRESHOLD = 0.5;

/**
 * How many matches to offer at once.
 *
 * Not a layout constraint. Iyengar & Lepper (2000) found people shown 24 jams
 * were an order of magnitude less likely to buy than people shown 6, and were
 * *less satisfied* with what they picked — more options made the choice worse
 * on both counts. Six is the small condition from that work.
 *
 * The count is capped rather than fixed: everything above the threshold is a
 * genuine match, so showing four when four qualify is right, and padding to
 * six with drinks that do not clear it would be the opposite of matching.
 */
export const MAX_OFFERED = 6;

/**
 * Distinct on-goal ingredients at which a recipe counts as fully committed to
 * a goal. Three, so that a drink built around a goal reaches the top of the
 * range while one that merely brushes against it does not. A round number
 * standing in for a judgement, not a measurement.
 */
const FULL_DEPTH = 3;

/**
 * Protein in grams that counts as a full dose. Around the upper end of what a
 * single serving is usually built to deliver; past this, more protein does not
 * make the drink more of a protein drink.
 */
const PROTEIN_FULL_DOSE_G = 25;

/** Only the fields scoring reads. Keeps this callable from tests and seeds. */
export interface ScorableIngredient {
  name: string;
  benefits: string[];
  proteinG: number | null;
  servingGrams: number | null;
}

export interface ScorableItem {
  ingredient: ScorableIngredient;
  /**
   * Grams (or ml) of this ingredient in the glass.
   *
   * Generated recipes know this exactly. Hand-written ones record amounts as
   * prose — "2 scoops", "1/4 whole" — which is not parseable into grams with
   * any confidence, so callers pass the ingredient's own `servingGrams` and
   * the dose is an assumption rather than a reading. It understates a recipe
   * that calls for two scoops of something. It does not reorder the four
   * recipes here, but it is an approximation and worth knowing about.
   */
  grams: number | null;
}

/**
 * Share of the goal-bearing ingredients that carry this goal, combined with
 * how many of them there are.
 *
 * Both halves are needed. Share alone makes a two-ingredient drink look more
 * committed than a six-ingredient one built around the same goal; count alone
 * ignores that everything else in the glass is pulling elsewhere. The
 * geometric mean requires both — either at zero gives zero, which is the
 * intent.
 *
 * Ingredients with no benefits at all are left out of the denominator. Nine of
 * the forty-three are: ice, water, sweeteners. Counting them against every
 * goal would mean a recipe scored lower for containing ice, which describes
 * nothing about the drink.
 */
function tagScore(items: ScorableItem[], goal: string): number {
  const active = items.filter((i) => i.ingredient.benefits.length > 0);
  if (active.length === 0) return 0;

  const onGoal = active.filter((i) => i.ingredient.benefits.includes(goal)).length;
  if (onGoal === 0) return 0;

  const depth = Math.min(1, onGoal / FULL_DEPTH);
  const share = onGoal / active.length;
  return Math.sqrt(depth * share);
}

/**
 * Total protein in the glass, or null if any ingredient's protein is unknown.
 *
 * Null rather than a partial sum on purpose. A missing figure is not zero
 * protein — collagen peptides are close to pure protein and have no USDA row,
 * so treating the gap as zero would score the most protein-dense thing in the
 * catalog as contributing none. Returning null lets the caller fall back to
 * tags instead of trusting a number it should not.
 */
function totalProteinG(items: ScorableItem[]): number | null {
  let total = 0;
  for (const { ingredient, grams } of items) {
    if (ingredient.proteinG === null || grams === null) return null;
    total += (ingredient.proteinG * grams) / 100;
  }
  return total;
}

/**
 * Protein-power, on dose.
 *
 * Where protein data is complete this is the dose alone: a drink delivering
 * 25g of protein serves the goal whether or not its ingredients happen to be
 * tagged for it. Where a figure is missing, the tag score stands in — and even
 * with complete data the higher of the two wins, so an under-sourced
 * ingredient can only cost a recipe accuracy, never a place it had earned.
 */
function proteinScore(items: ScorableItem[]): number {
  const tag = tagScore(items, "protein-power");
  const protein = totalProteinG(items);
  if (protein === null) return tag;
  return Math.max(tag, Math.min(1, protein / PROTEIN_FULL_DOSE_G));
}

/** Scores a recipe against every goal. Always returns all of them. */
export function scoreRecipe(items: ScorableItem[]): GoalScores {
  const scores: GoalScores = {};
  for (const goal of GOALS) {
    const raw = goal === "protein-power" ? proteinScore(items) : tagScore(items, goal);
    // Two decimals: the inputs are tag membership and an assumed serving size,
    // and printing more digits than that would imply a precision the inputs do
    // not have.
    scores[goal] = Math.round(raw * 100) / 100;
  }
  return scores;
}

/**
 * Turns a recipe's stored ingredient list into something scorable.
 *
 * Recipes record their ingredients as `{ name, amount, unit }` — by name, not
 * by id — so scoring one means looking each name up in the catalog. The
 * catalog is passed in rather than read here, which keeps this module free of
 * the database and testable without one.
 *
 * Unresolved names are returned rather than dropped. A name that matches
 * nothing means the recipe and the catalog have drifted apart, and a score
 * computed from the ingredients that happened to match would look perfectly
 * normal while describing a different drink. Callers decide what to do; none
 * of them should ignore it.
 */
export function resolveItems(
  recipeIngredients: unknown,
  catalog: ScorableIngredient[],
): { items: ScorableItem[]; unresolved: string[] } {
  const byName = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c]));
  const items: ScorableItem[] = [];
  const unresolved: string[] = [];

  for (const raw of Array.isArray(recipeIngredients) ? recipeIngredients : []) {
    const name = typeof raw?.name === "string" ? raw.name : null;
    if (name === null) continue;
    const found = byName.get(name.trim().toLowerCase());
    if (!found) {
      unresolved.push(name);
      continue;
    }
    // The recipe's own amount is prose and stays unparsed; see ScorableItem.
    items.push({ ingredient: found, grams: found.servingGrams });
  }

  return { items, unresolved };
}

/** Goals a recipe clears the threshold on, best first. */
export function matchingGoals(scores: GoalScores): { goal: string; score: number }[] {
  return Object.entries(scores)
    .filter(([, s]) => s >= GOAL_MATCH_THRESHOLD)
    .map(([goal, score]) => ({ goal, score }))
    .sort((a, b) => b.score - a.score);
}
