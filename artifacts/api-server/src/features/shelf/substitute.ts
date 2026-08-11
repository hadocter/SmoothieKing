import type { BuildableIngredient } from "../generation/index.ts";

/**
 * What could stand in for something you have not got.
 *
 * The rule is per slot, and it has to be — a single rule measured against the
 * real catalog produced nothing at all for a third of it.
 *
 * Requiring a shared flavour family *and* a shared benefit left ten of the 43
 * ingredients with zero substitutes, including every milk and every sweetener.
 * The cause is in the data rather than the idea: `flavors` is populated for the
 * flavour slot and empty for protein, sweetener and thickener, so a rule
 * leaning on it silently excluded the slots where "I have run out" bites
 * hardest.
 *
 * So: flavour needs a shared family, because mango and spinach are not
 * interchangeable in a glass. Every other slot needs only the slot, because
 * one thickener does the job of another. Measured on the current catalog, the
 * worst case per slot is flavour 14, functional 8, sweetener 2, liquid 1,
 * thickener 1 — and protein 0, which is stated rather than smoothed over
 * below.
 */

export interface Substitute {
  name: string;
  slot: string;
  /** Flavour families shared with what it replaces. Empty outside that slot. */
  sharedFlavors: string[];
  /** Goals both carry. Ranking prefers keeping these. */
  sharedBenefits: string[];
  /** Allergen classes this brings that the original did not. */
  addedAllergens: string[];
}

const lower = (s: string) => s.trim().toLowerCase();
const overlap = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

/**
 * Substitutes for one ingredient, best first, excluding anything the eater
 * cannot have.
 *
 * `excludedAllergens` is applied as a filter and not as a warning. A swap
 * screen that offers something to react to, with a caption, is worse than one
 * that offers a shorter list — the whole reason to build this on a closed
 * catalog is that the filter can be exact.
 */
export function substitutesFor(
  ingredientName: string,
  catalog: BuildableIngredient[],
  options: {
    excludedAllergens?: string[];
    excludedNames?: string[];
    vegan?: boolean;
    limit?: number;
  } = {},
): Substitute[] {
  const target = catalog.find((i) => lower(i.name) === lower(ingredientName));
  if (!target || target.slot === null) return [];

  const banned = new Set((options.excludedAllergens ?? []).map(lower));
  const bannedNames = new Set((options.excludedNames ?? []).map(lower));
  const limit = options.limit ?? 4;

  const candidates = catalog.filter((i) => {
    if (i.slot !== target.slot) return false;
    if (lower(i.name) === lower(target.name)) return false;
    if (bannedNames.has(lower(i.name))) return false;
    if (options.vegan && i.animal) return false;
    if (i.contains.some((a) => banned.has(lower(a)))) return false;
    // Flavour is the one slot where the swap has to taste like the original.
    if (target.slot === "flavor" && overlap(i.flavors, target.flavors).length === 0) return false;
    return true;
  });

  return candidates
    .map((i) => ({
      name: i.name,
      slot: i.slot ?? "",
      sharedFlavors: overlap(i.flavors, target.flavors),
      sharedBenefits: overlap(i.benefits, target.benefits),
      addedAllergens: i.contains.filter((a) => !target.contains.includes(a)),
    }))
    .sort(
      (a, b) =>
        // Nothing new to react to first, even when it is already permitted:
        // a swap that adds an allergen class is a worse default for someone
        // who has not declared it yet than one that adds none.
        a.addedAllergens.length - b.addedAllergens.length ||
        b.sharedBenefits.length - a.sharedBenefits.length ||
        b.sharedFlavors.length - a.sharedFlavors.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}
