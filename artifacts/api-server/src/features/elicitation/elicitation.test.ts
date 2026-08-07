import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptPropose } from "./adapt.ts";
import { KeywordAssistProvider } from "./provider.ts";
import { PROPOSE_SCHEMA } from "./schema.ts";
import { STEPS, belongsToStep, ALL_OPTION_IDS, UNSPECIFIED, OUT_OF_DOMAIN } from "./steps.ts";

test("a clean answer becomes a proposal", () => {
  const p = adaptPropose(
    { stepKey: "goals", optionIds: ["gut-health", "energy-focus"], confidence: "high", message: "Got it." },
    "goals",
  );
  assert.deepEqual(p.proposed.map((o) => o.id), ["gut-health", "energy-focus"]);
  assert.equal(p.confidence, "high");
  assert.equal(p.outOfDomain, false);
});

test("an id from another step is dropped, not remapped", () => {
  // "sweet" is a taste option. Asked about goals, it is not an answer, and the
  // nearest goal is not what the user said.
  const p = adaptPropose({ stepKey: "goals", optionIds: ["sweet", "gut-health"], confidence: "high" }, "goals");
  assert.deepEqual(p.proposed.map((o) => o.id), ["gut-health"]);
});

test("answering a step that was not asked yields nothing at all", () => {
  const p = adaptPropose({ stepKey: "taste", optionIds: ["sweet"], confidence: "high", message: "Sweet it is." }, "goals");
  assert.deepEqual(p.proposed, []);
  assert.equal(p.message, "", "a confident message must not survive its own answer being discarded");
});

test("a single-choice step never proposes two options", () => {
  const p = adaptPropose({ stepKey: "activity", optionIds: ["active", "moderate"], confidence: "high" }, "activity");
  assert.equal(p.proposed.length, 1);
});

test("a multi-choice step keeps all valid ids", () => {
  const p = adaptPropose({ stepKey: "taste", optionIds: ["sweet", "sour", "fresh"], confidence: "high" }, "taste");
  assert.equal(p.proposed.length, 3);
});

test("repeated ids do not produce duplicate chips", () => {
  const p = adaptPropose({ stepKey: "taste", optionIds: ["sour", "sour", "sweet"], confidence: "high" }, "taste");
  assert.deepEqual(p.proposed.map((o) => o.id), ["sour", "sweet"]);
});

test("UNSPECIFIED means silence, and produces no chips and no complaint", () => {
  const p = adaptPropose({ stepKey: "goals", optionIds: [UNSPECIFIED], confidence: "low" }, "goals");
  assert.deepEqual(p.proposed, []);
  assert.equal(p.outOfDomain, false);
  assert.equal(p.message, "");
});

test("OUT_OF_DOMAIN is distinct from silence and keeps the user's words", () => {
  const p = adaptPropose(
    { stepKey: "goals", optionIds: [OUT_OF_DOMAIN], confidence: "medium", unmappedText: "help with my migraines" },
    "goals",
  );
  assert.deepEqual(p.proposed, []);
  assert.equal(p.outOfDomain, true);
  assert.equal(p.unmappedText, "help with my migraines");
});

test("an unknown id is dropped rather than invented into an option", () => {
  const p = adaptPropose({ stepKey: "goals", optionIds: ["weight-loss"], confidence: "high" }, "goals");
  assert.deepEqual(p.proposed, []);
});

test("an empty proposal cannot be high confidence", () => {
  const p = adaptPropose({ stepKey: "goals", optionIds: [], confidence: "high" }, "goals");
  assert.equal(p.confidence, "low");
});

test("garbage in every field yields an empty proposal rather than throwing", () => {
  for (const raw of [{}, { optionIds: "gut-health" }, { optionIds: [1, null] }, { stepKey: 7 }]) {
    const p = adaptPropose(raw as Record<string, unknown>, "goals");
    assert.deepEqual(p.proposed, []);
  }
});

test("an unknown step yields an empty proposal", () => {
  assert.deepEqual(adaptPropose({ stepKey: "nope", optionIds: ["sweet"] }, "nope").proposed, []);
});

test("prose is truncated rather than passed through at any length", () => {
  const p = adaptPropose(
    { stepKey: "goals", optionIds: ["gut-health"], confidence: "high", message: "x".repeat(5000) },
    "goals",
  );
  assert.ok(p.message.length <= 200);
});

/* ---- the schema is a constant, and stays one ---- */

test("the schema is frozen, so it cannot be narrowed per request", () => {
  assert.ok(Object.isFrozen(PROPOSE_SCHEMA));
  assert.throws(() => {
    (PROPOSE_SCHEMA as { properties?: unknown }).properties = {};
  });
});

test("the schema's enum covers every option the steps define", () => {
  const props = PROPOSE_SCHEMA.properties as { optionIds: { items: { enum: string[] } } };
  for (const id of ALL_OPTION_IDS) {
    assert.ok(props.optionIds.items.enum.includes(id), `${id} is unreachable from the schema`);
  }
  assert.ok(props.optionIds.items.enum.includes(UNSPECIFIED));
  assert.ok(props.optionIds.items.enum.includes(OUT_OF_DOMAIN));
});

test("no option id is shared between two steps", () => {
  // The whole validation strategy rests on an id identifying its step. If two
  // steps ever share one, a wrong-step answer becomes indistinguishable from a
  // right one and belongsToStep stops meaning anything.
  for (const id of ALL_OPTION_IDS) {
    const owners = STEPS.filter((s) => belongsToStep(s.key, id));
    assert.equal(owners.length, 1, `"${id}" belongs to ${owners.map((o) => o.key).join(" and ")}`);
  }
});

/* ---- the keyless fallback ---- */

test("the fallback maps plain sentences without a key or a network", async () => {
  const p = new KeywordAssistProvider();
  const goals = await p.propose("goals", "I keep bloating after lunch and I crash in the afternoon");
  assert.deepEqual(goals.proposed.map((o) => o.id).sort(), ["energy-focus", "gut-health"]);

  const taste = await p.propose("taste", "I like it tart, not sugary");
  assert.ok(taste.proposed.some((o) => o.id === "sour"));
});

test("the fallback misses what it has no word for, and says so", async () => {
  // Not a bug being documented as a feature — a limit being kept visible. The
  // fallback matches substrings, so anything phrased around it goes unmatched:
  // this sentence is unmistakably about gut health and contains none of the
  // words that would say so. It abstains rather than reaching, which is the
  // right failure, and it is also the gap the model exists to close. Picking
  // only examples the keyword list happens to handle would hide how wide that
  // gap is.
  const p = await new KeywordAssistProvider().propose("goals", "things move through me badly and I feel heavy after eating");
  assert.deepEqual(p.proposed, [], "if this ever starts matching, the hint list has been tuned to a test");
});

test("the fallback abstains rather than guessing", async () => {
  const p = await new KeywordAssistProvider().propose("goals", "not sure really, whatever you think");
  assert.deepEqual(p.proposed, []);
  assert.equal(p.confidence, "low");
});

test("the fallback obeys single-choice too, through the same adapter", async () => {
  const p = await new KeywordAssistProvider().propose("activity", "I go to the gym and I also run every day");
  assert.equal(p.proposed.length, 1);
});
