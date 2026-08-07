import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adaptNaming,
  fallbackNaming,
  makesClaim,
  sanitiseStory,
  namingPrompt,
  type NamingInput,
} from "./naming.ts";
import { nameDrink, FallbackNamingProvider, type NamingProvider } from "./provider.ts";
import type { Pick } from "../generation/index.ts";

const pick = (name: string, slot = "flavor"): Pick => ({
  step: 1,
  name,
  slot,
  reason: "",
  grams: 100,
  kcal: 50,
  proteinG: 1,
});

const input: NamingInput = {
  picks: [pick("Coconut Water", "liquid"), pick("Mango"), pick("Kefir", "protein")],
  goal: "gut-health",
  subGoals: [],
  preset: "great",
};

test("a clean answer is kept", () => {
  const r = adaptNaming({ name: "Mango Morning", story: "Mango and kefir over coconut water. Light, tangy, easy before work." }, input, "groq");
  assert.equal(r.name, "Mango Morning");
  assert.match(r.story, /^Mango and kefir/);
  assert.equal(r.writtenBy, "groq");
});

test("a health claim in the story is dropped, the rest survives", () => {
  const r = adaptNaming(
    { name: "Green Start", story: "Spinach and lemon over green tea. It detoxifies your liver. Sharp and cold." },
    input,
    "groq",
  );
  assert.ok(!/detoxif/i.test(r.story), r.story);
  assert.match(r.story, /Spinach and lemon/);
  assert.match(r.story, /Sharp and cold/);
});

test("a story that is nothing but claims falls back rather than going empty", () => {
  const r = adaptNaming({ name: "Reset", story: "This cures bloating. It burns fat fast." }, input, "groq");
  assert.ok(r.story.length > 0);
  assert.ok(!makesClaim(r.story));
  assert.match(r.writtenBy, /fallback/);
});

test("a name that makes a claim is replaced, not trimmed", () => {
  // There is no sentence to drop from two words.
  const r = adaptNaming({ name: "Fat Burner", story: "Mango and kefir. Cold and tangy." }, input, "groq");
  assert.notEqual(r.name, "Fat Burner");
  assert.ok(!makesClaim(r.name));
});

test("the claim filter catches the phrasings that actually get written", () => {
  for (const bad of [
    "detoxifies your system",
    "boosts your metabolism",
    "helps you lose weight",
    "clinically proven",
    "anti-aging",
    "cures a hangover",
    "burns fat",
    "boost your immunity",
  ]) {
    assert.ok(makesClaim(bad), `missed: ${bad}`);
  }
});

test("ordinary description is not mistaken for a claim", () => {
  for (const fine of [
    "Sharp, green and cold.",
    "Mango and kefir over coconut water.",
    "The one for a morning that started badly.",
    "Fibre from oats and chia.",
  ]) {
    assert.ok(!makesClaim(fine), `false positive: ${fine}`);
  }
});

test("names and stories are capped", () => {
  const r = adaptNaming({ name: "x".repeat(200), story: "y ".repeat(500) }, input, "groq");
  assert.ok(r.name.length <= 40, `name was ${r.name.length}`);
  assert.ok(r.story.length <= 320, `story was ${r.story.length}`);
});

test("wrapping quotes are stripped", () => {
  assert.equal(adaptNaming({ name: '"Jade Morning"', story: "Green and cold." }, input, "groq").name, "Jade Morning");
});

test("garbage yields the fallback rather than throwing", () => {
  for (const raw of [{}, { name: 7, story: null }, { name: "", story: "" }]) {
    const r = adaptNaming(raw as Record<string, unknown>, input, "groq");
    assert.ok(r.name.length > 0 && r.story.length > 0);
  }
});

test("the fallback names a drink after what is in it", () => {
  const r = fallbackNaming(input);
  assert.equal(r.name, "Mango & Kefir");
  assert.match(r.story, /gut health/);
  assert.equal(r.writtenBy, "fallback");
  assert.ok(!makesClaim(r.story));
});

test("the fallback copes with a drink that is only liquid", () => {
  const r = fallbackNaming({ ...input, picks: [pick("Coconut Water", "liquid")] });
  assert.ok(r.name.length > 0);
});

test("sanitise keeps sentence boundaries rather than cutting mid-thought", () => {
  const out = sanitiseStory("One good line. This cures everything. Another good line.");
  assert.equal(out, "One good line. Another good line.");
});

test("the prompt lists every ingredient and never invents one", () => {
  const p = namingPrompt(input);
  for (const i of input.picks) assert.ok(p.includes(i.name), `${i.name} missing from prompt`);
  assert.match(p, /gut health/);
});

test("a provider that throws never takes the batch down", async () => {
  const broken: NamingProvider = {
    name: "broken",
    write: () => Promise.reject(new Error("network")),
  };
  const r = await nameDrink(input, broken);
  assert.equal(r.writtenBy, "fallback");
  assert.ok(r.name.length > 0);
});

test("the fallback provider is a real provider, not a stub", async () => {
  const r = await nameDrink(input, new FallbackNamingProvider());
  assert.equal(r.name, "Mango & Kefir");
});
