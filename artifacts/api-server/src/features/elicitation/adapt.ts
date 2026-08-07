/**
 * Validating what the model returned.
 *
 * The schema is frozen and covers every step's options at once, so the model
 * *can* answer the goals step with a taste id. This is where that gets caught.
 *
 * The rule throughout is reject, never repair. A value that does not belong to
 * the step being asked is dropped, not remapped onto the nearest thing that
 * would fit. Repairing produces an answer that looks like the user's and is
 * not, and the user has no way to tell the difference — which is the one
 * failure mode a proposal-and-confirm flow is supposed to make impossible.
 *
 * Everything returned here is unconfirmed. Nothing in this file decides
 * anything about a person; it decides what to *offer* them.
 */

import { belongsToStep, stepByKey, UNSPECIFIED, OUT_OF_DOMAIN, type StepOption } from "./steps.ts";

export interface RawPropose {
  stepKey?: unknown;
  optionIds?: unknown;
  confidence?: unknown;
  message?: unknown;
  unmappedText?: unknown;
  occasion?: unknown;
  timeframeWeeks?: unknown;
}

export interface Proposal {
  /** Options to highlight. Always a subset of the asked step's own options. */
  proposed: StepOption[];
  confidence: "high" | "medium" | "low";
  /** A sentence reflecting back what was understood, or empty. */
  message: string;
  /**
   * True when the user said something clear that no option covers.
   *
   * Kept separate from an empty proposal, because the two need different
   * things said to the user: "I didn't catch a preference there" versus "we
   * don't have an option for that".
   */
  outOfDomain: boolean;
  /** Their words for the part no option holds. Empty unless outOfDomain. */
  unmappedText: string;
  /**
   * What they are preparing for, if they named it — "a wedding", "a marathon".
   *
   * Distinct from the goal. The goal is what the drinks are built for; this is
   * why, and it is the thing worth saying back to them. Empty when they named
   * nothing, and nothing infers one.
   */
  occasion: string;
  /**
   * Weeks until it, if they said so out loud. Null otherwise.
   *
   * Null is the common and correct answer. See `mentionsTimeframe` for why it
   * is checked against the message rather than trusted.
   */
  timeframeWeeks: number | null;
}

const ALLOWED_WEEKS = [4, 6, 8, 12];

/**
 * Words and digits that could be a stated timeframe.
 *
 * The model is asked not to invent a deadline and mostly does not, but "I want
 * to feel better soon" is exactly the kind of sentence that produces a
 * confident "6 weeks" from nowhere. A deadline nobody set, shown back to
 * someone as their own, is worse than no deadline — so a timeframe survives
 * only if the message plausibly contains one.
 *
 * Deliberately generous: it only has to be evidence that a period was
 * mentioned, and a false positive here costs a wrong number the user can see
 * and change on the same screen.
 */
/**
 * Latin timeframe words, matched on word boundaries.
 *
 * Substring matching was the first attempt and it was wrong in a way worth
 * keeping a note about: "in " matches inside "skin to", so "I just want my
 * skin to look better" read as a stated deadline and kept whatever number the
 * model had invented. Its own test caught it.
 */
const TIMEFRAME_WORDS =
  /\b(weeks?|months?|days?|years?|wks?|summer|winter|spring|autumn|fall|by|before|until|deadline|within|in)\b/i;

/**
 * Korean has no word boundaries to anchor to, so these are plain substrings.
 * They are distinctive enough not to appear inside unrelated words.
 */
const TIMEFRAME_KO = ["주", "개월", "달", "년", "일", "안에", "까지"];

/**
 * Whether the message plausibly named a period.
 *
 * The model is asked not to invent a deadline and mostly does not, but "I want
 * to feel better soon" is exactly the kind of sentence that produces a
 * confident "6 weeks" from nowhere. A deadline nobody set, shown back to
 * someone as their own, is worse than no deadline — so a timeframe survives
 * only if the message could have contained one.
 *
 * Generous by design: this only has to be evidence a period was mentioned, and
 * a false positive costs a wrong number the user can see and change on the
 * same screen.
 */
export function mentionsTimeframe(text: string): boolean {
  if (/\d/.test(text)) return true;
  if (TIMEFRAME_WORDS.test(text)) return true;
  return TIMEFRAME_KO.some((w) => text.includes(w));
}

const CONFIDENCES = ["high", "medium", "low"] as const;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Caps the length of anything the model wrote in prose.
 *
 * These strings are rendered back to the user, and a model that ignores "one
 * short sentence" should cost a truncated line rather than a page of text in
 * the middle of onboarding.
 */
const trimTo = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

export function adaptPropose(raw: RawPropose, askedStepKey: string, userText = ""): Proposal {
  const step = stepByKey(askedStepKey);
  const empty: Proposal = {
    proposed: [],
    confidence: "low",
    message: "",
    outOfDomain: false,
    unmappedText: "",
    occasion: "",
    timeframeWeeks: null,
  };
  if (!step) return empty;

  const values = Array.isArray(raw.optionIds) ? raw.optionIds.filter((v): v is string => typeof v === "string") : [];

  // A stepKey naming a different step means the model answered a question it
  // was not asked. Its ids are about that other step, so none of them are
  // usable here — dropping the values while keeping the confidence and the
  // message would leave a confident-sounding reply attached to nothing.
  const answeredAsked = raw.stepKey === askedStepKey || raw.stepKey === undefined;
  if (!answeredAsked) return empty;

  const outOfDomain = values.includes(OUT_OF_DOMAIN);

  // Deduplicated before slicing: a model that repeats an id would otherwise
  // fill a single-choice step's one slot with the same option twice, or show
  // the same chip twice on a multi step.
  const validIds = [...new Set(values.filter((v) => belongsToStep(askedStepKey, v)))];
  const kept = step.multi ? validIds : validIds.slice(0, 1);

  const proposed = kept
    .map((id) => step.options.find((o) => o.id === id))
    .filter((o): o is StepOption => o !== undefined);

  const confidence = CONFIDENCES.includes(raw.confidence as (typeof CONFIDENCES)[number])
    ? (raw.confidence as Proposal["confidence"])
    : "low";

  // UNSPECIFIED is not out-of-domain and is not an error: it is the model
  // saying the message had nothing about this step in it, which is the
  // commonest correct answer and should produce no chips and no complaint.
  const saidNothing = values.includes(UNSPECIFIED) && proposed.length === 0;

  const weeksRaw = Number.parseInt(asString(raw.timeframeWeeks), 10);
  const timeframeWeeks =
    ALLOWED_WEEKS.includes(weeksRaw) && mentionsTimeframe(userText) ? weeksRaw : null;

  return {
    proposed,
    // A proposal with nothing in it cannot be high-confidence about anything.
    confidence: proposed.length === 0 ? "low" : confidence,
    message: saidNothing ? "" : trimTo(asString(raw.message), 200),
    outOfDomain: outOfDomain && proposed.length === 0,
    unmappedText: outOfDomain ? trimTo(asString(raw.unmappedText), 200) : "",
    // Short, lower-cased, and never longer than a phrase — it gets rendered
    // inside a sentence, and a model that answers with one is not writing the
    // sentence for us.
    occasion: trimTo(asString(raw.occasion), 40).toLowerCase(),
    timeframeWeeks,
  };
}
