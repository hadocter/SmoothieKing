import { test } from "node:test";
import assert from "node:assert/strict";
import { appearanceOf, representativeIngredients } from "./appearance.ts";
import { presetForMinutes, presetsWithin, PRESETS } from "./builder.ts";
import type { Pick } from "./builder.ts";

const pick = (name: string, slot = "flavor"): Pick => ({
  step: 1,
  name,
  slot,
  reason: "",
  grams: 100,
  kcal: 50,
  proteinG: 1,
});

const HEX: Record<string, string> = {
  Spinach: "#3F7A3F",
  Beetroot: "#8E2F4E",
  "Coconut Water": "#EFEAD8",
  Banana: "#F2E1A8",
  Mango: "#F2AE4B",
  Milk: "#FAF7F0",
};
const hexOf = (n: string) => HEX[n] ?? null;

test("a gradient comes out of the ingredients that are actually in it", () => {
  const a = appearanceOf([pick("Spinach"), pick("Beetroot"), pick("Coconut Water", "liquid")], hexOf);
  assert.ok(a.stops.length >= 2);
  assert.ok(a.css.startsWith("linear-gradient("));
  assert.match(a.blend, /^#[0-9a-f]{6}$/);
});

test("two different drinks do not look the same", () => {
  const green = appearanceOf([pick("Spinach"), pick("Coconut Water", "liquid")], hexOf);
  const red = appearanceOf([pick("Beetroot"), pick("Coconut Water", "liquid")], hexOf);
  assert.notEqual(green.css, red.css);
});

test("the same drink always looks the same", () => {
  const picks = [pick("Mango"), pick("Banana"), pick("Milk", "liquid")];
  assert.deepEqual(appearanceOf(picks, hexOf), appearanceOf(picks, hexOf));
});

test("stops run light to dark", () => {
  const a = appearanceOf([pick("Spinach"), pick("Banana"), pick("Beetroot")], hexOf);
  const luma = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  for (let i = 1; i < a.stops.length; i += 1) {
    assert.ok(luma(a.stops[i - 1]) >= luma(a.stops[i]), `${a.stops.join(" → ")} is not ordered`);
  }
});

test("text over a pale drink is dark, and over a dark drink is light", () => {
  assert.equal(appearanceOf([pick("Milk", "liquid"), pick("Banana")], hexOf).onBlend, "#1a1a1a");
  assert.equal(appearanceOf([pick("Spinach"), pick("Beetroot")], hexOf).onBlend, "#ffffff");
});

test("no known colours yields a usable grey rather than a broken gradient", () => {
  const a = appearanceOf([pick("Mystery")], () => null);
  assert.equal(a.stops.length, 2);
  assert.ok(a.css.includes("linear-gradient"));
  assert.equal(a.onBlend, "#1a1a1a");
});

test("an empty drink does not throw", () => {
  assert.ok(appearanceOf([], hexOf).css.length > 0);
});

test("one ingredient still produces two stops", () => {
  const a = appearanceOf([pick("Mango")], hexOf);
  assert.equal(a.stops.length, 2);
  assert.notEqual(a.stops[0], a.stops[1]);
});

test("representative ingredients skip the liquid when there is anything better", () => {
  const picks = [pick("Coconut Water", "liquid"), pick("Mango"), pick("Spinach"), pick("Beetroot")];
  assert.deepEqual(representativeIngredients(picks), ["Mango", "Spinach", "Beetroot"]);
});

test("a drink that is only liquid still names something", () => {
  assert.deepEqual(representativeIngredients([pick("Coconut Water", "liquid")]), ["Coconut Water"]);
});

/* ---- time budget ---- */

test("every preset carries how long it takes", () => {
  for (const p of PRESETS) assert.ok(p.minutes > 0, `${p.id} has no time`);
});

test("more time buys a more substantial drink", () => {
  const generous = PRESETS.find((p) => p.id === presetForMinutes(60))!;
  const tight = PRESETS.find((p) => p.id === presetForMinutes(4))!;
  assert.ok(generous.calorieTarget > tight.calorieTarget);
});

test("no time at all still returns something makeable", () => {
  assert.equal(presetForMinutes(0), "quick");
  assert.equal(presetForMinutes(-5), "quick");
  assert.deepEqual(presetsWithin(0).map((p) => p.id), ["quick"]);
});

test("presets offered all fit in the time given", () => {
  for (const minutes of [4, 5, 8, 20]) {
    for (const p of presetsWithin(minutes)) {
      assert.ok(p.minutes <= minutes || p.id === "quick", `${p.id} (${p.minutes}m) offered for ${minutes}m`);
    }
  }
});

test("a batch never offers two drinks with the same name", async () => {
  // The model names each drink independently and the drinks in a batch are
  // similar by construction, so collisions happen — two of six came back
  // identical on the first real run.
  const { applyNaming } = await import("./generate.ts");

  const drink = (names: string[]) => ({
    recipe: { name: "", slug: names.join("-") } as never,
    result: {
      picks: names.map((n, i) => ({ ...pick(n), step: i + 1, slot: i === 0 ? "liquid" : "flavor" })),
      excludedNames: [],
      missingStructuralSlots: [],
      totalKcal: 100,
      totalProteinG: 5,
      totalGrams: 300,
      preset: "great" as const,
      seed: 0,
    },
  });

  const named = await applyNaming(
    [drink(["Milk", "Mango", "Banana"]), drink(["Milk", "Mango", "Spinach"])],
    { primaryGoal: "gut-health", secondaryGoals: [], tastePreference: [], allergies: [], dislikedIngredients: [] },
    "great",
  );

  const names = named.map((d) => d.recipe.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, `duplicate names: ${names.join(", ")}`);
});
