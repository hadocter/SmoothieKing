import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, favoritesTable } from "@workspace/db";
import { AddFavoriteBody, RemoveFavoriteParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/favorites", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ recipeId: favoritesTable.recipeId })
    .from(favoritesTable)
    .orderBy(favoritesTable.createdAt);
  res.json(rows.map((r) => r.recipeId));
});

router.post("/favorites", async (req, res): Promise<void> => {
  const parsed = AddFavoriteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db
    .insert(favoritesTable)
    .values({ recipeId: parsed.data.recipeId })
    .onConflictDoNothing();
  res.status(201).json({});
});

router.delete("/favorites/:recipeId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.recipeId) ? req.params.recipeId[0] : req.params.recipeId;
  const params = RemoveFavoriteParams.safeParse({ recipeId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(favoritesTable)
    .where(eq(favoritesTable.recipeId, params.data.recipeId));
  res.sendStatus(204);
});

export default router;
