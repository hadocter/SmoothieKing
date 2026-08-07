import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, favoritesTable } from "@workspace/db";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "../middlewares/auth.ts";
import { AddFavoriteBody, RemoveFavoriteParams } from "@workspace/api-zod";

const router: IRouter = Router();

/** Stale token pointing at a deleted user — ask the client to log in again. */
function isForeignKeyViolation(err: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code(err) === "23503" || code((err as { cause?: unknown })?.cause) === "23503";
}

// GET /favorites — the caller's favorited recipe IDs.
// Signed-out visitors get an empty list rather than a 401, so recipe browsing
// still works without an account.
router.get("/favorites", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.json([]);
      return;
    }

    const rows = await db
      .select({ recipeId: favoritesTable.recipeId })
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, req.user.userId));

    res.json(rows.map((r) => r.recipeId));
  } catch (err) {
    console.error("ListFavorites error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /favorites
router.post("/favorites", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const parsed = AddFavoriteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Favoriting the same recipe twice is a no-op, not an error.
    await db
      .insert(favoritesTable)
      .values({ userId: req.user!.userId, recipeId: parsed.data.recipeId })
      .onConflictDoNothing();

    res.status(201).json({});
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      res.status(401).json({ error: "Session is no longer valid. Please log in again." });
      return;
    }
    console.error("AddFavorite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /favorites/:recipeId
router.delete("/favorites/:recipeId", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.recipeId) ? req.params.recipeId[0] : req.params.recipeId;
    const params = RemoveFavoriteParams.safeParse({ recipeId: raw });
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await db
      .delete(favoritesTable)
      .where(
        and(
          eq(favoritesTable.userId, req.user!.userId),
          eq(favoritesTable.recipeId, params.data.recipeId),
        ),
      );

    res.sendStatus(204);
  } catch (err) {
    console.error("RemoveFavorite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
