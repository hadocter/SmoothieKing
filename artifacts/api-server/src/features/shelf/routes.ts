import { Router, type IRouter } from "express";
import { eq, and, gte, desc } from "drizzle-orm";
import {
  db,
  goalPeriodsTable,
  userProfilesTable,
  shelfMarksTable,
  shelfListsTable,
  smoothieLogsTable,
  recipesTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../middlewares/auth.ts";
import { loadCatalog } from "../catalog/index.ts";
import { daysElapsed } from "../goals/goals.ts";
import type { BuildProfile, BuildableIngredient } from "../generation/index.ts";
import { weekShelf, weekIndexOf, weekSeed, isShelfState, type ShelfState } from "./shelf.ts";
import { composition } from "./compose.ts";
import { summarise } from "./summary.ts";
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
 * A chosen list, described the way a computed one is.
 *
 * The screen should not be able to tell which it is looking at beyond the
 * label — the same fields, counted the same way, so a hand-picked week gets
 * the same "these make N drinks" as a computed one.
 */
function storedShelf(names: string[], catalog: BuildableIngredient[]) {
  const report = composition(names, catalog);
  const bySlot = new Map(catalog.map((i) => [i.name.toLowerCase(), i.slot ?? ""]));
  const required = new Set(report.slots.filter((s) => !s.optional).map((s) => s.slot));

  return {
    items: names
      .filter((n) => bySlot.has(n.toLowerCase()))
      .map((n) => {
        const slot = bySlot.get(n.toLowerCase()) ?? "";
        const exact = catalog.find((i) => i.name.toLowerCase() === n.toLowerCase())!;
        return { name: exact.name, slot, usedIn: 0, essential: required.has(slot) };
      }),
    // Nothing was sampled to make this list, and reporting a number would
    // imply otherwise.
    sampled: 0,
    drinksPossible: report.drinksPossible,
  };
}

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

  const [stored] = await db
    .select()
    .from(shelfListsTable)
    .where(
      and(
        eq(shelfListsTable.userId, userId),
        eq(shelfListsTable.goalPeriodId, period.id),
        eq(shelfListsTable.weekIndex, weekIndex),
      ),
    )
    .limit(1);

  const shelf = stored
    ? storedShelf(stored.ingredients, catalog)
    : weekShelf(buildProfileOf(period.goal, period.subGoals, profile), catalog, {
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
    source: stored?.source ?? "computed",
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

/**
 * Everything needed to roll the week over.
 *
 *   GET /api/shelf/week/review
 *
 * What last week's list was, what was drunk against it, and how far the goal
 * has come. One request because the screen asks one question — "another week,
 * then?" — and three round trips to answer it is three chances to render half
 * of it.
 */
router.get("/shelf/week/review", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const period = await activePeriod(userId);
  if (!period) {
    res.json({ active: false });
    return;
  }

  const elapsed = daysElapsed(period.startedAt);
  const weekIndex = weekIndexOf(elapsed);
  const daysSoFar = (elapsed % 7) + 1;

  // Logs since this week began. `drankAt` is the act, not the build.
  const weekStart = new Date(period.startedAt);
  weekStart.setDate(weekStart.getDate() + (weekIndex - 1) * 7);

  const rows = await db
    .select()
    .from(smoothieLogsTable)
    .leftJoin(recipesTable, eq(smoothieLogsTable.recipeId, recipesTable.id))
    .where(and(eq(smoothieLogsTable.userId, userId), gte(smoothieLogsTable.drankAt, weekStart)))
    .orderBy(desc(smoothieLogsTable.drankAt));

  const summary = summarise(
    weekIndex,
    daysSoFar,
    rows.map((r) => ({
      drankAt: r.smoothie_logs.drankAt,
      recipe: r.recipes
        ? {
            id: r.recipes.id,
            name: r.recipes.name,
            drankAt: "",
            calories: r.recipes.calories,
            protein: r.recipes.protein,
            benefits: r.recipes.benefits ?? [],
          }
        : null,
    })),
  );

  // Last week's list, so the rollover can ask what is left of it.
  const previousIndex = Math.max(1, weekIndex - 1);
  const [previous] = await db
    .select()
    .from(shelfListsTable)
    .where(
      and(
        eq(shelfListsTable.userId, userId),
        eq(shelfListsTable.goalPeriodId, period.id),
        eq(shelfListsTable.weekIndex, previousIndex),
      ),
    )
    .limit(1);

  const catalog = await loadCatalog();
  const profile = await profileFor(userId);
  const previousItems = previous
    ? previous.ingredients
    : weekIndex > 1
      ? weekShelf(buildProfileOf(period.goal, period.subGoals, profile), catalog, {
          seedBase: weekSeed(period.id, previousIndex),
        }).items.map((i) => i.name)
      : [];

  res.json({
    active: true,
    goal: period.goal,
    weekIndex,
    weeksTotal: period.weeks,
    daysElapsed: elapsed,
    daysTotal: period.weeks * 7,
    /** True in week one, when there is no previous week to carry anything from. */
    firstWeek: weekIndex === 1,
    previousWeek: { weekIndex: previousIndex, items: previousItems },
    summary,
  });
});

/**
 * Set this week's list explicitly.
 *
 *   POST /api/shelf/week/list  { mode, keep?, ingredients? }
 *
 * Three modes, because there are three decisions a person actually makes at a
 * rollover: keep what I had, build me a new one around what is left, or let me
 * choose. The third is not a fallback for the other two failing — someone who
 * knows their own kitchen should not be stuck with what a frequency count
 * decided, and a screen that only offers "our list or nothing" is the one that
 * makes people stop opening it.
 */
router.post("/shelf/week/list", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const mode = body.mode;
  if (mode !== "carried" && mode !== "rebuilt" && mode !== "manual") {
    res.status(400).json({ error: "Tell us whether to keep, rebuild or choose." });
    return;
  }

  const userId = req.user!.userId;
  const period = await activePeriod(userId);
  if (!period) {
    res.status(409).json({ error: "There's no goal running, so there's no week to stock." });
    return;
  }

  const catalog = await loadCatalog();
  const profile = await profileFor(userId);
  const weekIndex = weekIndexOf(daysElapsed(period.startedAt));
  const keep = Array.isArray(body.keep) ? (body.keep as string[]) : [];

  let ingredients: string[];

  if (mode === "manual") {
    const chosen = Array.isArray(body.ingredients) ? (body.ingredients as string[]) : [];
    const report = composition(chosen, catalog);
    if (!report.buildable) {
      // Refused rather than saved-and-warned. A list that builds nothing is
      // not a shorter week, it is a week with no drinks in it, and finding
      // that out tomorrow morning is finding out too late.
      res.status(422).json({
        error: `That won't build a drink yet — still short on ${report.missing.join(", ")}.`,
        ...report,
      });
      return;
    }
    ingredients = report.slots.length > 0 ? chosen.filter((n) => !report.unknown.includes(n)) : chosen;
  } else if (mode === "carried") {
    ingredients = Array.isArray(body.ingredients) ? (body.ingredients as string[]) : keep;
    if (ingredients.length === 0) {
      res.status(400).json({ error: "There's nothing from last week to carry over." });
      return;
    }
  } else {
    ingredients = weekShelf(buildProfileOf(period.goal, period.subGoals, profile), catalog, {
      seedBase: weekSeed(period.id, weekIndex),
      keep,
    }).items.map((i) => i.name);
  }

  await db
    .insert(shelfListsTable)
    .values({ userId, goalPeriodId: period.id, weekIndex, ingredients, source: mode })
    .onConflictDoUpdate({
      target: [shelfListsTable.userId, shelfListsTable.goalPeriodId, shelfListsTable.weekIndex],
      set: { ingredients, source: mode, createdAt: new Date() },
    });

  // Anything carried over is already in the kitchen, and saying so twice is a
  // question nobody needs asked again.
  for (const name of keep) {
    if (!ingredients.includes(name)) continue;
    await db
      .insert(shelfMarksTable)
      .values({ userId, goalPeriodId: period.id, weekIndex, ingredient: name, state: "have" })
      .onConflictDoUpdate({
        target: [
          shelfMarksTable.userId,
          shelfMarksTable.goalPeriodId,
          shelfMarksTable.weekIndex,
          shelfMarksTable.ingredient,
        ],
        set: { state: "have", updatedAt: new Date() },
      });
  }

  res.status(201).json({ weekIndex, source: mode, ingredients });
});

/**
 * The catalogue, arranged for choosing from.
 *
 *   GET /api/shelf/catalog
 *
 * Grouped by slot and carrying what the skeleton takes from each, so the
 * picker can show someone what a drink still needs while they are picking
 * rather than after they have saved. Allergens are filtered out here, not
 * greyed out in the client: an ingredient offered and then refused is a worse
 * screen than one that was never on it.
 */
router.get("/shelf/catalog", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const profile = await profileFor(req.user!.userId);
  const catalog = await loadCatalog();
  const constraints = constraintsFrom({ allergies: profile?.allergies ?? [] }, catalog, {
    vegan: false,
  });
  const banned = new Set(constraints.allergenIds);

  const allowed = catalog.filter((i) => i.slot !== null && !i.contains.some((a) => banned.has(a)));
  const shape = composition([], catalog).slots;

  res.json({
    slots: shape.map((s) => ({
      slot: s.slot,
      picks: s.picks,
      optional: s.optional,
      ingredients: allowed
        .filter((i) => i.slot === s.slot)
        .map((i) => ({
          name: i.name,
          flavors: i.flavors,
          benefits: i.benefits,
          contains: i.contains,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
  });
});

/**
 * Check a selection without saving it.
 *
 *   POST /api/shelf/compose  { ingredients }
 *
 * The picker calls this as the person selects, so "you still need a base" and
 * "these make 24 drinks" are the server's arithmetic rather than a second
 * implementation in the browser that can drift from it.
 */
router.post("/shelf/compose", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const names = Array.isArray(body.ingredients) ? (body.ingredients as string[]) : [];
  res.json(composition(names, await loadCatalog()));
});

export default router;
