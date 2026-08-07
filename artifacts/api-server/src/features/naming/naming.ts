/**
 * Naming a drink, and drafting the story that goes with it.
 *
 * This replaces the `testname:llm` placeholder. Everything downstream — the
 * slug, the history, publishing — was built and tested against a fixed string
 * on purpose, so this is the last thing to arrive and the only thing that has
 * to change.
 *
 * Two jobs, one call: a short name and a couple of sentences that pre-fill the
 * publish form. The user edits both, so this is a first draft rather than a
 * decision — which is the only reason a model is allowed near copy that ends
 * up on a public board with someone's name on it.
 *
 *
 * What it may not say
 *
 * The same rule as the goal copy, and it is stricter here because this text is
 * free-form. A name and a story describe a drink: what is in it, what it
 * tastes like, when someone might have it. They do not claim it does anything
 * to a body. The goal cards carry nutrient function claims because those hang
 * on a named nutrient in a published register; a model inventing "boosts your
 * metabolism" for a smoothie has nothing behind it, and it would appear on a
 * community wall as if the app had said it.
 *
 * The prompt forbids it and `sanitise` drops anything that gets through, since
 * a prompt is a request and this is a rule.
 */

import type { Pick } from "../generation/index.ts";

export interface NamingInput {
  picks: Pick[];
  goal: string;
  /** Sub-goals, if any — they are what makes one drink differ from another. */
  subGoals: string[];
  preset: string;
}

export interface NamingResult {
  name: string;
  story: string;
  /** Which provider wrote this: "groq" or "fallback". */
  writtenBy: string;
}

/**
 * Words that turn a description into a claim about a body.
 *
 * Deliberately blunt. A false positive costs a slightly duller sentence; a
 * false negative puts an unfounded health claim on a public page under a real
 * person's name. The asymmetry is the whole design.
 */
const CLAIM_WORDS = new RegExp(
  [
    // Disease language. The line neither regime lets anyone cross.
    String.raw`\b(?:cure|cures|cured|curing|treat|treats|treated|heal|heals|healing|prevent|prevents|preventing|remedy|therapeutic|medicinal|clinically|doctor[-\s]?recommended)\b`,
    String.raw`\bdetoxif\w*\b`,
    // Fat burning, in either order. "burns fat" and "fat burner" are the same
    // claim and a rule that catches one is not a rule.
    String.raw`\bburn\w*\s+(?:your\s+)?fat\b`,
    String.raw`\bfat[-\s]?burn\w*\b`,
    // Boosting something about the drinker. The optional "your" is not
    // optional in practice — it is how people actually write it.
    String.raw`\bboost\w*\s+(?:your\s+)?(?:metabolism|immunity|immune\s+system)\b`,
    String.raw`\b(?:metabolism|immunity|immune\s+system)[-\s]boost\w*\b`,
    String.raw`\bweight[-\s]loss\b`,
    String.raw`\blos\w+\s+weight\b`,
    String.raw`\banti[-\s]?ag\w*\b`,
  ].join("|"),
  "i",
);

const MAX_NAME = 40;
const MAX_STORY = 320;

/** Trims, collapses whitespace, strips quotes a model wrapped around it. */
function tidy(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim().replace(/\s+/g, " ").replace(/^["'“”]+|["'“”]+$/g, "");
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Drops sentences that make health claims, keeping the rest.
 *
 * Sentence-level rather than all-or-nothing: a story that is three good
 * sentences and one overreaching one should lose the one, not become empty.
 * If nothing survives, the caller falls back to a written line.
 */
export function sanitiseStory(story: string): string {
  const sentences = story.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const kept = sentences.filter((s) => !CLAIM_WORDS.test(s));
  return kept.join(" ").trim();
}

export const makesClaim = (text: string): boolean => CLAIM_WORDS.test(text);

/**
 * A name and story with no model involved.
 *
 * Not a stub — it is what runs with no API key, and what runs when the call
 * fails. Naming a drink after what is in it is a real convention, so the
 * output is plain rather than wrong: someone who never configures a key still
 * gets something they can publish.
 */
export function fallbackNaming(input: NamingInput): NamingResult {
  const notable = input.picks.filter((p) => p.slot !== "liquid").map((p) => p.name);
  const [first, second] = notable.length >= 2 ? notable : input.picks.map((p) => p.name);

  const name = first && second ? `${first} & ${second}` : (first ?? "House Blend");
  const list = input.picks.map((p) => p.name.toLowerCase()).join(", ");

  return {
    name: tidy(name, MAX_NAME),
    story: tidy(`Built around ${input.goal.replace(/-/g, " ")}, with ${list}.`, MAX_STORY),
    writtenBy: "fallback",
  };
}

export const NAMING_SYSTEM = [
  "You name smoothies and write a short note about them, for a community recipe board.",
  "",
  "The person who made the drink will edit what you write before it is posted, so this is a",
  "first draft in their voice, not a finished caption.",
  "",
  "Rules:",
  "- The name is two to four words. No punctuation beyond an ampersand. Not a sentence.",
  "- The story is two or three short sentences: what is in it, how it tastes, when you would",
  "  have it. Warm and plain. No exclamation marks.",
  "- Say nothing about what the drink does to a body. No claims about health, metabolism,",
  "  immunity, weight, ageing, detoxing, curing, treating or preventing anything. Describe the",
  "  glass, not the drinker.",
  "- Invent no ingredient that is not listed, and no quantity.",
  '- Respond as JSON: {"name": "...", "story": "..."}',
].join("\n");

export function namingPrompt(input: NamingInput): string {
  const lines = input.picks.map((p) => `  - ${p.name} (${p.grams}${p.slot === "liquid" ? "ml" : "g"})`);
  return [
    `Goal: ${input.goal.replace(/-/g, " ")}`,
    input.subGoals.length > 0 ? `Also for: ${input.subGoals.map((g) => g.replace(/-/g, " ")).join(", ")}` : "",
    `Style: ${input.preset}`,
    "Ingredients:",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Applies the rules to whatever came back, whoever wrote it.
 *
 * Shared by the model path and the fallback so both are held to the same
 * limits — a fallback that could exceed the length cap would be a second set
 * of rules nobody remembers exists.
 */
export function adaptNaming(
  raw: { name?: unknown; story?: unknown },
  input: NamingInput,
  writtenBy: string,
): NamingResult {
  const fallback = fallbackNaming(input);

  const name = tidy(raw.name, MAX_NAME);
  const story = tidy(sanitiseStory(tidy(raw.story, MAX_STORY * 2)), MAX_STORY);

  return {
    // A name that makes a claim is replaced outright rather than trimmed —
    // there is no sentence to drop from two words.
    name: name && !makesClaim(name) ? name : fallback.name,
    story: story || fallback.story,
    writtenBy: name && story ? writtenBy : `${writtenBy} (partly fallback)`,
  };
}
