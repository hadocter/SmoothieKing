/**
 * Allergen and diet checking.
 *
 * Deterministic on purpose, and kept well away from anything that generates or
 * ranks. A model proposes drinks; this decides whether one is allowed to reach
 * someone, and it does so by comparing ids in a table. There is no scoring
 * here, no threshold and no judgement — the same recipe and the same
 * constraints always produce the same verdict.
 *
 * It returns a per-ingredient trail rather than a boolean because the final
 * build screen shows the check happening: every ingredient named, weighed
 * against every stated allergy, and cleared. That is only honest if the trail
 * is the actual decision rather than a re-enactment of one made elsewhere, so
 * this is the thing the UI animates and the thing the server filters on.
 *
 * Matching is on the `contains` column, never on names. "Almond butter"
 * carries `tree-nut` as data; a name check would let it through to a tree-nut
 * allergy the moment someone wrote "Almond Butter (smooth)".
 *
 *
 * The gap this closes
 *
 * Onboarding stores what it showed the user: "Dairy", "Tree Nuts", "Soy",
 * "Gluten". The ingredient catalog stores ids: `dairy`, `tree-nut`, `soy`,
 * `gluten`. Nothing translated between them, so a `contains.includes(allergy)`
 * check matched nothing at all — and a filter that matches nothing does not
 * block anything. Someone who ticked "Tree Nuts" would have been served
 * almond butter, and the failure would have been invisible, because a filter
 * silently passing everything looks exactly like a filter with nothing to
 * catch.
 *
 * So the mapping below is explicit, and every stated allergy has to resolve
 * through one of two routes or be reported as unresolved. There is no path
 * where an allergy is quietly dropped.
 */

import type { ScorableIngredient } from "./scoring.ts";

/**
 * Onboarding's allergy labels to catalog allergen ids.
 *
 * Keyed on the lowercased label. `Peanut` is here without being in
 * ALLERGY_PRESETS: the catalog tags peanut butter `peanut`, so the id exists
 * and is worth honouring if a profile ever carries it — a gap in the UI's
 * options should not become a gap in the check.
 */
const ALLERGEN_IDS: Record<string, string> = {
  "dairy": "dairy",
  "tree nuts": "tree-nut",
  "tree nut": "tree-nut",
  "nuts": "tree-nut",
  "soy": "soy",
  "gluten": "gluten",
  "peanut": "peanut",
  "peanuts": "peanut",
};

/** What the user cannot have. */
export interface SafetyConstraints {
  /** Catalog allergen ids to exclude. */
  allergenIds: string[];
  /**
   * Ingredient names to exclude outright, lowercased.
   *
   * Several presets — Banana, Peach, Kiwi — are not allergen classes but
   * single foods, and the catalog has no tag for them. They are honoured by
   * excluding the ingredient itself, which is exactly as strict and needs no
   * new column.
   */
  excludedNames: string[];
  /**
   * Stated allergies that neither route could express: no allergen id, and no
   * ingredient by that name. Shellfish and Egg land here — nothing in a
   * smoothie catalog carries either.
   *
   * Reported rather than dropped. It is probably true that no recipe here
   * contains shellfish, but that is a claim about the catalog's completeness,
   * and it should be visible as a claim instead of being assumed by silence.
   */
  unresolved: string[];
  /** Excludes every ingredient flagged `animal`. */
  vegan: boolean;
}

export interface IngredientCheck {
  name: string;
  /** Allergens this ingredient carries, whether or not they matter here. */
  contains: string[];
  animal: boolean;
  /** Constraints this ingredient breaks. Empty when it passes. */
  violations: string[];
  passed: boolean;
}

export interface SafetyReport {
  safe: boolean;
  /** One entry per ingredient, in recipe order. The animation's script. */
  checks: IngredientCheck[];
  /** Recipe ingredient names that matched nothing in the catalog. */
  unknownIngredients: string[];
  /** Constraints stated but not expressible; carried through from input. */
  unresolvedConstraints: string[];
  /** Distinct constraints that failed, for saying why in one line. */
  blockedBy: string[];
}

/** Shape needed to check an ingredient. Scoring already carries most of it. */
export type CheckableIngredient = ScorableIngredient & {
  contains: string[];
  animal: boolean;
};

/**
 * Turns a profile's stated allergies into constraints the catalog can enforce.
 *
 * Needs the catalog, because the second route is a name lookup.
 */
export function constraintsFrom(
  profile: { allergies?: string[] | null } | null | undefined,
  catalog: CheckableIngredient[],
  options: { vegan?: boolean } = {},
): SafetyConstraints {
  const names = new Set(catalog.map((c) => c.name.trim().toLowerCase()));

  const allergenIds = new Set<string>();
  const excludedNames = new Set<string>();
  const unresolved: string[] = [];

  for (const raw of profile?.allergies ?? []) {
    const term = raw.trim().toLowerCase();
    if (!term) continue;

    const id = ALLERGEN_IDS[term];
    if (id) {
      allergenIds.add(id);
      continue;
    }
    if (names.has(term)) {
      excludedNames.add(term);
      continue;
    }
    unresolved.push(raw);
  }

  return {
    allergenIds: [...allergenIds],
    excludedNames: [...excludedNames],
    unresolved,
    vegan: options.vegan ?? false,
  };
}

/**
 * The ingredients a build is allowed to reach for.
 *
 * The same rules as `checkRecipe`, applied to the catalog instead of to a
 * finished recipe, so that generation cannot produce something the check would
 * then reject. Two implementations of "is this allowed" would eventually
 * disagree, and the direction they disagree in is what decides whether someone
 * gets served an allergen.
 *
 * `dislikes` is separate from constraints and passed separately, because it is
 * a preference rather than a safety rule. It keeps an ingredient out of a
 * generated drink, but it is not a reason to call an existing recipe unsafe.
 */
export function allowedIngredients(
  catalog: CheckableIngredient[],
  constraints: SafetyConstraints,
  dislikes: string[] = [],
): { allowed: CheckableIngredient[]; excludedNames: string[] } {
  const excludedIds = new Set(constraints.allergenIds);
  const excludedNames = new Set(constraints.excludedNames);
  const disliked = new Set(dislikes.map((d) => d.trim().toLowerCase()).filter(Boolean));

  const rejected: string[] = [];
  const allowed = catalog.filter((i) => {
    const key = i.name.trim().toLowerCase();
    const bad =
      i.contains.some((a) => excludedIds.has(a)) ||
      excludedNames.has(key) ||
      (constraints.vegan && i.animal) ||
      disliked.has(key);
    if (bad) rejected.push(i.name);
    return !bad;
  });

  return { allowed, excludedNames: rejected };
}

/**
 * Checks a recipe's ingredient names against a user's constraints.
 *
 * Fails closed. An ingredient name that is not in the catalog makes the whole
 * recipe unsafe, even though nothing is known to be wrong with it, because
 * nothing is known about it at all — and "no allergen found" and "no
 * information" are the same result from the outside while meaning opposite
 * things. Under a stated allergy the second one has to read as a block.
 *
 * With no constraints stated, everything passes and the trail still records
 * what each ingredient contains, so the screen can show the check ran.
 */
export function checkRecipe(
  recipeIngredients: unknown,
  catalog: CheckableIngredient[],
  constraints: SafetyConstraints,
): SafetyReport {
  const byName = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c]));
  const excludedIds = new Set(constraints.allergenIds);
  const excludedNames = new Set(constraints.excludedNames);
  const stated = excludedIds.size > 0 || excludedNames.size > 0 || constraints.vegan;

  const checks: IngredientCheck[] = [];
  const unknownIngredients: string[] = [];
  const blockedBy = new Set<string>();

  for (const raw of Array.isArray(recipeIngredients) ? recipeIngredients : []) {
    const name = typeof raw?.name === "string" ? raw.name : null;
    if (name === null) continue;

    const key = name.trim().toLowerCase();
    const found = byName.get(key);

    if (!found) {
      unknownIngredients.push(name);
      // Only a violation when something was actually being avoided. With no
      // constraints there is nothing to fail closed against, and marking every
      // unrecognised name unsafe would reject recipes for no one's benefit.
      const violations = stated ? ["unknown-ingredient"] : [];
      for (const v of violations) blockedBy.add(v);
      checks.push({ name, contains: [], animal: false, violations, passed: violations.length === 0 });
      continue;
    }

    const violations = found.contains.filter((a) => excludedIds.has(a));
    if (excludedNames.has(key)) violations.push(key);
    if (constraints.vegan && found.animal) violations.push("animal");
    for (const v of violations) blockedBy.add(v);

    checks.push({
      name: found.name,
      contains: found.contains,
      animal: found.animal,
      violations,
      passed: violations.length === 0,
    });
  }

  return {
    safe: checks.every((c) => c.passed),
    checks,
    unknownIngredients,
    unresolvedConstraints: constraints.unresolved,
    blockedBy: [...blockedBy],
  };
}
