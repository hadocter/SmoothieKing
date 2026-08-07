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
  constructor(readonly status: number) {
    super(`Request failed with ${status}`);
  }
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

  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}
