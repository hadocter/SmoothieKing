import assert from "node:assert/strict";
import { test } from "node:test";
import {
  customFetch,
  setAuthTokenGetter,
  setUnauthorizedHandler,
} from "./custom-fetch.ts";

test("an authenticated 401 clears the registered session once", async () => {
  const originalFetch = globalThis.fetch;
  let signedOut = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "expired" }), { status: 401 });
  setAuthTokenGetter(() => "expired-token");
  setUnauthorizedHandler(() => {
    signedOut += 1;
  });

  try {
    await assert.rejects(customFetch("/api/private"));
    assert.equal(signedOut, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setAuthTokenGetter(null);
    setUnauthorizedHandler(null);
  }
});

test("a public 401 does not change an existing session", async () => {
  const originalFetch = globalThis.fetch;
  let signedOut = 0;
  globalThis.fetch = async () => new Response(null, { status: 401 });
  setAuthTokenGetter(null);
  setUnauthorizedHandler(() => {
    signedOut += 1;
  });

  try {
    await assert.rejects(customFetch("/api/login", { method: "POST" }));
    assert.equal(signedOut, 0);
  } finally {
    globalThis.fetch = originalFetch;
    setUnauthorizedHandler(null);
  }
});
