/**
 * Calling the endpoints the generated client does not cover.
 *
 * Orval generates hooks from the OpenAPI spec; the endpoints added for
 * recommendation, generation, safety, elicitation and logs are not in it yet.
 * Those calls need the same bearer token the generated client attaches, and
 * writing that by hand at each call site is how one of them ends up without
 * it — which already happened once, and produced an allergen check that
 * reported "clear" because it had no profile to check against.
 *
 * So: one function, one place the header is decided.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** The server's own sentence, when it sent one worth showing. */
    readonly friendly: string = messageForStatus(status),
  ) {
    super(friendly);
  }
}

/**
 * The last line between a server's error and somebody's screen.
 *
 * The server is the right place to write these, and it does — but it is not
 * the only thing that can fail, and it has been wrong before. A signup that
 * rejected an address without a dot in it put this in a red box on the form:
 *
 *   [ { "validation": "email", "code": "invalid_string", … } ]
 *
 * because the route handed Zod's serialised issue list straight to `error` and
 * the screen printed whatever arrived. So nothing prints whatever arrives any
 * more. A payload that looks like a serialised object is treated as a bug that
 * reached production rather than as a message, and the status is used instead.
 */
export function looksLikeCode(text: string): boolean {
  const t = text.trim();
  return (
    t.startsWith("{") ||
    t.startsWith("[") ||
    t.startsWith("<") ||
    /"(code|path|validation|issues|expected|received)"\s*:/.test(t) ||
    // A stack trace, or prose long past the point anyone reads it in a toast.
    t.includes("\n    at ") ||
    t.length > 300
  );
}

export function messageForStatus(status: number): string {
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "We couldn't find that.";
  if (status === 409) return "That already exists.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many attempts just now. Give it a moment.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  if (status >= 400) return "Something in that wasn't right. Please check and try again.";
  return "Something went wrong. Please try again.";
}

/**
 * A sentence for a person, from whatever the failure turned out to be.
 *
 * Handles the two shapes that reach a component: an `ApiError` from
 * `apiFetch`, and the generated client's rejection, which carries the parsed
 * body on `data`.
 */
export function errorMessage(err: unknown, fallback?: string): string {
  if (err instanceof ApiError) return err.friendly;

  const e = err as { status?: number; data?: { error?: unknown }; message?: unknown };
  const fromBody = e?.data?.error;
  if (typeof fromBody === "string" && fromBody.trim() && !looksLikeCode(fromBody)) {
    return fromBody;
  }

  if (typeof e?.status === "number") return messageForStatus(e.status);

  // `message` last: on a fetch rejection it is "Failed to fetch", and on a
  // thrown response it can be the raw body.
  if (typeof e?.message === "string" && e.message.trim() && !looksLikeCode(e.message)) {
    return /failed to fetch|networkerror|load failed/i.test(e.message)
      ? "Couldn't reach the server. Check your connection and try again."
      : e.message;
  }

  return fallback ?? "Something went wrong. Please try again.";
}

/**
 * A JSON request carrying the caller's token.
 *
 * The token is passed in rather than read from storage here, so this stays a
 * plain function and components keep getting it from `useAuth()` — the same
 * source the rest of the app uses, and one that updates when the session does.
 */
export async function apiFetch<T>(
  path: string,
  token: string | null,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  if (!res.ok) {
    if (res.status === 401 && token) handleUnauthorized();
    // Read the server's own sentence where there is one. A failure body is not
    // guaranteed to be JSON — an upstream proxy will happily return HTML — so
    // anything unparseable falls through to the status.
    let friendly = messageForStatus(res.status);
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim() && !looksLikeCode(body.error)) {
        friendly = body.error;
      }
    } catch {
      /* keep the status message */
    }
    throw new ApiError(res.status, friendly);
  }
  return (await res.json()) as T;
}
import { handleUnauthorized } from "@workspace/api-client-react";
