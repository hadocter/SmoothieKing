import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ingredientsTable, userProfilesTable } from "@workspace/db";
import { optionalAuth, type AuthenticatedRequest } from "../../middlewares/auth.ts";
import { checkRecipe, constraintsFrom, type CheckableIngredient } from "./safety.ts";

const router: IRouter = Router();

/**
 * Check a set of ingredients against the caller's stated allergies.
 *
 *   POST /api/safety/verify  { ingredients: [{ name }], vegan?: boolean }
 *
 * This is what the final build screen shows happening. The response is the
 * per-ingredient trail the check actually produced — not a summary of it, and
 * not a separate pass computed for display. The screen animates the same
 * verdicts the server would filter on, so what the user watches is the
 * decision rather than a dramatisation of one made elsewhere.
 *
 * It is deterministic and involves no model: ids compared against ids, same
 * inputs, same verdict, every time. That is the property worth showing someone
 * who has told us they cannot eat something.
 */
router.post("/safety/verify", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const ingredients = Array.isArray(body.ingredients) ? body.ingredients : [];

  if (ingredients.length === 0) {
    res.status(400).json({ error: "ingredients is required" });
    return;
  }

  const [profile] = req.user
    ? await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, req.user.userId))
        .limit(1)
    : [];

  // Query parameters can override, same as matching, so the flow is testable
  // without an account. A profile is the normal source.
  const allergies = Array.isArray(body.allergies)
    ? (body.allergies as string[])
    : profile?.allergies ?? [];

  const catalog: CheckableIngredient[] = await db
    .select({
      name: ingredientsTable.name,
      benefits: ingredientsTable.benefits,
      proteinG: ingredientsTable.proteinG,
      servingGrams: ingredientsTable.servingGrams,
      contains: ingredientsTable.contains,
      animal: ingredientsTable.animal,
    })
    .from(ingredientsTable);

  const constraints = constraintsFrom({ allergies }, catalog, { vegan: body.vegan === true });
  const report = checkRecipe(ingredients, catalog, constraints);

  res.json({
    // Empty when nothing was stated. The screen uses this to decide whether
    // there is anything to show at all — a verification scene for someone with
    // no allergies is theatre.
    checkedAgainst: {
      allergens: constraints.allergenIds,
      excludedNames: constraints.excludedNames,
      vegan: constraints.vegan,
    },
    ...report,
  });
});

export default router;
