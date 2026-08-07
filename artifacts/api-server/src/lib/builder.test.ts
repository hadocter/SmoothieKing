import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSmoothie, recipeName, type BuildProfile, type BuildableIngredient } from "./builder.ts";
import { generateBatch, generateOne } from "./generate.ts";
import { GOALS } from "./scoring.ts";

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

/** Enough of a catalog to fill every slot with something to choose between. */
const CATALOG: BuildableIngredient[] = [
  ing("Coconut Water", "liquid", ["hydration", "energy-focus"], { kcal: 19, proteinG: 0.7, servingGrams: 250, flavors: ["tropical"] }),
  ing("Almond Milk", "liquid", [], { kcal: 15, proteinG: 0.6, servingGrams: 250, contains: ["tree-nut"] }),
  ing("Whole Milk", "liquid", ["protein-power"], { kcal: 61, proteinG: 3.3, servingGrams: 240, contains: ["dairy"], animal: true }),
  ing("Whey Protein Isolate", "protein", ["protein-power"], { kcal: 370, proteinG: 90, servingGrams: 30, contains: ["dairy"], animal: true }),
  ing("Pea Protein", "protein", ["protein-power"], { kcal: 380, proteinG: 80, servingGrams: 30 }),
  ing("Greek Yogurt", "protein", ["gut-health", "protein-power"], { kcal: 59, proteinG: 10, servingGrams: 150, animal: true }),
  ing("Mango", "flavor", ["glowy-skin"], { kcal: 60, proteinG: 0.8, servingGrams: 120, flavors: ["tropical"] }),
  ing("Blueberry", "flavor", ["glowy-skin", "anti-inflammatory"], { kcal: 57, proteinG: 0.7, servingGrams: 70, flavors: ["berry"] }),
  ing("Lemon", "flavor", ["detox-clarity"], { kcal: 22, proteinG: 0.4, servingGrams: 15, flavors: ["citrus"] }),
  ing("Spinach", "flavor", ["detox-clarity"], { kcal: 23, proteinG: 2.9, servingGrams: 60, flavors: ["green-earthy"] }),
  ing("Turmeric", "functional", ["anti-inflammatory"], { kcal: 312, proteinG: 9.7, servingGrams: 2 }),
  ing("Matcha", "functional", ["energy-focus", "detox-clarity"], { kcal: 300, proteinG: 30, servingGrams: 2 }),
  ing("Banana", "thickener", ["gut-health"], { kcal: 89, proteinG: 1.1, servingGrams: 118 }),
  ing("Oats", "thickener", ["gut-health"], { kcal: 379, proteinG: 13, servingGrams: 40 }),
  ing("Honey", "sweetener", [], { kcal: 304, proteinG: 0.3, servingGrams: 21 }),
];

const profile = (over: Partial<BuildProfile> = {}): BuildProfile => ({
  primaryGoal: "glowy-skin",
  secondaryGoals: [],
  tastePreference: [],
  allergies: [],
  dislikedIngredients: [],
  ...over,
});

test("a build always has a base to blend against", () => {
  const result = buildSmoothie(profile(), CATALOG);
  assert.equal(result.picks[0]?.slot, "liquid");
});

test("the same profile and seed build the same glass", () => {
  const a = buildSmoothie(profile(), CATALOG, { seed: 7 });
  const b = buildSmoothie(profile(), CATALOG, { seed: 7 });
  assert.deepEqual(a.picks.map((p) => p.name), b.picks.map((p) => p.name));
});

test("a different seed can build a different glass", () => {
  const seen = new Set<string>();
  for (let s = 0; s < 12; s += 1) {
    seen.add(buildSmoothie(profile(), CATALOG, { seed: s }).picks.map((p) => p.name).join("|"));
  }
  assert.ok(seen.size > 1, "seeding produced no variety at all");
});

test("the main goal outranks the sub-goals it is competing with", () => {
  const main = buildSmoothie(profile({ primaryGoal: "detox-clarity", secondaryGoals: ["gut-health"] }), CATALOG);
  const names = main.picks.map((p) => p.name);
  assert.ok(
    names.includes("Lemon") || names.includes("Spinach") || names.includes("Matcha"),
    `expected a detox ingredient, got ${names.join(", ")}`,
  );
});

test("an allergy keeps the ingredient out of the glass entirely", () => {
  const result = buildSmoothie(profile({ primaryGoal: "protein-power", allergies: ["Dairy"] }), CATALOG);
  const names = result.picks.map((p) => p.name);
  assert.ok(!names.includes("Whey Protein Isolate"));
  assert.ok(!names.includes("Whole Milk"));
  assert.ok(result.excludedNames.includes("Whey Protein Isolate"));
  // Still a working drink, not an empty one.
  assert.ok(names.includes("Pea Protein"));
});

test("a tree-nut allergy keeps out almond milk, whose name never says nut", () => {
  const result = buildSmoothie(profile({ allergies: ["Tree Nuts"] }), CATALOG);
  assert.ok(!result.picks.map((p) => p.name).includes("Almond Milk"));
});

test("vegan excludes animal ingredients", () => {
  const result = buildSmoothie(profile({ primaryGoal: "protein-power", vegan: true }), CATALOG);
  const names = result.picks.map((p) => p.name);
  assert.ok(!names.includes("Greek Yogurt") && !names.includes("Whey Protein Isolate"));
  assert.ok(names.includes("Pea Protein"));
});

test("a dislike is honoured but is not a safety block", () => {
  const result = buildSmoothie(profile({ dislikedIngredients: ["Banana"] }), CATALOG);
  assert.ok(!result.picks.map((p) => p.name).includes("Banana"));
});

test("taste preference pulls flavours toward what was asked for", () => {
  const fresh = buildSmoothie(profile({ tastePreference: ["fresh"] }), CATALOG, { seed: 0 });
  const names = fresh.picks.map((p) => p.name);
  assert.ok(names.includes("Spinach") || names.includes("Lemon"), `got ${names.join(", ")}`);
});

test("sweetener only goes in when sweet was asked for", () => {
  assert.ok(!buildSmoothie(profile(), CATALOG).picks.some((p) => p.slot === "sweetener"));
  const sweet = buildSmoothie(profile({ tastePreference: ["sweet"] }), CATALOG, { seed: 3 });
  assert.ok(sweet.picks.some((p) => p.slot === "sweetener"));
});

test("quick builds fewer things to handle than great", () => {
  const quick = buildSmoothie(profile(), CATALOG, { preset: "quick", seed: 1 });
  const great = buildSmoothie(profile(), CATALOG, { preset: "great", seed: 1 });
  assert.ok(quick.picks.length < great.picks.length, `quick ${quick.picks.length}, great ${great.picks.length}`);
});

test("heavy carries more calories than light", () => {
  const heavy = buildSmoothie(profile(), CATALOG, { preset: "heavy", seed: 1 });
  const light = buildSmoothie(profile(), CATALOG, { preset: "light", seed: 1 });
  assert.ok((heavy.totalKcal ?? 0) > (light.totalKcal ?? 0));
});

test("a total is null rather than wrong when a figure is missing", () => {
  const gap = CATALOG.map((i) => (i.name === "Mango" ? { ...i, kcal: null } : i));
  const result = buildSmoothie(profile(), gap, { seed: 0 });
  if (result.picks.some((p) => p.name === "Mango")) {
    assert.equal(result.totalKcal, null);
  }
});

test("an empty catalog produces an empty build rather than throwing", () => {
  const result = buildSmoothie(profile(), []);
  assert.deepEqual(result.picks, []);
  assert.equal(result.totalGrams, 0);
});

test("the name is the placeholder until a model writes one", () => {
  const result = buildSmoothie(profile(), CATALOG);
  assert.equal(recipeName(result, profile()), "testname:llm");
});

/* ---- generation ---- */

test("a generated recipe is shaped like a recipe row", () => {
  const { recipe } = generateOne(profile(), CATALOG, { seed: 1 });
  assert.equal(recipe.source, "generated");
  assert.equal(recipe.published, false, "a drink built from someone's profile is theirs until they say otherwise");
  assert.equal(recipe.servings, 1);
  assert.ok(recipe.slug.startsWith("gen-glowy-skin-"));
  assert.ok(recipe.steps.length >= 2);
  assert.ok(recipe.ingredients.every((i) => i.name && i.amount && i.unit && i.benefit));
  assert.deepEqual(Object.keys(recipe.goalScores).sort(), [...GOALS].sort());
});

test("liquids are measured in ml and everything else in grams", () => {
  const { recipe } = generateOne(profile(), CATALOG, { seed: 1 });
  assert.equal(recipe.ingredients[0].unit, "ml");
  assert.ok(recipe.ingredients.slice(1).every((i) => i.unit === "g"));
});

test("the same drink always gets the same slug, so a batch stores it once", () => {
  const a = generateOne(profile(), CATALOG, { seed: 1 }).recipe;
  const b = generateOne(profile(), CATALOG, { seed: 1 }).recipe;
  assert.equal(a.slug, b.slug);
});

test("a batch deduplicates and ranks on the main goal", () => {
  const batch = generateBatch(profile({ primaryGoal: "protein-power" }), CATALOG, { count: 10 });
  assert.ok(batch.length > 0);
  assert.equal(new Set(batch.map((r) => r.slug)).size, batch.length, "duplicates survived");
  for (let i = 1; i < batch.length; i += 1) {
    assert.ok(
      batch[i - 1].goalScores["protein-power"] >= batch[i].goalScores["protein-power"],
      "batch is not ordered by main-goal fit",
    );
  }
});

test("a batch is reproducible from its seed base", () => {
  const a = generateBatch(profile(), CATALOG, { count: 6, seedBase: 100 }).map((r) => r.slug);
  const b = generateBatch(profile(), CATALOG, { count: 6, seedBase: 100 }).map((r) => r.slug);
  assert.deepEqual(a, b);
});

test("generated recipes never contain a stated allergen", () => {
  const batch = generateBatch(profile({ primaryGoal: "protein-power", allergies: ["Dairy"] }), CATALOG, { count: 10 });
  const dairy = new Set(CATALOG.filter((i) => i.contains.includes("dairy")).map((i) => i.name));
  for (const recipe of batch) {
    for (const item of recipe.ingredients) {
      assert.ok(!dairy.has(item.name), `${recipe.slug} contains ${item.name}`);
    }
  }
});

test("a generated recipe's benefits are the goals it actually scored on", () => {
  const { recipe } = generateOne(profile({ primaryGoal: "protein-power" }), CATALOG, { seed: 2 });
  for (const b of recipe.benefits) {
    assert.ok(recipe.goalScores[b] >= 0.5, `${b} is claimed but scores ${recipe.goalScores[b]}`);
  }
});
