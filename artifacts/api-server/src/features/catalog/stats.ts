import { slotShape, type BuildableIngredient } from "../generation/index.ts";

/**
 * What the catalog is, in numbers.
 *
 * These exist because the landing page needs something true to say to someone
 * who has no account and therefore no goal, no history and no drinks. The
 * alternative — and what was there before — is a wall of invented community
 * figures, which is a strange thing to put in front of people on a service
 * whose whole argument is that its allergen check cannot be talked out of
 * anything.
 *
 * Every figure here is counted or derived from the catalog as it stands, so a
 * seed change moves them and no one has to remember to.
 */

export interface CatalogStats {
  /**
   * Ingredients the builder can actually place.
   *
   * `slot` is nullable, and an ingredient without one is in the table but in
   * no step's pool — it can never reach a glass. Counting it would put a
   * number on the landing page larger than the number of things the catalog
   * can build with, which is the sort of small inflation this endpoint exists
   * to stop.
   */
  ingredients: number;
  /** Ingredients per slot, in the order the builder fills them. */
  bySlot: { slot: string; picks: number; available: number; optional: boolean }[];
  /** Distinct glasses the skeleton can produce from this catalog. */
  combinations: number;
  /** Allergen classes the catalog can actually be filtered on. */
  allergenClasses: number;
}

/** n choose k, on numbers small enough that the naive product is exact. */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let out = 1;
  for (let i = 0; i < k; i += 1) out = (out * (n - i)) / (i + 1);
  return Math.round(out);
}

/**
 * How many different drinks this catalog can produce.
 *
 * Per slot: the number of ways to choose the ingredients it takes, without
 * order — the two flavour picks are a pair, and counting them as ordered would
 * double every drink. An optional slot gets one more way, for leaving it out.
 *
 * This counts what the *skeleton* admits, not what any one profile would be
 * offered: allergen exclusions, dislikes and the calorie ceilings all cut into
 * it. It is a size-of-the-space figure and is worth stating as one.
 */
function perSlot(catalog: BuildableIngredient[]): Map<string, number> {
  const available = new Map<string, number>();
  for (const i of catalog) {
    if (i.slot === null) continue;
    available.set(i.slot, (available.get(i.slot) ?? 0) + 1);
  }
  return available;
}

export function combinationCount(catalog: BuildableIngredient[]): number {
  const available = perSlot(catalog);
  return slotShape().reduce((total, { slot, picks, optional }) => {
    const ways = choose(available.get(slot) ?? 0, picks);
    return total * (optional ? ways + 1 : ways);
  }, 1);
}

export function catalogStats(
  catalog: BuildableIngredient[],
  allergenClassCount: number,
): CatalogStats {
  const available = perSlot(catalog);
  const bySlot = slotShape().map(({ slot, picks, optional }) => ({
    slot,
    picks,
    available: available.get(slot) ?? 0,
    optional,
  }));

  return {
    // Summed over the slots rather than taken from the row count, so an
    // ingredient with no slot is left out of both this and the combinations.
    ingredients: [...available.values()].reduce((a, b) => a + b, 0),
    bySlot,
    combinations: combinationCount(catalog),
    allergenClasses: allergenClassCount,
  };
}
