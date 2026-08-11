import { combinationCount } from "../catalog/stats.ts";
import {
  generateBatch,
  slotShape,
  type BuildProfile,
  type BuildableIngredient,
  type Preset,
} from "../generation/index.ts";

/**
 * The ingredients a week is going to ask for.
 *
 * Not a nutritionist's shopping list and not a guess: the builder is run
 * repeatedly for this person's goal, and what it reaches for most often is
 * what the list says to have in. The same code that will build their drinks
 * decides what the week needs, so the list cannot recommend something the
 * builder would never pick, and cannot omit something it always does.
 *
 * A week rather than a period. Fruit does not last eight weeks, and a list
 * that spans one would be telling someone to buy things that will be thrown
 * away — see the shelf-life gap in the notes. Naming ingredients for seven
 * days is a promise the data can keep; naming quantities for eight weeks is
 * not.
 */

export type ShelfState = "have" | "buying" | "skipping";

export const SHELF_STATES: readonly ShelfState[] = ["have", "buying", "skipping"];

export const isShelfState = (v: unknown): v is ShelfState =>
  typeof v === "string" && (SHELF_STATES as readonly string[]).includes(v);

export interface ShelfItem {
  name: string;
  slot: string;
  /** How many of the sampled drinks used it. The reason it is on the list. */
  usedIn: number;
  /** True when the skeleton cannot produce a drink without this slot filled. */
  essential: boolean;
}

export interface WeekShelf {
  items: ShelfItem[];
  /** How many drinks were sampled to build the list. */
  sampled: number;
  /** Distinct drinks the listed ingredients alone can make. */
  drinksPossible: number;
}

/** How many builds to sample. Wide enough that a rare pick is visibly rare. */
const SAMPLE = 24;

/** The most a week's list may name. Beyond this it stops being a short trip. */
const MAX_ITEMS = 10;

/**
 * A seed that is stable within a week and different between weeks.
 *
 * The list must not change while someone is shopping from it, and must not be
 * the same list forever — a person on a twelve-week goal buying the identical
 * nine things every week is the failure this feature would deserve.
 */
export function weekSeed(goalPeriodId: number, weekIndex: number): number {
  return (goalPeriodId * 7919 + weekIndex * 104729) % 100000;
}

/** 1-based week of a period. Day 0–6 is week 1. */
export function weekIndexOf(daysElapsed: number): number {
  return Math.floor(Math.max(0, daysElapsed) / 7) + 1;
}

function countUsage(
  profile: BuildProfile,
  catalog: BuildableIngredient[],
  preset: Preset,
  seedBase: number,
  count: number,
): { usage: Map<string, number>; drinks: number } {
  const built = generateBatch(profile, catalog, { preset, count, seedBase });
  const usage = new Map<string, number>();
  for (const drink of built) {
    // Distinct within a drink: an ingredient used twice is still one thing to buy.
    for (const name of new Set(drink.recipe.ingredients.map((i) => i.name))) {
      usage.set(name, (usage.get(name) ?? 0) + 1);
    }
  }
  return { usage, drinks: built.length };
}

/**
 * How many drinks these ingredients alone could make.
 *
 * Counted the same way as the catalogue-wide figure on the landing page:
 * combinations the slot skeleton admits, not builds sampled from it. The two
 * numbers appear in the same product and one is a fraction of the other, so
 * they have to be measured with the same instrument.
 *
 * Sampling was the first attempt and it undercounted badly — ten ingredients
 * that the skeleton can arrange 24 ways returned 4, because the builder picks
 * from a shortlist and a narrowed catalog leaves it little to vary between.
 * That is a fact about the variety mechanism, not about the shopping list, and
 * putting it on screen would have understated a good week's list by six times.
 */
export function drinksFrom(names: string[], catalog: BuildableIngredient[]): number {
  const keep = new Set(names.map((n) => n.toLowerCase()));
  return combinationCount(catalog.filter((i) => keep.has(i.name.toLowerCase())));
}

export function weekShelf(
  profile: BuildProfile,
  catalog: BuildableIngredient[],
  options: { preset?: Preset; seedBase?: number; max?: number; keep?: string[] } = {},
): WeekShelf {
  const preset = options.preset ?? "great";
  const seedBase = options.seedBase ?? 0;
  const max = options.max ?? MAX_ITEMS;
  /**
   * What is already in the kitchen, kept whatever the ranking says.
   *
   * A list that tells someone to buy a second thickener while the first is
   * still in the cupboard is a list that costs money to follow. Leftovers are
   * pinned first and the computed picks fill in around them.
   */
  const keep = new Set((options.keep ?? []).map((n) => n.toLowerCase()));

  const { usage, drinks } = countUsage(profile, catalog, preset, seedBase, SAMPLE);
  const slotOf = new Map(catalog.map((i) => [i.name, i.slot ?? ""]));
  const required = new Set(slotShape().filter((s) => !s.optional).map((s) => s.slot));

  const ranked = [...usage.entries()]
    .map(([name, usedIn]) => ({
      name,
      slot: slotOf.get(name) ?? "",
      usedIn,
      essential: required.has(slotOf.get(name) ?? ""),
    }))
    // Most-used first; ties broken by name so the list is stable across calls.
    .sort((a, b) => b.usedIn - a.usedIn || a.name.localeCompare(b.name));

  /**
   * Every required slot gets at least what the skeleton takes from it, even
   * when a rarely-picked ingredient is the only thing filling it. A list that
   * ranked purely by frequency could leave someone without a thickener and
   * therefore without a single makeable drink — the exact failure the list is
   * for.
   */
  const picked: ShelfItem[] = [];
  const perSlot = new Map<string, number>();
  const need = new Map(slotShape().map((s) => [s.slot, s.optional ? 0 : s.picks]));

  for (const i of catalog) {
    if (!keep.has(i.name.toLowerCase())) continue;
    const slot = i.slot ?? "";
    picked.push({ name: i.name, slot, usedIn: usage.get(i.name) ?? 0, essential: required.has(slot) });
    perSlot.set(slot, (perSlot.get(slot) ?? 0) + 1);
  }

  for (const item of ranked) {
    if (picked.some((p) => p.name === item.name)) continue;
    const taken = perSlot.get(item.slot) ?? 0;
    if (taken >= (need.get(item.slot) ?? 0)) continue;
    picked.push(item);
    perSlot.set(item.slot, taken + 1);
  }

  // Then fill the remaining room with whatever else came up most, so the week
  // has variety rather than exactly one makeable drink repeated seven times.
  for (const item of ranked) {
    if (picked.length >= max) break;
    if (picked.some((p) => p.name === item.name)) continue;
    picked.push(item);
  }

  const items = picked.sort(
    (a, b) => Number(b.essential) - Number(a.essential) || b.usedIn - a.usedIn,
  );

  return {
    items,
    sampled: drinks,
    drinksPossible: drinksFrom(items.map((i) => i.name), catalog),
  };
}

/**
 * The week's marks, folded into the shape a build takes.
 *
 * `skipping` joins the disliked list, which is the channel that already
 * excludes an ingredient from every step of the build and from the allergen
 * trail's expectations. Nothing new had to be taught to the builder: refusing
 * an ingredient for a week and disliking it are the same instruction with
 * different reasons behind them.
 *
 * `buying` is deliberately not an exclusion. Someone who is going to the shop
 * this afternoon should be shown drinks they can make this evening.
 */
export function skippedFrom(marks: { ingredient: string; state: string }[]): string[] {
  return marks.filter((m) => m.state === "skipping").map((m) => m.ingredient);
}
