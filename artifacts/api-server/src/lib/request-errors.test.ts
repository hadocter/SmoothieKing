import assert from "node:assert/strict";
import { test } from "node:test";
import { isMalformedJsonBody } from "./request-errors.ts";

test("only Express's malformed JSON error is treated as a client parse failure", () => {
  assert.equal(
    isMalformedJsonBody({
      name: "SyntaxError",
      status: 400,
      type: "entity.parse.failed",
      body: "{oops",
    }),
    true,
  );
  assert.equal(isMalformedJsonBody(new SyntaxError("bug in route code")), false);
  assert.equal(isMalformedJsonBody({ status: 500, type: "entity.parse.failed", body: "{oops" }), false);
  assert.equal(isMalformedJsonBody({ status: 400, type: "entity.parse.failed" }), false);
});
