import { test } from "node:test";
import assert from "node:assert/strict";
import { explain, type Invalidated, type Issue } from "./validation.ts";

/**
 * The property worth holding: nothing reaching `error` is a serialised object.
 *
 * That is the defect this replaced. Someone typing an address without a dot in
 * it got the issue array itself, in a red box, on the signup screen. The first
 * fixture below is that exact payload, transcribed from the screenshot.
 *
 * Issues are built by hand rather than parsed out of a schema: `explain` reads
 * only `error.issues`, and `@workspace/api-zod` re-exports without a file
 * extension, so it cannot be imported by Node at runtime. Building them here
 * also reaches codes the generated schemas never produce.
 */

const readsAsProse = (s: string) =>
  !s.trim().startsWith("[") && !s.trim().startsWith("{") && !s.includes('"code"');

const of = (...issues: unknown[]) => explain({ issues } as unknown as Invalidated);

/** The payload that actually reached a user. */
const INVALID_EMAIL: Issue = {
  validation: "email",
  code: "invalid_string",
  message: "Invalid email",
  path: ["email"],
} as unknown as Issue;

const required = (field: string) =>
  ({
    code: "invalid_type",
    expected: "string",
    received: "undefined",
    path: [field],
    message: "Required",
  }) as unknown as Issue;

const tooShort = (field: string, minimum: number) =>
  ({
    code: "too_small",
    minimum,
    type: "string",
    inclusive: true,
    path: [field],
    message: "",
  }) as unknown as Issue;

test("the payload from the signup screen becomes a sentence", () => {
  const { error } = of(INVALID_EMAIL);
  assert.ok(readsAsProse(error), error);
  assert.match(error, /^Email /);
  // Says what is expected, not only that something is wrong — otherwise
  // someone retypes the same address and gets the same rejection.
  assert.match(error, /name@example\.com/);
  assert.ok(error.trim().endsWith("."), error);
});

test("a missing field reads as required, not as a type mismatch", () => {
  const { error } = of(required("email"));
  assert.equal(error, "Email is required.");
  assert.ok(!/undefined|invalid_type|string/.test(error), error);
});

test("a short password says how many characters", () => {
  const { error } = of(tooShort("password", 6));
  assert.match(error, /at least 6 characters/);
});

test("an empty string says empty, not 'at least 1 characters'", () => {
  const { error } = of(tooShort("nickname", 1));
  assert.match(error, /can't be empty/);
  assert.ok(!/1 characters/.test(error), error);
});

test("several problems are summarised rather than listed forever", () => {
  const { error } = of(INVALID_EMAIL, tooShort("password", 6), tooShort("nickname", 1));
  assert.ok(readsAsProse(error), error);
  assert.match(error, /\(1 more to fix\.\)/);
  assert.ok(error.length < 220, `too long for a toast: ${error}`);
});

test("each field gets its own sentence, for marking the input", () => {
  const { fields } = of(INVALID_EMAIL, tooShort("password", 6), tooShort("nickname", 1));
  assert.deepEqual(Object.keys(fields).sort(), ["email", "nickname", "password"]);
  for (const s of Object.values(fields)) assert.ok(readsAsProse(s), s);
});

test("one field reporting twice does not produce a paragraph about one input", () => {
  const { fields, error } = of(tooShort("nickname", 3), {
    code: "too_big",
    maximum: 4,
    type: "string",
    inclusive: true,
    path: ["nickname"],
    message: "",
  });
  assert.equal(Object.keys(fields).length, 1);
  assert.ok(!error.includes("more to fix"), error);
});

test("camelCase paths are labelled in words", () => {
  const { error } = of({
    code: "invalid_type",
    expected: "array",
    received: "string",
    path: ["dislikedIngredients"],
    message: "",
  });
  assert.match(error, /^Disliked ingredients /);
  assert.ok(!/dislikedIngredients/.test(error), error);
});

test("a nested path is labelled by its own field, not the root", () => {
  const { error } = of({
    code: "invalid_type",
    expected: "string",
    received: "number",
    path: ["ingredients", 0, "name"],
    message: "",
  });
  assert.match(error, /^Name /);
  assert.ok(readsAsProse(error), error);
});

test("an enum lists what is accepted", () => {
  const { error } = of({
    code: "invalid_enum_value",
    options: ["recent", "popular"],
    received: "nope",
    path: ["sort"],
    message: "",
  });
  assert.match(error, /recent, popular/);
});

test("a size rule on an array counts entries, not characters", () => {
  const { error } = of({
    code: "too_small",
    minimum: 1,
    type: "array",
    inclusive: true,
    path: ["ingredients"],
    message: "",
  });
  assert.match(error, /at least one entry/);
  assert.ok(!/character/.test(error), error);
});

test("an unhandled issue code still produces a sentence", () => {
  const { error } = of({ code: "custom", path: ["whatever"], message: "some internal note" });
  assert.ok(readsAsProse(error), error);
  assert.ok(error.trim().endsWith("."), `not a sentence: ${error}`);
  // The library's own note is not passed through — it is written for us.
  assert.ok(!error.includes("some internal note"), error);
});

test("an empty issue list still answers with something readable", () => {
  const { error } = of();
  assert.ok(readsAsProse(error), error);
  assert.ok(error.length > 0);
});

test("no output ever carries a JSON fragment, whatever the issue", () => {
  const codes = [
    INVALID_EMAIL,
    required("email"),
    tooShort("password", 6),
    { code: "invalid_enum_value", options: ["a"], received: "b", path: ["x"], message: "" },
    { code: "unrecognized_keys", keys: ["surprise"], path: [], message: "" },
    { code: "invalid_string", validation: "url", path: ["imageUrl"], message: "" },
    { code: "too_big", maximum: 80, type: "string", inclusive: true, path: ["name"], message: "" },
  ];
  for (const issue of codes) {
    const { error } = of(issue);
    assert.ok(readsAsProse(error), `leaked for ${JSON.stringify(issue)}: ${error}`);
    assert.ok(error.trim().endsWith("."), error);
  }
});
