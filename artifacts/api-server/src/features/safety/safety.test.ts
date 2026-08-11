import { test } from "node:test";
import assert from "node:assert/strict";
import { allergenClasses, checkRecipe, constraintsFrom, type CheckableIngredient } from "./safety.ts";

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

/* ---- the offered set and the enforceable set are the same set ---- */

test("every allergen class offered is one the catalog can enforce", () => {
  // Exhaustive by construction: the list is derived from what ingredients are
  // actually tagged with, so it cannot offer a filter with nothing behind it —
  // which is what Shellfish and Egg were against a smoothie catalog.
  for (const c of allergenClasses(CATALOG)) {
    assert.ok(c.ingredients.length > 0, `${c.id} is offered but nothing carries it`);
    const constraints = constraintsFrom({ allergies: [c.label] }, CATALOG);
    assert.deepEqual(constraints.unresolved, [], `${c.label} is offered but not enforceable`);
    const report = checkRecipe(recipe(c.ingredients[0]), CATALOG, constraints);
    assert.equal(report.safe, false, `${c.label} did not block ${c.ingredients[0]}`);
  }
});

test("every allergen the catalog tags is offered", () => {
  // The other direction. `peanut` was tagged on peanut butter with no way to
  // select it, so someone with a peanut allergy had no way to say so.
  const tagged = new Set(CATALOG.flatMap((i) => i.contains));
  const offered = new Set(allergenClasses(CATALOG).map((c) => c.id));
  for (const id of tagged) {
    assert.ok(offered.has(id), `${id} is tagged on an ingredient but never offered`);
  }
});

test("an allergy to a single ingredient blocks as hard as a class", () => {
  // Not a preference. Someone allergic to banana had nowhere to say so except
  // the dislikes list, which generation avoids but the safety check ignores.
  const constraints = constraintsFrom({ allergies: ["Banana"] }, CATALOG);
  assert.equal(checkRecipe(recipe("Banana", "Mango"), CATALOG, constraints).safe, false);
  assert.equal(checkRecipe(recipe("Mango"), CATALOG, constraints).safe, true);
});

test("classes carry what holds them, so the choice is not made blind", () => {
  const dairy = allergenClasses(CATALOG).find((c) => c.id === "dairy");
  assert.ok(dairy);
  assert.ok(dairy!.ingredients.includes("Whole Milk"));
});

test("an untagged allergen degrades to its id rather than vanishing", () => {
  // A missing label should cost an ugly option, never an unofferable allergy.
  const extended = [...CATALOG, { ...CATALOG[0], name: "Sesame Paste", contains: ["sesame"] }];
  const sesame = allergenClasses(extended).find((c) => c.id === "sesame");
  assert.ok(sesame, "a newly tagged allergen must appear");
  assert.equal(sesame!.label, "sesame");
});

/* ------------------------------------------------------------------ */
/* Malformed input                                                     */
/* ------------------------------------------------------------------ */

/**
 * The shape a caller sends is not something the check gets to assume.
 *
 * Entries it could not read a name from used to be skipped, so a caller
 * passing bare strings got an empty trail and `safe: true` — a recipe with
 * almond milk verified clear under a tree-nut allergy. Failing closed has to
 * cover being called wrongly, not only being called with unknown ingredients.
 */

test("a bare string is read as a name rather than skipped", () => {
  const report = checkRecipe(
    ["Almond butter", "Mango"],
    CATALOG,
    constraintsFrom({ allergies: ["Tree Nuts"] }, CATALOG),
  );
  assert.equal(report.safe, false);
  assert.equal(report.checks.length, 2);
  assert.ok(report.blockedBy.includes("tree-nut"));
});

test("an entry with no readable name blocks under a stated allergy", () => {
  const report = checkRecipe(
    [{ nope: 1 }, { name: "Mango" }],
    CATALOG,
    constraintsFrom({ allergies: ["Tree Nuts"] }, CATALOG),
  );
  assert.equal(report.safe, false);
  assert.ok(report.blockedBy.includes("unknown-ingredient"));
  // The trail accounts for every entry, so the count cannot silently shrink.
  assert.equal(report.checks.length, 2);
});

test("a malformed entry is reported, not silently dropped", () => {
  const report = checkRecipe(
    [null, { name: "Mango" }],
    CATALOG,
    constraintsFrom({ allergies: ["Tree Nuts"] }, CATALOG),
  );
  assert.equal(report.checks.length, 2);
  assert.equal(report.unknownIngredients.length, 1);
});

test("with nothing stated, a malformed entry is still surfaced but passes", () => {
  const report = checkRecipe([{ nope: 1 }], CATALOG, constraintsFrom({}, CATALOG));
  assert.equal(report.safe, true);
  assert.equal(report.checks.length, 1);
  assert.equal(report.unknownIngredients.length, 1);
});
