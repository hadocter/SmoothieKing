import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, smoothieLogsTable, recipesTable } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const FEEDBACK = ["too-sweet", "just-right", "not-sweet-enough"];

/**
 * Record that a smoothie was drunk.
 *
 *   POST /api/smoothie-logs  { recipeId, note? }
 *
 * A separate act from generating one. A batch makes ten and a person drinks
 * one; logging at generation time would record nine drinks that never
 * happened, and no amount of later cleverness recovers from a history that is
 * wrong at the point of writing.
 */
router.post("/smoothie-logs", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recipeId = typeof body.recipeId === "number" ? Math.floor(body.recipeId) : NaN;
  if (!Number.isFinite(recipeId)) {
    res.status(400).json({ error: "recipeId is required" });
    return;
  }

  const [recipe] = await db
    .select({ id: recipesTable.id, published: recipesTable.published, owner: recipesTable.createdByUserId })
    .from(recipesTable)
    .where(eq(recipesTable.id, recipeId))
    .limit(1);

  // The same readability rule as GET /recipes/:id. Logging a drink is not a
  // way around it: without this, an id you cannot read is an id you can
  // confirm exists by logging it.
  if (!recipe || !(recipe.published || recipe.owner === req.user!.userId)) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const [log] = await db
    .insert(smoothieLogsTable)
    .values({
      userId: req.user!.userId,
      recipeId,
      note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    })
    .returning();

  res.status(201).json(log);
});

/** The caller's own history, most recent first, with the recipe attached. */
router.get("/smoothie-logs", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const rows = await db
    .select()
    .from(smoothieLogsTable)
    .leftJoin(recipesTable, eq(smoothieLogsTable.recipeId, recipesTable.id))
    .where(eq(smoothieLogsTable.userId, req.user!.userId))
    .orderBy(desc(smoothieLogsTable.drankAt));

  res.json(rows.map((r) => ({ ...r.smoothie_logs, recipe: r.recipes })));
});

/**
 * How a specific glass landed.
 *
 *   POST /api/smoothie-logs/:id/feedback  { sweetness }
 *
 * Attached to a log rather than a recipe, because the question is about one
 * drink on one day. The same recipe can be too sweet in the morning and right
 * in the evening, and averaging that into a property of the recipe throws away
 * the thing that made it useful.
 */
router.post("/smoothie-logs/:id/feedback", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "id must be an integer" });
    return;
  }

  const sweetness = (req.body ?? {}).sweetness;
  if (typeof sweetness !== "string" || !FEEDBACK.includes(sweetness)) {
    res.status(400).json({ error: `sweetness must be one of: ${FEEDBACK.join(", ")}` });
    return;
  }

  const [updated] = await db
    .update(smoothieLogsTable)
    .set({ sweetnessFeedback: sweetness })
    // Ownership is part of the WHERE rather than a check after the fact, so
    // there is no window in which someone else's row is loaded at all.
    .where(and(eq(smoothieLogsTable.id, id), eq(smoothieLogsTable.userId, req.user!.userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  res.json(updated);
});

export default router;
