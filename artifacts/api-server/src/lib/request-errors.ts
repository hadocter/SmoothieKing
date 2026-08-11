/**
 * express.json() reports invalid syntax as a body-parser-shaped error rather
 * than a normal route error. Keep the shape check here so the app's boundary
 * maps a malformed client request to 400 without accidentally labelling every
 * SyntaxError in application code as the client's fault.
 */
export function isMalformedJsonBody(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; type?: unknown; body?: unknown };
  return candidate.status === 400 && candidate.type === "entity.parse.failed" && typeof candidate.body === "string";
}
