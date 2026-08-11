import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  goalPeriodsTable,
  userProfilesTable,
  shelfMarksTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/auth.ts";
import { loadCatalog } from "../catalog/index.ts";
import { daysElapsed } from "../goals/goals.ts";
import type { BuildProfile } from "../generation/index.ts";
import { weekShelf, weekIndexOf, weekSeed, isShelfState, type ShelfState } from "./shelf.ts";
import { substitutesFor } from "./substitute.ts";
import { constraintsFrom } from "../safety/index.ts";

const router: IRouter = Router();

/** The active period, or nothing. A shelf without a goal has nothing to stock. */
async function activePeriod(userId: number) {
  const [period] = await db
    .select()
    .from(goalPeriodsTable)
    .where(and(eq(goalPeriodsTable.userId, userId), eq(goalPeriodsTable.active, true)))
    .limit(1);
  return period;
}

async function profileFor(userId: number) {
  const [profile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  return profile;
}

const buildProfileOf = (
  goal: string,
  subGoals: string[],
  profile: { tastePreference: string[] | null; allergies: string[] | null; dislikedIngredients: string[] | null } | undefined,
): BuildProfile => ({
  primaryGoal: goal,
  secondaryGoals: subGoals,
  tastePreference: profile?.tastePreference ?? [],
  allergies: profile?.allergies ?? [],
  dislikedIngredients: profile?.dislikedIngredients ?? [],
});

/**
 * This week's list, with whatever the user has already said about each item.
 *
 *   GET /api/shelf/week
 *
 * The list is computed rather than stored. Storing it would mean deciding what
 * happens when the catalog changes underneath a saved list, and recomputing is
 * cheap and deterministic — the seed is fixed by the period and the week
 * number, so the same week always produces the same list and next week
 * produces a different one.
 */
router.get("/shelf/week", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const period = await activePeriod(userId);

  if (!period) {
    // Not an error. Someone between goals has no week to stock for, and the
    // screen says so rather than showing an empty list that looks broken.
    res.json({ active: false, weekIndex: null, items: [], drinksPossible: 0 });
    return;
  }

  const profile = await profileFor(userId);
  const catalog = await loadCatalog();
  const elapsed = daysElapsed(period.startedAt);
  const weekIndex = weekIndexOf(elapsed);

  const shelf = weekShelf(buildProfileOf(period.goal, period.subGoals, profile), catalog, {
    seedBase: weekSeed(period.id, weekIndex),
  });

  const marks = await db
    .select()
    .from(shelfMarksTable)
    .where(
      and(
        eq(shelfMarksTable.userId, userId),
        eq(shelfMarksTable.goalPeriodId, period.id),
        eq(shelfMarksTable.weekIndex, weekIndex),
      ),
    );

  const stateOf = new Map(marks.map((m) => [m.ingredient, m.state as ShelfState]));

  res.json({
    active: true,
    goal: period.goal,
    weekIndex,
    weeksTotal: period.weeks,
    /** Days until this week's list is replaced. */
    daysLeftInWeek: 7 - (elapsed % 7),
    drinksPossible: shelf.drinksPossible,
    sampled: shelf.sampled,
    items: shelf.items.map((i) => ({ ...i, state: stateOf.get(i.name) ?? null })),
  });
});

/**
 * Say something about one ingredient this week.
 *
 *   POST /api/shelf/mark  { ingredient, state }
 *
 * Upserted on the week key: marking again is a change of mind, not a second
 * opinion. Passing `null` clears the mark, because "I have not decided" is a
 * state someone can return to and is not the same as skipping.
 */
router.post("/shelf/mark", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const ingredient = typeof body.ingredient === "string" ? body.ingredient.trim() : "";

  if (!ingredient) {
    res.status(400).json({ error: "Tell us which ingredient." });
    return;
  }
  if (body.state !== null && !isShelfState(body.state)) {
    res.status(400).json({ error: "That isn't one of the three answers." });
    return;
  }

  const userId = req.user!.userId;
  const period = await activePeriod(userId);
  if (!period) {
    res.status(409).json({ error: "There's no goal running, so there's no week to stock." });
    return;
  }

  const weekIndex = weekIndexOf(daysElapsed(period.startedAt));
  const where = and(
    eq(shelfMarksTable.userId, userId),
    eq(shelfMarksTable.goalPeriodId, period.id),
    eq(shelfMarksTable.weekIndex, weekIndex),
    eq(shelfMarksTable.ingredient, ingredient),
  );

  if (body.state === null) {
    await db.delete(shelfMarksTable).where(where);
    res.json({ ingredient, state: null });
    return;
  }

  await db
    .insert(shelfMarksTable)
    .values({
      userId,
      goalPeriodId: period.id,
      weekIndex,
      ingredient,
      state: body.state,
    })
    .onConflictDoUpdate({
      target: [
        shelfMarksTable.userId,
        shelfMarksTable.goalPeriodId,
        shelfMarksTable.weekIndex,
        shelfMarksTable.ingredient,
      ],
      set: { state: body.state, updatedAt: new Date() },
    });

  res.json({ ingredient, state: body.state, weekIndex });
});

/**
 * What could stand in for an ingredient.
 *
 *   GET /api/shelf/substitutes?ingredient=Lemon%20juice
 *
 * Filtered by the caller's own allergens, so the list is offerable rather than
 * merely plausible — the same "offered equals enforceable" rule the allergen
 * picker follows.
 */
router.get("/shelf/substitutes", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = req.query.ingredient;
  const ingredient = typeof raw === "string" ? raw : Array.isArray(raw) ? String(raw[0]) : "";
  if (!ingredient) {
    res.status(400).json({ error: "Tell us which ingredient." });
    return;
  }

  const profile = await profileFor(req.user!.userId);
  const catalog = await loadCatalog();

  const constraints = constraintsFrom(
    { allergies: profile?.allergies ?? [] },
    catalog,
    { vegan: false },
  );

  const options = substitutesFor(ingredient, catalog, {
    excludedAllergens: constraints.allergenIds,
    excludedNames: [...constraints.excludedNames, ...(profile?.dislikedIngredients ?? [])],
  });

  res.json({
    ingredient,
    options,
    // Said plainly. The one protein with no allergen tag has no stand-in for
    // someone avoiding both dairy and soy, and an empty list with no
    // explanation reads as a bug rather than as a fact about the shelf.
    note:
      options.length === 0
        ? "Nothing on our shelf can stand in for this one without bringing something you avoid."
        : null,
  });
});

export default router;
