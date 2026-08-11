/**
 * Goals, and what each one claims.
 *
 * This copy sits under every goal card in the product, so what it is allowed
 * to say is worth being precise about rather than leaving to whoever writes
 * the next one.
 *
 * The register is the ordinary one for this category: nutrient function
 * claims. Both major regimes permit them and both draw the same line —
 * US structure/function claims under DSHEA ("supports", "helps maintain",
 * with the standard disclaimer), EU claims from the authorised Article 13
 * register. Neither permits saying a food treats, prevents or cures anything,
 * and that is the line held here.
 *
 * Where an authorised nutrient function claim genuinely exists, the copy uses
 * it and names the nutrient it hangs on — that attribution is what makes it a
 * permitted claim rather than a nice sentence. Where none exists, the copy
 * describes what is in the glass and stops there. "Detox" has no authorised
 * backing anywhere and is not going to acquire any, so that card talks about
 * greens and sugar rather than about cleansing.
 *
 * `basis` records which of the two each line is, so the distinction survives
 * the next edit. A claim that quietly migrates from `composition` to
 * `nutrient-function` without a nutrient behind it is the failure mode.
 */

import { GOALS, type Goal } from "../scoring/index.ts";

/**
 * `nutrient-function` — hangs on a nutrient with an authorised function claim,
 * named in the text. `composition` — describes the contents, claims nothing.
 */
export type ClaimBasis = "nutrient-function" | "composition";

export interface GoalCopy {
  id: Goal;
  label: string;
  /** One line under the card. */
  effect: string;
  basis: ClaimBasis;
  /**
   * The nutrient the claim rests on, for `nutrient-function` lines. Present so
   * the claim can be checked against the register it came from, and so a
   * recipe that does not actually deliver that nutrient can be caught.
   */
  nutrient?: string;
}

export const GOAL_COPY: Record<Goal, GoalCopy> = {
  // Vitamin C's contribution to normal collagen formation for the normal
  // function of skin is an authorised function claim.
  "glowy-skin": {
    id: "glowy-skin",
    label: "Glowy Skin",
    effect: "Vitamin C supports normal collagen formation for skin. Built on citrus, berries and mango.",
    basis: "nutrient-function",
    nutrient: "vitamin C",
  },
  // Water's contribution to normal physical and cognitive function is
  // authorised, but only for water intake as such — so this stays close to it
  // and does not stretch to skin or anything else.
  hydration: {
    id: "hydration",
    label: "Deep Hydration",
    effect: "Water and electrolytes support normal physical and cognitive function. Coconut water, watermelon, citrus.",
    basis: "nutrient-function",
    nutrient: "water",
  },
  // No authorised claim for lycopene or beta-carotene in this context.
  // Composition only.
  "sun-ritual": {
    id: "sun-ritual",
    label: "Sun Ritual",
    effect: "Lycopene- and beta-carotene-rich fruit — watermelon, tomato, mango.",
    basis: "composition",
  },
  // Protein's contribution to the growth and maintenance of muscle mass is
  // authorised. The 25g figure is what the builder actually targets.
  "protein-power": {
    id: "protein-power",
    label: "Protein & Power",
    effect: "Protein supports the growth and maintenance of muscle mass. Aims for around 25g.",
    basis: "nutrient-function",
    nutrient: "protein",
  },
  // Curcumin and ginger have no authorised claim. This is the traditional-use
  // framing, which is a statement about custom rather than about effect.
  "anti-inflammatory": {
    id: "anti-inflammatory",
    label: "Anti-Inflammatory",
    effect: "Turmeric, ginger and tart cherry — the group traditionally taken after hard training.",
    basis: "composition",
  },
  // "Detox" has no authorised backing. What is true is that these builds are
  // green and come out low in sugar, so that is what it says.
  "detox-clarity": {
    id: "detox-clarity",
    label: "Detox & Clarity",
    effect: "Green and leafy — spinach, matcha, lemon. Comes out low in sugar.",
    basis: "composition",
  },
  // Fibre's contribution to normal bowel function is authorised. Live cultures
  // are not, in either regime, so they are named as an ingredient rather than
  // credited with anything.
  "gut-health": {
    id: "gut-health",
    label: "Gut Health",
    effect: "Fibre supports normal bowel function. Oats, chia and flax, with live-culture kefir or yoghurt.",
    basis: "nutrient-function",
    nutrient: "fibre",
  },
  // Caffeine's contribution to alertness is authorised above a threshold dose.
  "energy-focus": {
    id: "energy-focus",
    label: "Energy & Focus",
    effect: "Caffeine supports alertness and concentration. Matcha, espresso or green tea over a slower base.",
    basis: "nutrient-function",
    nutrient: "caffeine",
  },
};

/**
 * The disclaimer that accompanies structure/function claims.
 *
 * Shown once wherever these lines appear rather than repeated per card. It is
 * the standard wording and is not optional in the US regime.
 */
export const CLAIM_DISCLAIMER =
  "These statements have not been evaluated by a regulatory authority. This product is not intended to diagnose, treat, cure or prevent any disease.";

export const GOAL_LIST: GoalCopy[] = GOALS.map((g) => GOAL_COPY[g]);

/**
 * Offered commitment lengths.
 *
 * Weeks, because that is the unit the choice is made in — nobody picks the
 * 14th of March, they pick "about two months". Four is short enough to finish,
 * twelve long enough to be a decision, and the two between stop the scale
 * jumping straight from a month to a season.
 */
export const GOAL_WEEKS = [4, 6, 8, 12] as const;

/**
 * How many goals may sit behind the main one.
 *
 * Two. The builder scores the main goal at three points against each
 * sub-goal's one, so three sub-goals tie with it and four outvote it — at
 * which point the drink is no longer about what the person came for. The same
 * number caps the builder's per-day extras, so a standing pair and a daily
 * pair are the same size of nudge.
 */
export const MAX_SUB_GOALS = 2;

export type GoalWeeks = (typeof GOAL_WEEKS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export const isGoal = (v: unknown): v is Goal =>
  typeof v === "string" && (GOALS as readonly string[]).includes(v);

export const isGoalWeeks = (v: unknown): v is GoalWeeks =>
  typeof v === "number" && (GOAL_WEEKS as readonly number[]).includes(v);

/** Whole days from a start date to the end of a period, floored at zero. */
export function daysRemaining(startedAt: Date, weeks: number, now: Date = new Date()): number {
  const end = goalEndsAt(startedAt, weeks);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

/** Whole days elapsed since a period began, floored at zero. */
export function daysElapsed(startedAt: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS));
}

/** The exact end is kept as history, rather than the first later page load. */
export const goalEndsAt = (startedAt: Date, weeks: number): Date =>
  new Date(startedAt.getTime() + weeks * 7 * DAY_MS);

/** A period ends on its deadline; an eighth week of a six-week goal is not real. */
export const goalHasEnded = (startedAt: Date, weeks: number, now: Date = new Date()): boolean =>
  now.getTime() >= goalEndsAt(startedAt, weeks).getTime();
