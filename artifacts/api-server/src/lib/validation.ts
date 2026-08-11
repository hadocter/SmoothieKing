import type { Response } from "express";

/**
 * Turning a failed parse into something a person can act on.
 *
 * Every route used to answer a bad request with `parsed.error.message`, which
 * on Zod is the *serialised issue array*. Someone who typed an email without a
 * dot in it got this, in a red box, on the signup screen:
 *
 *   [ { "validation": "email", "code": "invalid_string",
 *       "message": "Invalid email", "path": [ "email" ] } ]
 *
 * Everything needed to write a useful sentence is in there. It was simply
 * never written — the object was handed to the user instead.
 *
 * So: one place that renders issues as English, and a `fields` map alongside
 * it so a form can eventually mark the offending input without parsing prose
 * back out of the message.
 */

/**
 * A validation issue, described structurally rather than imported.
 *
 * Zod is not a dependency of this package — it arrives through the generated
 * api schemas — and this module has no reason to care which library produced
 * the complaint. A `ZodError` satisfies this shape, and so would anything else
 * that reports a path and a reason.
 */
export interface Issue {
  code: string;
  path: (string | number)[];
  message?: string;
  expected?: unknown;
  received?: unknown;
  validation?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  type?: unknown;
  options?: unknown[];
}

export interface Invalidated {
  issues: Issue[];
}

/** What the user calls the field, where that differs from what the schema does. */
const LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  nickname: "Nickname",
  recipeId: "Recipe",
  imageUrl: "Image link",
  authorName: "Name",
  heightCm: "Height",
  weightKg: "Weight",
  birthYear: "Year of birth",
  activityLevel: "Activity level",
  tastePreference: "Taste preference",
  dislikedIngredients: "Disliked ingredients",
  prepTimeMinutes: "Prep time",
};

/** `dislikedIngredients` → `Disliked ingredients`, for anything not listed above. */
function labelFor(path: (string | number)[]): string {
  const last = [...path].reverse().find((p) => typeof p === "string") as string | undefined;
  if (!last) return "That value";
  if (LABELS[last]) return LABELS[last];
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The reason, as a verb phrase that completes "<Field> …".
 *
 * Says what is wrong *and* what is expected wherever the issue carries it — an
 * email rule that only reports "is invalid" leaves someone retyping the same
 * address, while one that shows the shape ends the problem in one read.
 */
function reasonFor(issue: Issue): string {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null"
        ? "is required"
        : `should be ${withArticle(String(issue.expected))}`;

    case "invalid_string":
      if (issue.validation === "email") return "needs to look like name@example.com";
      if (issue.validation === "url") return "needs to be a full web address, starting with https://";
      if (issue.validation === "uuid") return "is not in the expected format";
      return "contains something we can't accept";

    case "too_small": {
      const n = Number(issue.minimum);
      if (issue.type === "string")
        return n <= 1 ? "can't be empty" : `needs at least ${n} characters`;
      if (issue.type === "array")
        return n <= 1 ? "needs at least one entry" : `needs at least ${n} entries`;
      return `must be ${n} or more`;
    }

    case "too_big": {
      const n = Number(issue.maximum);
      if (issue.type === "string") return `can't be longer than ${n} characters`;
      if (issue.type === "array") return `can't have more than ${n} entries`;
      return `must be ${n} or less`;
    }

    case "invalid_enum_value":
      return `must be one of: ${(issue.options ?? []).join(", ")}`;

    case "unrecognized_keys":
      return "included something we don't recognise";

    default:
      return "isn't valid";
  }
}

const withArticle = (word: string): string =>
  /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;

export interface Explained {
  /** One or two sentences, safe to put straight in front of someone. */
  error: string;
  /** Field name → its own sentence, for marking inputs. */
  fields: Record<string, string>;
}

export function explain(error: Invalidated): Explained {
  const fields: Record<string, string> = {};
  const sentences: string[] = [];

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    // First issue per field wins. Zod can report several for one input and
    // stacking them produces a paragraph about a single text box.
    if (fields[key]) continue;
    const sentence = `${labelFor(issue.path)} ${reasonFor(issue)}.`;
    fields[key] = sentence;
    sentences.push(sentence);
  }

  if (sentences.length === 0) return { error: "Something in that wasn't right.", fields };

  // Two is what fits in a toast and is still worth reading. Beyond that the
  // count is more useful than the list.
  const shown = sentences.slice(0, 2).join(" ");
  const rest = sentences.length - 2;
  return { error: rest > 0 ? `${shown} (${rest} more to fix.)` : shown, fields };
}

/** `if (!parsed.success) return invalid(res, parsed.error);` */
export function invalid(res: Response, error: Invalidated): void {
  res.status(400).json(explain(error));
}
