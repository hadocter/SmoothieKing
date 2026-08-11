import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.ts";
import { logger } from "./lib/logger.ts";
import { isMalformedJsonBody } from "./lib/request-errors.ts";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// 3mb, not the 100kb default: a published recipe can carry its photo inline as
// a data URL, and the default would reject every upload with a 413 that looks
// like a server fault rather than a size limit. The cap that actually governs
// image size is enforced per-field in the recipes route; this only has to be
// wide enough not to be the thing that rejects first.
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

/**
 * The built web app, in production only.
 *
 * In development vite serves the UI on its own port and proxies `/api` here,
 * so this path does not run and must not: it would shadow the dev server's
 * hot reload with a stale build.
 *
 * In production there is no vite and no proxy — one process serves both. That
 * asymmetry is the single biggest behavioural difference between the two
 * environments, which is why the production image is runnable locally rather
 * than only on the host.
 *
 * `STATIC_DIR` is set by the image. Absent it, this is skipped entirely, so a
 * server started without a build still answers /api instead of 404ing on a
 * directory that is not there.
 */
const staticDir = process.env.STATIC_DIR;
if (staticDir) {
  app.use(express.static(staticDir, { index: false, maxAge: "1h" }));

  // Client-side routing: anything not under /api and not a real file is the
  // app's own route, so it gets index.html and the router sorts it out.
  // Registered after /api so an unknown API path still 404s as an API path
  // rather than silently returning HTML to a fetch.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  // A body the server cannot parse is a bad request, not a server failure.
  // Express routes its own JSON-parser error here before any route sees it.
  if (isMalformedJsonBody(err)) {
    res.status(400).json({ error: "Request body must be valid JSON" });
    return;
  }

  if (res.headersSent) {
    next(err);
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
