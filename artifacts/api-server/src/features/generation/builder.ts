/**
 * Building a smoothie from a profile.
 *
 * Ported from the elicitation prototype, with the rules that depended on
 * columns this catalog does not have taken out rather than approximated. The
 * prototype's ingredients carried `caffeine`, `thickens`, `needsPower` and
 * `addedSugar` flags; the merged catalog kept slot, flavours, allergens and
 * nutrition. Where a rule needed a missing flag it is gone, not guessed —
 * inferring "this has caffeine" from an ingredient's name is the same class of
 * mistake as matching allergens on names, and it fails in the same direction.
 *
 * The build is a fixed sequence of slots. Each step ranks what is left and
 * takes one, so the shape of a glass is decided by the recipe skeleton and
 * only its contents by the profile. That is what makes a generated drink
 * recognisably a smoothie rather than a pile of high-scoring ingredients.
 *
 * Everything here is deterministic. The seed is an input, so variety and
 * "same input, same output" are not in tension: two calls with the same
 * profile and seed produce the same glass, and changing the seed is how you
 * ask for a different one.
 */

import {
  allowedIngredients,
  constraintsFrom,
  type CheckableIngredient,
  type SafetyConstraints,
} from "../safety/index.ts";

export interface BuildProfile {
  primaryGoal: string;
  secondaryGoals: string[];
  /** sweet | sour | nutty | fresh, from onboarding. */
  tastePreference: string[];
  allergies: string[];
  dislikedIngredients: string[];
  vegan?: boolean;
}

/**
 * The entry menu. Rather than one "make a smoothie" button and a questionnaire
 * about today, the choice of button *is* the question — how much time, how
 * hungry — asked once and answered in a tap.
 */
export type Preset = "great" | "quick" | "heavy" | "light";

export interface PresetSpec {
  id: Preset;
  label: string;
  /** Ceiling for optional ingredients. Liquid and protein are structural. */
  calorieTarget: number;
  /**
   * How many optional ingredients may go in at all. "Quick" is about the
   * number of things to fetch and measure, which a calorie ceiling does not
   * express: two 40-calorie extras and six of them cost the same calories and
   * very different amounts of morning.
   */
  maxExtras: number;
  /**
   * Roughly how long this takes to make, in minutes.
   *
   * Derived from `maxExtras` rather than being an independent number — every
   * optional ingredient is one more thing to fetch, measure and put back, so a
   * separate figure would be a second source of truth that drifts. Two minutes
   * of setup plus about a minute per extra.
   */
  minutes: number;
}

const withMinutes = (spec: Omit<PresetSpec, "minutes">): PresetSpec => ({
  ...spec,
  minutes: 2 + Math.min(spec.maxExtras, 6),
});

export const PRESETS: PresetSpec[] = [
  { id: "great", label: "Great one", calorieTarget: 420, maxExtras: 6 },
  { id: "quick", label: "Quick one", calorieTarget: 300, maxExtras: 2 },
  { id: "heavy", label: "Heavy one", calorieTarget: 620, maxExtras: 6 },
  { id: "light", label: "Light one", calorieTarget: 210, maxExtras: 3 },
].map(withMinutes);

const presetById = (id: Preset): PresetSpec =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/**
 * The preset that fits the time someone says they have.
 *
 * Asking "how many minutes do you have?" and asking "what kind of drink?" are
 * the same question wearing different clothes, and answering both would be
 * asking twice. This maps the time answer onto the presets that already exist
 * rather than introducing a parallel notion of speed that could disagree with
 * `maxExtras`.
 *
 * Ties go to the richer drink: given four minutes, "quick" (4) and "light" (5)
 * both nearly fit, and someone who said four minutes would rather be told a
 * five-minute option than have a choice quietly narrowed. Only `quick` is
 * offered when time is genuinely short.
 */
export function presetForMinutes(minutes: number): Preset {
  const affordable = PRESETS.filter((p) => p.minutes <= minutes);
  if (affordable.length === 0) return "quick";
  // The most substantial thing that fits, not the fastest.
  return affordable.reduce((best, p) => (p.calorieTarget > best.calorieTarget ? p : best)).id;
}

/** Presets that fit in the time available, for offering as choices. */
export function presetsWithin(minutes: number): PresetSpec[] {
  const affordable = PRESETS.filter((p) => p.minutes <= minutes);
  return affordable.length > 0 ? affordable : [presetById("quick")];
}

/** Fill target for the glass, in ml/g. */
const TARGET_VOLUME = 400;

/**
 * Onboarding's four taste words to the catalog's six flavour families.
 *
 * A judgement, not a lookup — the two vocabularies were written separately and
 * neither is a refinement of the other. "Sweet" covers tropical fruit, berries
 * and vanilla-spice warmth; "fresh" covers green and citrus. Overlaps are
 * intentional: citrus reads as both sour and fresh, and forcing it into one
 * would make the other preference mean less than the user thought it did.
 */
const TASTE_TO_FLAVORS: Record<string, string[]> = {
  sweet: ["tropical", "berry", "vanilla-spice"],
  sour: ["citrus", "berry"],
  nutty: ["chocolate-nutty", "vanilla-spice"],
  fresh: ["green-earthy", "citrus"],
};

function flavorFamilies(tastes: string[]): string[] {
  const out = new Set<string>();
  for (const t of tastes) {
    for (const f of TASTE_TO_FLAVORS[t.trim().toLowerCase()] ?? []) out.add(f);
  }
  return [...out];
}

/** An ingredient as the builder needs it: safety fields plus what it costs. */
export type BuildableIngredient = CheckableIngredient & {
  slot: string | null;
  hex: string | null;
  flavors: string[];
  kcal: number | null;
};

export interface Pick {
  step: number;
  name: string;
  slot: string;
  /** Why this ingredient, in terms of the profile field responsible. */
  reason: string;
  grams: number;
  kcal: number | null;
  proteinG: number | null;
}

export interface BuildResult {
  picks: Pick[];
  /** Ingredients kept out by a safety rule or a dislike, for display. */
  excludedNames: string[];
  /**
   * Totals, or null when any picked ingredient has no USDA figure. Null rather
   * than a partial sum: a total that silently omits the collagen is not a
   * smaller total, it is a wrong one.
   */
  totalKcal: number | null;
  totalProteinG: number | null;
  totalGrams: number;
  preset: Preset;
  seed: number;
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

/** Score descending, then name, so ties never flip between runs. */
function rank(
  list: BuildableIngredient[],
  score: (i: BuildableIngredient) => number,
): BuildableIngredient[] {
  return [...list]
    .map((i) => ({ i, s: score(i) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s || a.i.name.localeCompare(b.i.name))
    .map((x) => x.i);
}

/**
 * Goal fit. The main goal is worth three, each sub-goal one.
 *
 * That ratio is the design rather than a tuning constant: a third is enough to
 * break a tie between two ingredients the main goal likes equally, and never
 * enough to outrank something the main goal actually wants. The main goal is
 * the skeleton and sub-goals are the variation inside it.
 */
function servesGoals(i: BuildableIngredient, p: BuildProfile): number {
  const main = i.benefits.includes(p.primaryGoal) ? 3 : 0;
  const sub = p.secondaryGoals.reduce((acc, g) => acc + (i.benefits.includes(g) ? 1 : 0), 0);
  return main + sub;
}

const matchesFlavor = (i: BuildableIngredient, families: string[]): number =>
  i.flavors.some((f) => families.includes(f)) ? 2 : 0;

/**
 * Deterministic spread from (seed, step). Not cryptographic and does not need
 * to be — it only has to avoid landing on the same shortlist index at every
 * step of the same glass, which is what would make "varied" drinks all differ
 * in the same place.
 */
const spread = (seed: number, step: number): number =>
  Math.abs(Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(step + 1, 40503)) >>> 0;

/**
 * Choose among the top few rather than always the first.
 *
 * Only reaches into a shortlist the ranking already produced, so a varied
 * glass is still built from what the profile scored highest. Variety inside
 * the boundary, never past it — a drink that ignores the goal is not variety,
 * it is a different drink.
 */
const SHORTLIST_WIDTH = 4;

function pickVaried(
  ranked: BuildableIngredient[],
  seed: number,
  step: number,
): BuildableIngredient | undefined {
  const width = Math.min(SHORTLIST_WIDTH, ranked.length);
  if (width <= 1) return ranked[0];
  return ranked[spread(seed, step) % width];
}

/* ------------------------------------------------------------------ */
/* The build sequence                                                  */
/* ------------------------------------------------------------------ */

interface Step {
  slot: string;
  score: (i: BuildableIngredient, p: BuildProfile, families: string[]) => number;
  reason: (i: BuildableIngredient, p: BuildProfile) => string;
  skip?: (p: BuildProfile) => boolean;
}

const STEPS: Step[] = [
  {
    slot: "liquid",
    score: (i, p, f) => servesGoals(i, p) + matchesFlavor(i, f),
    reason: (i) => `${i.name} as the base.`,
  },
  {
    slot: "protein",
    score: (i, p) => servesGoals(i, p),
    reason: (i, p) =>
      p.primaryGoal === "protein-power"
        ? `${i.name} to hit a real protein number.`
        : `${i.name} so the glass holds up as something to drink instead of a snack.`,
  },
  {
    slot: "flavor",
    score: (i, p, f) => matchesFlavor(i, f) * 2 + servesGoals(i, p),
    reason: (i) => `${i.name} for the ${i.flavors[0] ?? "flavour"} side you picked.`,
  },
  {
    // A second flavour note, so the glass is not one-dimensional.
    slot: "flavor",
    score: (i, p, f) => matchesFlavor(i, f) + servesGoals(i, p),
    reason: (i) => `${i.name} alongside it, for a bit more depth.`,
  },
  {
    slot: "functional",
    score: (i, p) => servesGoals(i, p) * 2,
    // The reason has to match what the ingredient is actually doing. When
    // nothing in the functional slot serves the goal, the ranking still
    // returns something, and calling that "the pick for gut health" would be
    // the recipe telling the user a thing that is not true.
    reason: (i, p) =>
      i.benefits.includes(p.primaryGoal)
        ? `${i.name} is the functional pick for ${p.primaryGoal.replace(/-/g, " ")}.`
        : i.benefits.length > 0
          ? `${i.name} for its ${i.benefits[0].replace(/-/g, " ")} side.`
          : `${i.name}, for a bit of interest.`,
  },
  {
    slot: "thickener",
    score: (i, p) => servesGoals(i, p) + 1,
    reason: (i) => `${i.name} for body.`,
  },
  {
    slot: "sweetener",
    // Only when the profile actually asked for sweet. Nothing else in the
    // profile implies wanting sugar added, and adding it anyway would be the
    // system deciding on the user's behalf.
    skip: (p) => !p.tastePreference.some((t) => t.trim().toLowerCase() === "sweet"),
    score: () => 1,
    reason: (i) => `A little ${i.name.toLowerCase()} to round it off.`,
  },
];

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export function buildSmoothie(
  profile: BuildProfile,
  catalog: BuildableIngredient[],
  options: { preset?: Preset; seed?: number } = {},
): BuildResult {
  const preset = presetById(options.preset ?? "great");
  const seed = options.seed ?? 0;
  const families = flavorFamilies(profile.tastePreference);

  const constraints: SafetyConstraints = constraintsFrom({ allergies: profile.allergies }, catalog, {
    vegan: profile.vegan ?? false,
  });
  const { allowed, excludedNames } = allowedIngredients(
    catalog,
    constraints,
    profile.dislikedIngredients,
  );

  const picks: Pick[] = [];
  const used = new Set<string>();
  let grams = 0;
  let kcal = 0;
  let proteinG = 0;
  let kcalKnown = true;
  let proteinKnown = true;
  let extras = 0;

  for (const [stepIndex, step] of STEPS.entries()) {
    if (step.skip?.(profile)) continue;

    const pool = (allowed as BuildableIngredient[]).filter(
      (i) => i.slot === step.slot && !used.has(i.name),
    );
    const ranked = rank(pool, (i) => step.score(i, profile, families));
    const chosen = pickVaried(ranked, seed, stepIndex);
    if (!chosen) continue;

    // What this ingredient actually costs, at the amount actually used.
    //
    // The catalog stores nutrition per 100g and servings are nowhere near
    // 100g for most of it. Comparing the per-100g figure against the running
    // total — which is a real total — mixes the two scales, and it does so in
    // the direction that quietly wrecks the drink: turmeric at 312 kcal/100g
    // reads as 312 calories when two grams of it is six, so every spice,
    // powder and nut butter is rejected on calories it never contributed.
    // That removed the entire functional slot from every generated smoothie.
    const servingGrams = chosen.servingGrams ?? 0;
    const pickKcal = chosen.kcal === null ? null : Math.round((chosen.kcal * servingGrams) / 100);
    const pickProtein =
      chosen.proteinG === null ? null : Math.round((chosen.proteinG * servingGrams) / 10) / 10;

    // Liquid and protein are structural — a glass without a base is not a
    // smaller smoothie, it is not one. Everything after them is negotiable and
    // stops once the preset's ceilings are reached.
    const structural = step.slot === "liquid" || step.slot === "protein";
    if (!structural) {
      if (extras >= preset.maxExtras) continue;
      // An unknown calorie figure is admitted rather than assumed to be zero;
      // it makes the total unknown, which the result says out loud.
      if (pickKcal !== null && kcal + pickKcal > preset.calorieTarget) continue;
      extras += 1;
    }

    if (pickKcal === null) kcalKnown = false;
    else kcal += pickKcal;
    if (pickProtein === null) proteinKnown = false;
    else proteinG += pickProtein;

    used.add(chosen.name);
    grams += servingGrams;

    picks.push({
      step: picks.length + 1,
      name: chosen.name,
      slot: step.slot,
      reason: step.reason(chosen, profile),
      grams: servingGrams,
      kcal: pickKcal,
      proteinG: pickProtein,
    });
  }

  return {
    picks,
    excludedNames: [...new Set(excludedNames)],
    totalKcal: kcalKnown ? kcal : null,
    totalProteinG: proteinKnown ? Math.round(proteinG * 10) / 10 : null,
    totalGrams: grams,
    preset: preset.id,
    seed,
  };
}

/** Fill against the glass target, 0–100, for the build animation. */
export const fillPercent = (grams: number): number =>
  Math.min(100, Math.round((grams / TARGET_VOLUME) * 100));

