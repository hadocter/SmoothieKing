import { Router, type IRouter } from "express";
import { loadCatalog } from "./index.ts";
import { catalogStats } from "./stats.ts";
import { allergenClasses } from "../safety/index.ts";

const router: IRouter = Router();

/**
 * What the catalog is, in numbers.
 *
 * Public and unauthenticated: the landing page is the caller, and it is shown
 * to people who have no account. Computed per request rather than cached —
 * this is one query and some arithmetic, and a stale figure is the failure
 * mode the whole endpoint exists to avoid.
 */
router.get("/catalog/stats", async (_req, res): Promise<void> => {
  const catalog = await loadCatalog();
  res.json(catalogStats(catalog, allergenClasses(catalog).length));
});

export default router;
