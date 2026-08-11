import { test } from "node:test";
import assert from "node:assert/strict";
import type { BuildProfile, BuildableIngredient } from "../generation/index.ts";
import { weekShelf, weekIndexOf, weekSeed, skippedFrom, drinksFrom } from "./shelf.ts";
import { substitutesFor } from "./substitute.ts";

function ing(
  name: string,
  slot: string,
  benefits: string[],
  extra: Partial<BuildableIngredient> = {},
): BuildableIngredient {
  return {
    name,
    slot,
    benefits,
    flavors: [],
    contains: [],
    animal: false,
    hex: "#888888",
    kcal: 50,
    proteinG: 1,
    servingGrams: 100,
    ...extra,
  };
}

/** Shaped like the real catalog: flavours tagged, other slots not. */
const CATALOG: BuildableIngredient[] = [
  ing("Coconut Water", "liquid", ["hydration"], { servingGrams: 250 }),
  ing("Almond milk", "liquid", [], { servingGrams: 250, contains: ["tree-nut"] }),
  ing("Oat milk", "liquid", [], { servingGrams: 250, contains: ["gluten"] }),
  ing("Cold green tea", "liquid", ["energy-focus"], { servingGrams: 250 }),
  ing("Whey Protein Isolate", "protein", ["protein-power"], { servingGrams: 30, contains: ["dairy"], animal: true }),
  ing("Pea protein", "protein", ["protein-power"], { servingGrams: 30 }),
  ing("Silken tofu", "protein", ["protein-power"], { servingGrams: 100, contains: ["soy"] }),
  ing("Mango", "flavor", ["glowy-skin"], { servingGrams: 120, flavors: ["tropical"] }),
  ing("Pineapple", "flavor", ["glowy-skin"], { servingGrams: 120, flavors: ["tropical"] }),
  ing("Lemon juice", "flavor", ["detox-clarity"], { servingGrams: 15, flavors: ["citrus"] }),
  ing("Orange", "flavor", ["glowy-skin"], { servingGrams: 130, flavors: ["citrus"] }),
  ing("Spinach", "flavor", ["detox-clarity"], { servingGrams: 60, flavors: ["green-earthy"] }),
  ing("Turmeric", "functional", ["anti-inflammatory"], { servingGrams: 2 }),
  ing("Matcha", "functional", ["energy-focus"], { servingGrams: 2 }),
  ing("Chia seeds", "thickener", ["gut-health"], { servingGrams: 15 }),
  ing("Rolled oats", "thickener", ["gut-health"], { servingGrams: 40, contains: ["gluten"] }),
  ing("Honey", "sweetener", [], { servingGrams: 21 }),
  ing("Maple syrup", "sweetener", [], { servingGrams: 20 }),
];

const profile = (over: Partial<BuildProfile> = {}): BuildProfile => ({
  primaryGoal: "glowy-skin",
  secondaryGoals: [],
  tastePreference: [],
  allergies: [],
  dislikedIngredients: [],
  ...over,
});

/* ------------------------------------------------------------------ */
/* The week's list                                                     */
/* ------------------------------------------------------------------ */

test("the list can actually build something — every required slot is on it", () => {
  const { items } = weekShelf(profile(), CATALOG, { seedBase: 1 });
  const slots = new Set(items.map((i) => i.slot));
  // Ranking on frequency alone could leave a slot unfilled, and a list missing
  // one is a list that makes no drinks at all.
  for (const required of ["liquid", "protein", "flavor", "functional", "thickener"]) {
    assert.ok(slots.has(required), `no ${required} on the list: ${items.map((i) => i.name).join(", ")}`);
  }
});

test("flavour gets the two the skeleton takes, not one", () => {
  const { items } = weekShelf(profile(), CATALOG, { seedBase: 1 });
  const flavours = items.filter((i) => i.slot === "flavor");
  assert.ok(flavours.length >= 2, `only ${flavours.length} flavours listed`);
});

test("the drinks figure is computed from the list, not asserted", () => {
  const shelf = weekShelf(profile(), CATALOG, { seedBase: 1 });
  assert.equal(shelf.drinksPossible, drinksFrom(shelf.items.map((i) => i.name), CATALOG));
  assert.ok(shelf.drinksPossible > 0);
});

test("counted the same way as the catalogue-wide figure, so the two agree", () => {
  // Two liquids, two proteins, three flavours, one functional, two thickeners
  // and no sweetener: 2 × 2 × C(3,2) × 1 × 2 × (0+1).
  const list = [
    "Coconut Water", "Cold green tea",
    "Pea protein", "Silken tofu",
    "Mango", "Pineapple", "Orange",
    "Turmeric",
    "Chia seeds", "Rolled oats",
  ];
  assert.equal(drinksFrom(list, CATALOG), 2 * 2 * 3 * 1 * 2);
});

test("a week's list stays the same all week", () => {
  const a = weekShelf(profile(), CATALOG, { seedBase: weekSeed(7, 2) });
  const b = weekShelf(profile(), CATALOG, { seedBase: weekSeed(7, 2) });
  assert.deepEqual(a.items, b.items);
});

test("and is not the same list every week", () => {
  const seeds = [1, 2, 3, 4].map((w) => weekSeed(7, w));
  assert.equal(new Set(seeds).size, 4, "weeks collide on the same seed");
});

test("an allergy keeps its ingredients off the shopping list entirely", () => {
  const { items } = weekShelf(profile({ allergies: ["Tree Nuts"] }), CATALOG, { seedBase: 3 });
  assert.ok(!items.some((i) => i.name === "Almond milk"));
});

test("the list is capped, so a week is a short trip", () => {
  const { items } = weekShelf(profile(), CATALOG, { seedBase: 5, max: 6 });
  assert.ok(items.length <= 6, `${items.length} items`);
});

test("every listed ingredient says how often it came up", () => {
  const { items, sampled } = weekShelf(profile(), CATALOG, { seedBase: 9 });
  assert.ok(sampled > 0);
  for (const i of items) assert.ok(i.usedIn > 0, `${i.name} is on the list but was never used`);
});

test("weeks are 1-based and turn over on day seven", () => {
  assert.equal(weekIndexOf(0), 1);
  assert.equal(weekIndexOf(6), 1);
  assert.equal(weekIndexOf(7), 2);
  assert.equal(weekIndexOf(41), 6);
});

test("only refusals become exclusions — a plan to buy is not a refusal", () => {
  const skipped = skippedFrom([
    { ingredient: "Mango", state: "have" },
    { ingredient: "Matcha", state: "buying" },
    { ingredient: "Spinach", state: "skipping" },
  ]);
  assert.deepEqual(skipped, ["Spinach"]);
});

/* ------------------------------------------------------------------ */
/* Substitutes                                                         */
/* ------------------------------------------------------------------ */

test("a flavour is replaced from its own family, not from any flavour", () => {
  const subs = substitutesFor("Lemon juice", CATALOG).map((s) => s.name);
  assert.deepEqual(subs, ["Orange"]);
  assert.ok(!subs.includes("Spinach"));
});

test("slots without flavour tags still have substitutes", () => {
  // The rule that required a shared flavour family returned nothing for these,
  // which is what sent it back to be written per slot.
  for (const name of ["Almond milk", "Honey", "Chia seeds", "Pea protein"]) {
    const subs = substitutesFor(name, CATALOG);
    assert.ok(subs.length > 0, `no substitute offered for ${name}`);
  }
});

test("a substitute is never something the eater avoids", () => {
  const subs = substitutesFor("Whey Protein Isolate", CATALOG, {
    excludedAllergens: ["dairy", "soy"],
  });
  assert.deepEqual(subs.map((s) => s.name), ["Pea protein"]);
});

test("when nothing can stand in, the answer is empty rather than approximate", () => {
  // Pea protein is the only protein carrying no allergen; for someone avoiding
  // dairy and soy there is genuinely nothing else on the shelf.
  const subs = substitutesFor("Pea protein", CATALOG, { excludedAllergens: ["dairy", "soy"] });
  assert.deepEqual(subs, []);
});

test("a swap that brings nothing new to react to is offered first", () => {
  const subs = substitutesFor("Coconut Water", CATALOG);
  assert.ok(subs.length >= 2);
  assert.deepEqual(subs[0].addedAllergens, []);
});

test("dislikes are honoured as well as allergies", () => {
  const subs = substitutesFor("Lemon juice", CATALOG, { excludedNames: ["Orange"] });
  assert.deepEqual(subs, []);
});

test("an ingredient we do not stock has no substitutes rather than throwing", () => {
  assert.deepEqual(substitutesFor("Unicorn tears", CATALOG), []);
});
