import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogStats, combinationCount } from "./stats.ts";
import type { BuildableIngredient } from "../generation/index.ts";

/**
 * The figure on the landing page.
 *
 * It is quoted to people who have no account, and it is the one number on that
 * page nobody can check by looking. So it is worth a test that says what it
 * means: the size of the space this builder can reach out of this catalog, not
 * a number chosen because it sounds large.
 */

const ing = (name: string, slot: string): BuildableIngredient =>
  ({
    name,
    slot,
    benefits: [],
    proteinG: null,
    servingGrams: 100,
    contains: [],
    animal: false,
    hex: null,
    flavors: [],
    kcal: null,
  }) as unknown as BuildableIngredient;

/** n of a slot, named apart so nothing dedupes them. */
const many = (slot: string, n: number) =>
  Array.from({ length: n }, (_, i) => ing(`${slot}-${i}`, slot));

const catalog = [
  ...many("liquid", 6),
  ...many("protein", 5),
  ...many("flavor", 17),
  ...many("functional", 9),
  ...many("thickener", 3),
  ...many("sweetener", 3),
];

test("counts what the skeleton can reach out of the catalog", () => {
  // 6 × 5 × C(17,2) × 9 × 3 × (3 + 1)
  //   = 6 × 5 × 136 × 9 × 3 × 4
  assert.equal(combinationCount(catalog), 440_640);
});

test("the two flavour picks are a pair, not an ordered pair", () => {
  // Ordered would double it: 17 × 16 rather than C(17,2) = 136.
  const twoFlavors = [...many("liquid", 1), ...many("protein", 1), ...many("flavor", 3), ...many("functional", 1), ...many("thickener", 1)];
  // C(3,2) = 3, and the sweetener slot is empty so it contributes only "none".
  assert.equal(combinationCount(twoFlavors), 3);
});

test("an empty slot collapses the whole count, because the skeleton requires it", () => {
  const noProtein = catalog.filter((i) => i.slot !== "protein");
  assert.equal(combinationCount(noProtein), 0);
});

test("the optional slot contributes leaving it out", () => {
  const noSweetener = catalog.filter((i) => i.slot !== "sweetener");
  // Every other factor unchanged; the sweetener term goes from (3+1) to (0+1).
  assert.equal(combinationCount(noSweetener), 440_640 / 4);
});

test("an ingredient with no slot is in the table and in no glass", () => {
  const withStray = [...catalog, ing("Unplaced", null as unknown as string)];
  const stats = catalogStats(withStray, 5);
  // Counted from the slots, so it neither inflates the headline nor the space.
  assert.equal(stats.ingredients, 43);
  assert.equal(stats.combinations, 440_640);
});

test("reports the skeleton it counted, so the figure can be checked", () => {
  const stats = catalogStats(catalog, 5);
  assert.deepEqual(
    stats.bySlot,
    [
      { slot: "liquid", picks: 1, available: 6, optional: false },
      { slot: "protein", picks: 1, available: 5, optional: false },
      { slot: "flavor", picks: 2, available: 17, optional: false },
      { slot: "functional", picks: 1, available: 9, optional: false },
      { slot: "thickener", picks: 1, available: 3, optional: false },
      { slot: "sweetener", picks: 1, available: 3, optional: true },
    ],
  );
  assert.equal(stats.ingredients, 43);
});
