import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GOAL_COPY,
  GOAL_LIST,
  GOAL_WEEKS,
  MAX_SUB_GOALS,
  CLAIM_DISCLAIMER,
  daysElapsed,
  daysRemaining,
  goalEndsAt,
  goalHasEnded,
  isGoal,
  isGoalWeeks,
} from "./goals.ts";
import { GOALS } from "../scoring/index.ts";

test("every goal has copy, and nothing has copy that is not a goal", () => {
  assert.deepEqual(Object.keys(GOAL_COPY).sort(), [...GOALS].sort());
  assert.equal(GOAL_LIST.length, GOALS.length);
});

test("a nutrient-function claim always names the nutrient it rests on", () => {
  // The attribution is what makes it a permitted claim rather than a nice
  // sentence. A line that claims a function without one has drifted.
  for (const copy of GOAL_LIST) {
    if (copy.basis === "nutrient-function") {
      assert.ok(copy.nutrient, `${copy.id} claims a function with no nutrient behind it`);
      assert.ok(
        copy.effect.toLowerCase().includes(copy.nutrient!.toLowerCase()),
        `${copy.id} does not name ${copy.nutrient} in its own text`,
      );
    }
  }
});

test("compositional copy does not carry a nutrient, or claim a function", () => {
  for (const copy of GOAL_LIST) {
    if (copy.basis === "composition") {
      assert.equal(copy.nutrient, undefined, `${copy.id} is compositional but names a nutrient`);
      assert.ok(
        !/\bsupports\b|\bcontributes to\b|\bhelps maintain\b/i.test(copy.effect),
        `${copy.id} uses function-claim language with no nutrient behind it: "${copy.effect}"`,
      );
    }
  }
});

test("no goal copy makes a disease claim", () => {
  // The line both regimes draw, and the one thing no amount of hedging fixes.
  const forbidden = /\b(cure|cures|treat|treats|prevent|prevents|heal|heals|diagnose|remedy)\b/i;
  for (const copy of GOAL_LIST) {
    assert.ok(!forbidden.test(copy.effect), `${copy.id}: "${copy.effect}"`);
  }
});

test("detox makes no claim at all", () => {
  // There is no authorised backing for "detox" in any regime and there is not
  // going to be. If this ever becomes a function claim, it was invented.
  assert.equal(GOAL_COPY["detox-clarity"].basis, "composition");
  assert.ok(!/detox/i.test(GOAL_COPY["detox-clarity"].effect.replace(/^Detox.*?—/, "")));
});

test("the disclaimer exists and disclaims the right things", () => {
  assert.ok(/not intended to diagnose, treat, cure or prevent any disease/i.test(CLAIM_DISCLAIMER));
});

test("goal and week validators reject anything else", () => {
  assert.ok(isGoal("gut-health"));
  assert.ok(!isGoal("weight-loss"));
  assert.ok(!isGoal(7));
  assert.ok(isGoalWeeks(8));
  assert.ok(!isGoalWeeks(5));
  assert.ok(!isGoalWeeks("8"));
  assert.deepEqual([...GOAL_WEEKS], [4, 6, 8, 12]);
});

test("days remaining counts down and stops at zero", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const day = (n: number) => new Date(start.getTime() + n * 86_400_000);

  assert.equal(daysRemaining(start, 4, start), 28);
  assert.equal(daysRemaining(start, 4, day(27)), 1);
  assert.equal(daysRemaining(start, 4, day(28)), 0);
  // Past the end is still zero, not negative — an expired period is over, not
  // overdue by three days.
  assert.equal(daysRemaining(start, 4, day(60)), 0);
});

test("days elapsed counts up and never goes negative", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  assert.equal(daysElapsed(start, start), 0);
  assert.equal(daysElapsed(start, new Date(start.getTime() + 86_400_000 * 3.9)), 3);
  assert.equal(daysElapsed(start, new Date(start.getTime() - 86_400_000)), 0);
});

test("a goal ends exactly on its promised deadline", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const deadline = goalEndsAt(start, 6);
  assert.equal(deadline.toISOString(), "2026-02-12T00:00:00.000Z");
  assert.equal(goalHasEnded(start, 6, new Date(deadline.getTime() - 1)), false);
  assert.equal(goalHasEnded(start, 6, deadline), true);
  assert.equal(goalHasEnded(start, 6, new Date(deadline.getTime() + 8 * 86_400_000)), true);
});

/* ---- ranked goals ---- */

test("sub-goals are capped so they cannot outvote the main goal", () => {
  // The builder scores the main goal at 3 and each sub-goal at 1, so three
  // sub-goals tie with it and four win. Two keeps the drink about what the
  // person came for.
  assert.equal(MAX_SUB_GOALS, 2);
});

test("the cap leaves room for exactly three goals in total", () => {
  // What the goal screen offers — one that shapes the drink, two that nudge —
  // and it has to agree with the builder's own per-day cap, or a standing pair
  // and a daily pair would be different sizes of nudge.
  assert.equal(1 + MAX_SUB_GOALS, 3);
});
