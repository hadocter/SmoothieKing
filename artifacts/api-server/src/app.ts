import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.ts";
import { logger } from "./lib/logger.ts";

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

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
