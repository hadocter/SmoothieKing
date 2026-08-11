import { slotShape, type BuildableIngredient } from "../generation/index.ts";
import { combinationCount } from "../catalog/stats.ts";

/**
 * Whether a hand-picked list can actually produce a drink.
 *
 * Choosing your own ingredients has to be a real option — someone who knows
 * their own kitchen better than we do should not be stuck with what the
 * frequency count decided. But the skeleton still has to be satisfiable: a
 * list with no base and no thickener is not a shorter list, it is a list that
 * builds nothing, and letting someone save one is letting them break their
 * week without being told.
 *
 * So the picker is open — any of the catalogue, in any quantity — and the
 * *shape* is checked. The report is what a screen needs to show what is still
 * missing while they choose, rather than a yes/no delivered after the fact.
 */

export interface SlotRequirement {
  slot: string;
  /** How many the skeleton takes from this slot. Two, for flavour. */
  picks: number;
  optional: boolean;
  /** How many the person has chosen. */
  chosen: number;
  /** Short of what a drink needs. Always false for an optional slot. */
  short: boolean;
}

export interface CompositionReport {
  slots: SlotRequirement[];
  /** True when every required slot has at least what the skeleton takes. */
  buildable: boolean;
  /** Slots still short, in build order. Empty when buildable. */
  missing: string[];
  /** Distinct drinks this selection admits. Zero until it is buildable. */
  drinksPossible: number;
  /** Names that are not in the catalogue at all. */
  unknown: string[];
}

export function composition(
  names: string[],
  catalog: BuildableIngredient[],
): CompositionReport {
  const byName = new Map(catalog.map((i) => [i.name.toLowerCase(), i]));
  const chosen: BuildableIngredient[] = [];
  const unknown: string[] = [];

  for (const raw of names) {
    const found = byName.get(raw.trim().toLowerCase());
    if (found) chosen.push(found);
    else unknown.push(raw);
  }

  const perSlot = new Map<string, number>();
  for (const i of chosen) {
    if (i.slot === null) continue;
    perSlot.set(i.slot, (perSlot.get(i.slot) ?? 0) + 1);
  }

  const slots: SlotRequirement[] = slotShape().map(({ slot, picks, optional }) => {
    const count = perSlot.get(slot) ?? 0;
    return { slot, picks, optional, chosen: count, short: !optional && count < picks };
  });

  const missing = slots.filter((s) => s.short).map((s) => s.slot);
  const buildable = missing.length === 0;

  return {
    slots,
    buildable,
    missing,
    // Counted the same way as everywhere else, and only once it means
    // something: a figure for an unbuildable list would be zero anyway, and
    // saying "0 drinks" next to "you still need a base" says it twice.
    drinksPossible: buildable ? combinationCount(chosen) : 0,
    unknown,
  };
}
