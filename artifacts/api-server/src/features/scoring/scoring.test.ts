import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoreRecipe,
  matchingGoals,
  GOALS,
  GOAL_MATCH_THRESHOLD,
  type ScorableItem,
  type ScorableIngredient,
} from "./scoring.ts";

function ing(
  name: string,
  benefits: string[],
  proteinG: number | null = 0,
  servingGrams: number | null = 100,
): ScorableIngredient {
  return { name, benefits, proteinG, servingGrams };
}

function item(ingredient: ScorableIngredient, grams: number | null = null): ScorableItem {
  return { ingredient, grams: grams ?? ingredient.servingGrams };
}

test("scores every goal, always", () => {
  const scores = scoreRecipe([item(ing("Mango", ["glowy-skin"]))]);
  assert.deepEqual(Object.keys(scores).sort(), [...GOALS].sort());
  for (const v of Object.values(scores)) {
    assert.ok(v >= 0 && v <= 1, `${v} out of range`);
  }
});

test("an empty recipe scores zero rather than dividing by zero", () => {
  const scores = scoreRecipe([]);
  assert.ok(Object.values(scores).every((v) => v === 0));
});

test("a goal nothing carries scores zero", () => {
  const scores = scoreRecipe([item(ing("Mango", ["glowy-skin"]))]);
  assert.equal(scores["detox-clarity"], 0);
});

test("more on-goal ingredients score higher", () => {
  const one = scoreRecipe([item(ing("A", ["gut-health"])), item(ing("B", ["hydration"]))]);
  const two = scoreRecipe([item(ing("A", ["gut-health"])), item(ing("B", ["gut-health"]))]);
  assert.ok(two["gut-health"] > one["gut-health"]);
});

test("off-goal ingredients dilute the score", () => {
  const focused = scoreRecipe([
    item(ing("A", ["gut-health"])),
    item(ing("B", ["gut-health"])),
    item(ing("C", ["gut-health"])),
  ]);
  const scattered = scoreRecipe([
    item(ing("A", ["gut-health"])),
    item(ing("B", ["gut-health"])),
    item(ing("C", ["gut-health"])),
    item(ing("D", ["sun-ritual"])),
    item(ing("E", ["sun-ritual"])),
  ]);
  assert.equal(focused["gut-health"], 1);
  assert.ok(scattered["gut-health"] < focused["gut-health"]);
});

test("ingredients with no benefits do not dilute anything", () => {
  const bare = [item(ing("A", ["hydration"])), item(ing("B", ["hydration"]))];
  const withIce = [...bare, item(ing("Ice", []))];
  assert.equal(scoreRecipe(withIce)["hydration"], scoreRecipe(bare)["hydration"]);
});

test("protein-power is scored on dose, not on tag count", () => {
  // The regression this whole design exists for. Cloud Nine Shaker: one
  // protein-tagged ingredient out of four, but ~27g of protein in the glass.
  // Tag counting put it at 0.29 — under the threshold, invisible for the one
  // goal it was written to serve.
  const cloudNine = [
    item(ing("Whey Protein Isolate", ["protein-power"], 90, 30)),
    item(ing("Avocado", ["glowy-skin", "hydration"], 2, 50)),
    item(ing("Coconut Water", ["energy-focus", "hydration"], 0.7, 250)),
    item(ing("Blueberry", ["anti-inflammatory", "glowy-skin"], 0.7, 70)),
  ];
  const scores = scoreRecipe(cloudNine);
  assert.ok(
    scores["protein-power"] >= GOAL_MATCH_THRESHOLD,
    `protein-power ${scores["protein-power"]} should clear ${GOAL_MATCH_THRESHOLD}`,
  );
  assert.ok(scores["protein-power"] > scores["glowy-skin"]);
});

test("a fruit smoothie does not score as a protein drink", () => {
  const scores = scoreRecipe([
    item(ing("Mango", ["glowy-skin"], 0.8, 120)),
    item(ing("Coconut Water", ["hydration"], 0.7, 250)),
  ]);
  assert.ok(scores["protein-power"] < GOAL_MATCH_THRESHOLD);
});

test("unknown protein falls back to tags instead of counting as zero", () => {
  // Collagen peptides are nearly pure protein and have no USDA row. Summing
  // the gap as zero would score the most protein-dense thing in the catalog
  // as contributing none.
  const withGap = [
    item(ing("Collagen Peptides", ["protein-power", "glowy-skin"], null, 12)),
    item(ing("Whey Protein Isolate", ["protein-power"], 90, 30)),
    item(ing("Coconut Water", ["hydration"], 0.7, 250)),
  ];
  const scores = scoreRecipe(withGap);
  assert.ok(scores["protein-power"] > 0, "a missing figure must not read as zero protein");
});

test("a missing protein figure never costs a recipe a place it earned on tags", () => {
  const items = [
    item(ing("Whey", ["protein-power"], null, 30)),
    item(ing("Pea Protein", ["protein-power"], null, 30)),
    item(ing("Greek Yogurt", ["protein-power"], null, 150)),
  ];
  assert.equal(scoreRecipe(items)["protein-power"], 1);
});

test("matchingGoals returns only what clears the threshold, best first", () => {
  const matches = matchingGoals({
    "gut-health": 0.9,
    "hydration": 0.5,
    "sun-ritual": 0.49,
    "glowy-skin": 0.7,
  });
  assert.deepEqual(
    matches.map((m) => m.goal),
    ["gut-health", "glowy-skin", "hydration"],
  );
});

test("scores are rounded, not truncated toward zero", () => {
  for (const v of Object.values(scoreRecipe([item(ing("A", ["gut-health"])), item(ing("B", ["hydration"]))]))) {
    assert.equal(v, Math.round(v * 100) / 100);
  }
});
