import { Router, type IRouter } from "express";
import { db, ingredientsTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * Ingredients, from the database.
 *
 * This served a hard-coded array until now, which was survivable while an
 * ingredient was only ever read for display. It stops being survivable once
 * anything computes with one: the allergen filter reads `contains`, scoring
 * reads `benefits`, and generation reads the nutrition columns. A mock list
 * would have had none of them, so a build would have been checked against a
 * shape that has no allergens in it and passed.
 */
router.get("/ingredients", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ingredientsTable);
  res.json(rows);
});

export default router;
