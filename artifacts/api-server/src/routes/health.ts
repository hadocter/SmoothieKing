import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Answers on every path a host is likely to be pointed at.
 *
 * `/healthz` is the one in the API spec and the only one that existed, which
 * makes a host configured for `/health` — the more common default — mark a
 * perfectly healthy container as failing. That failure is expensive in the
 * wrong way: the deploy looks broken, the logs show a server that started
 * fine, and the fix is in a dashboard rather than in the repository.
 *
 * The aliases cost nothing and mean the answer to "why is the health check
 * red" is never "the path". Registered under the API router, so each is also
 * reachable with the `/api` prefix.
 */
const PATHS = ["/healthz", "/health", "/healthcheck"];

router.get(PATHS, (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
