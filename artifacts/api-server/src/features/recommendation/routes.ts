import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, recipesTable, userProfilesTable } from "@workspace/db";
import { optionalAuth, type AuthenticatedRequest } from "../../middlewares/auth.ts";
import { GOALS, GOAL_MATCH_THRESHOLD } from "../scoring/index.ts";
import { constraintsFrom } from "../safety/index.ts";
import { loadCatalog } from "../catalog/index.ts";
import { matchRecipes, offer, scoresOf } from "./matching.ts";

const router: IRouter = Router();

/**
 * Recipes that fit a goal and are safe for the caller.
 *
 *   GET /api/recipes/match?goal=gut-health[&allergies=Dairy,Tree%20Nuts][&vegan=true]
 *
 * Allergies come from the signed-in user's profile. The query parameters
 * override them, so the flow can be exercised without an account and a one-off
 * constraint does not have to be saved to a profile to take effect.
 *
 * Must be registered before the `/recipes/:id` route. See routes/index.ts.
 */
router.get("/recipes/match", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const goal = typeof req.query.goal === "string" ? req.query.goal : "";
  if (!GOALS.includes(goal as (typeof GOALS)[number])) {
    res.status(400).json({ error: `goal must be one of: ${GOALS.join(", ")}` });
    return;
  }

  const [profile] = req.user
    ? await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, req.user.userId))
        .limit(1)
    : [];

  const override = typeof req.query.allergies === "string" ? req.query.allergies : null;
  const allergies =
    override !== null
      ? override.split(",").map((a) => a.trim()).filter(Boolean)
      : profile?.allergies ?? [];

  const catalog = await loadCatalog();
  const constraints = constraintsFrom({ allergies }, catalog, { vegan: req.query.vegan === "true" });

  const rows = await db.select().from(recipesTable).where(eq(recipesTable.published, true));
  const { ranked, blockedBySafety } = matchRecipes(rows, goal, catalog, constraints);
  const { shown, total } = offer(ranked);

  res.json({
    goal,
    threshold: GOAL_MATCH_THRESHOLD,
    matchCount: total,
    blockedBySafety,
    // Reported so the client can be honest that a stated allergy could not be
    // enforced, rather than showing a clean result that implies it was.
    unenforceableAllergies: constraints.unresolved,
    recipes: shown.map(({ recipe, score }) => ({ ...recipe, matchScore: score })),
  });
});

export default router;
