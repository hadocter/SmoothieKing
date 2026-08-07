import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRecipe, constraintsFrom, type CheckableIngredient } from "./safety.ts";

/** A slice of the real catalog, with the real allergen ids. */
const CATALOG: CheckableIngredient[] = [
  { name: "Almond Butter", benefits: [], proteinG: 21, servingGrams: 16, contains: ["tree-nut"], animal: false },
  { name: "Peanut Butter", benefits: [], proteinG: 25, servingGrams: 16, contains: ["peanut"], animal: false },
  { name: "Whole Milk", benefits: [], proteinG: 3.3, servingGrams: 240, contains: ["dairy"], animal: true },
  { name: "Oat Milk", benefits: [], proteinG: 1, servingGrams: 240, contains: ["gluten"], animal: false },
  { name: "Silken Tofu", benefits: [], proteinG: 5, servingGrams: 100, contains: ["soy"], animal: false },
  { name: "Banana", benefits: [], proteinG: 1.1, servingGrams: 118, contains: [], animal: false },
  { name: "Mango", benefits: [], proteinG: 0.8, servingGrams: 120, contains: [], animal: false },
  { name: "Coconut Water", benefits: [], proteinG: 0.7, servingGrams: 250, contains: [], animal: false },
];

const recipe = (...names: string[]) => names.map((name) => ({ name, amount: "1", unit: "cup" }));

test("a tree-nut allergy blocks almond butter", () => {
  // The regression. Onboarding stores the label "Tree Nuts"; the catalog tags
  // almond butter `tree-nut`. Before the mapping existed these never matched,
  // so the filter passed everything and looked like it was working.
  const constraints = constraintsFrom({ allergies: ["Tree Nuts"] }, CATALOG);
  assert.deepEqual(constraints.allergenIds, ["tree-nut"]);

  const report = checkRecipe(recipe("Almond Butter", "Banana"), CATALOG, constraints);
  assert.equal(report.safe, false);
  assert.deepEqual(report.blockedBy, ["tree-nut"]);
  assert.equal(report.checks.find((c) => c.name === "Almond Butter")?.passed, false);
  assert.equal(report.checks.find((c) => c.name === "Banana")?.passed, true);
});

test("every onboarding preset that maps to an id does map", () => {
  const constraints = constraintsFrom({ allergies: ["Dairy", "Tree Nuts", "Soy", "Gluten"] }, CATALOG);
  assert.deepEqual(constraints.allergenIds.sort(), ["dairy", "gluten", "soy", "tree-nut"]);
  assert.deepEqual(constraints.unresolved, []);
});

test("labels are matched case- and space-insensitively", () => {
  assert.deepEqual(constraintsFrom({ allergies: ["  tree nuts  "] }, CATALOG).allergenIds, ["tree-nut"]);
});

test("a single-food allergy with no tag is honoured by excluding the ingredient", () => {
  const constraints = constraintsFrom({ allergies: ["Banana"] }, CATALOG);
  assert.deepEqual(constraints.allergenIds, []);
  assert.deepEqual(constraints.excludedNames, ["banana"]);
  assert.equal(checkRecipe(recipe("Banana", "Mango"), CATALOG, constraints).safe, false);
  assert.equal(checkRecipe(recipe("Mango"), CATALOG, constraints).safe, true);
});

test("an allergy the catalog cannot express is reported, not dropped", () => {
  const constraints = constraintsFrom({ allergies: ["Shellfish", "Egg"] }, CATALOG);
  assert.deepEqual(constraints.unresolved, ["Shellfish", "Egg"]);
  // Nothing here contains either, so recipes still pass — but the report says
  // the constraint was never enforced rather than implying it was.
  const report = checkRecipe(recipe("Mango"), CATALOG, constraints);
  assert.equal(report.safe, true);
  assert.deepEqual(report.unresolvedConstraints, ["Shellfish", "Egg"]);
});

test("an unrecognised ingredient fails closed under a stated allergy", () => {
  const constraints = constraintsFrom({ allergies: ["Dairy"] }, CATALOG);
  const report = checkRecipe(recipe("Mango", "Mystery Powder"), CATALOG, constraints);
  assert.equal(report.safe, false, "nothing known about it is not the same as nothing wrong with it");
  assert.deepEqual(report.unknownIngredients, ["Mystery Powder"]);
  assert.ok(report.blockedBy.includes("unknown-ingredient"));
});

test("an unrecognised ingredient passes when no allergy was stated", () => {
  const constraints = constraintsFrom({ allergies: [] }, CATALOG);
  const report = checkRecipe(recipe("Mango", "Mystery Powder"), CATALOG, constraints);
  assert.equal(report.safe, true);
  assert.deepEqual(report.unknownIngredients, ["Mystery Powder"]);
});

test("no constraints passes everything but still records the trail", () => {
  const constraints = constraintsFrom({ allergies: [] }, CATALOG);
  const report = checkRecipe(recipe("Almond Butter", "Whole Milk"), CATALOG, constraints);
  assert.equal(report.safe, true);
  assert.equal(report.checks.length, 2);
  assert.deepEqual(report.checks[0].contains, ["tree-nut"]);
});

test("vegan excludes animal ingredients", () => {
  const constraints = constraintsFrom({ allergies: [] }, CATALOG, { vegan: true });
  assert.equal(checkRecipe(recipe("Whole Milk"), CATALOG, constraints).safe, false);
  assert.equal(checkRecipe(recipe("Oat Milk"), CATALOG, constraints).safe, true);
});

test("the trail names every ingredient, in recipe order", () => {
  const constraints = constraintsFrom({ allergies: ["Dairy"] }, CATALOG);
  const report = checkRecipe(recipe("Coconut Water", "Whole Milk", "Mango"), CATALOG, constraints);
  assert.deepEqual(report.checks.map((c) => c.name), ["Coconut Water", "Whole Milk", "Mango"]);
  assert.deepEqual(report.checks.map((c) => c.passed), [true, false, true]);
});

test("a missing profile yields no constraints rather than throwing", () => {
  const constraints = constraintsFrom(null, CATALOG);
  assert.deepEqual(constraints.allergenIds, []);
  assert.equal(checkRecipe(recipe("Almond Butter"), CATALOG, constraints).safe, true);
});

test("multiple allergies all block", () => {
  const constraints = constraintsFrom({ allergies: ["Dairy", "Soy"] }, CATALOG);
  const report = checkRecipe(recipe("Whole Milk", "Silken Tofu", "Mango"), CATALOG, constraints);
  assert.equal(report.safe, false);
  assert.deepEqual(report.blockedBy.sort(), ["dairy", "soy"]);
});
