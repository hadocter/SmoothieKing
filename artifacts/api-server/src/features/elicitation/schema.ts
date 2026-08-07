/**
 * The tool schema the model is called with.
 *
 * One module constant, built once and frozen. It is never assembled per
 * request, and that is a rule rather than a style preference.
 *
 * The tempting alternative is to send only the current step's options as the
 * enum, which would make a wrong-step answer impossible by construction. It
 * also makes the schema a function of request state: the same model output is
 * valid or invalid depending on which step was being asked, cache keys stop
 * meaning anything, and — with Groq, which validates tool arguments
 * server-side — a mismatch on one field rejects the entire call, including the
 * fields that were right. A frozen schema plus a check in our own code loses
 * the grammatical guarantee and gets back the ability to keep the good half of
 * a partly-wrong answer.
 *
 * The trade is real and worth naming: a flat enum over every option is harder
 * for a small model than a four-option one, so the answer rate is lower than a
 * per-request schema would give. That cost is paid in adapt.ts, where a value
 * belonging to the wrong step is dropped rather than repaired.
 */

import { ALL_OPTION_IDS, STEP_KEYS, UNSPECIFIED, OUT_OF_DOMAIN } from "./steps.ts";

type Json = Record<string, unknown>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Sentinels are enum members, not omissions.
 *
 * "The user said nothing about this" is a finding, and a finding has to be
 * sayable. If the only way to express it is to leave the field out, then it
 * arrives looking exactly like a model that forgot to answer, and the two get
 * handled the same way — which means one of them gets handled wrongly.
 */
export const PROPOSE_SCHEMA: Json = deepFreeze({
  type: "object",
  properties: {
    stepKey: {
      type: "string",
      enum: [...STEP_KEYS, UNSPECIFIED],
      description: "Which onboarding step you are answering. Must be the step that was asked.",
    },
    optionIds: {
      type: "array",
      items: { type: "string", enum: [...ALL_OPTION_IDS, UNSPECIFIED, OUT_OF_DOMAIN] },
      description:
        `The option ids the message points to. At most one for a single-choice step. ` +
        `Use ["${UNSPECIFIED}"] when the message says nothing about this step, and ` +
        `["${OUT_OF_DOMAIN}"] when they were clear but no option covers what they said. ` +
        `Never guess an option to avoid returning empty.`,
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "How sure you are that these options are what they meant.",
    },
    message: {
      type: "string",
      description:
        "One short sentence reflecting back what you understood. No health claims, no advice.",
    },
    unmappedText: {
      type: "string",
      description:
        "The part of their message no option can hold, in their own words. Empty if there is none.",
    },
    occasion: {
      type: "string",
      description:
        "The thing they are preparing for, if they named one — a wedding, a marathon, a holiday. " +
        "Two or three words, lower case, in their own language. Empty when they named nothing; " +
        "a goal is not an occasion, so do not turn 'I want better skin' into 'better skin'.",
    },
    timeframeWeeks: {
      type: "string",
      enum: ["4", "6", "8", "12", UNSPECIFIED],
      description:
        `How many weeks away it is, only if they said so out loud — "in six weeks", "by August", ` +
        `"3주 안에". Round to the nearest of the allowed values. Use "${UNSPECIFIED}" when they did ` +
        `not, which is most of the time. Do not infer a deadline from the kind of goal, from ` +
        `urgency, or from what would be reasonable — the caller drops any timeframe whose words ` +
        `are not in the message, so guessing only loses information.`,
    },
  },
  required: ["stepKey", "optionIds", "confidence"],
  additionalProperties: false,
});

export const PROPOSE_SYSTEM = [
  "You map a person's own words onto a fixed list of onboarding options.",
  "",
  "You are proposing, not deciding. Everything you return is shown to the user as a",
  "highlighted suggestion they still have to tap, so a wrong proposal costs them one",
  "correction and a missing one costs them nothing they were not already going to do.",
  "That asymmetry is why guessing is worse than abstaining.",
  "",
  "Rules:",
  `- Only return ids from the step you were asked about. Ids from other steps are dropped.`,
  `- If the message says nothing about this step, return ["${UNSPECIFIED}"].`,
  `- If they were clear but no option covers it, return ["${OUT_OF_DOMAIN}"] and put their`,
  "  words in unmappedText. Do not round it to the nearest available option.",
  "- Do not infer beyond what was said. Someone who mentions the gym has not told you",
  "  their activity level, and someone avoiding milk has not told you they are vegan.",
  "- Never invent a health claim, a diagnosis, or a nutritional recommendation.",
].join("\n");
