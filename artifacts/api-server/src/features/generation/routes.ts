import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, recipesTable, userProfilesTable, shelfMarksTable, type Recipe } from "@workspace/db";
import { optionalAuth, type AuthenticatedRequest } from "../../middlewares/auth.ts";
import { GOALS, GOAL_MATCH_THRESHOLD, MAX_OFFERED } from "../scoring/index.ts";
import { loadCatalog } from "../catalog/index.ts";
import { scoresOf } from "../recommendation/index.ts";
import { PRESETS, type BuildProfile, type Preset } from "./builder.ts";
import { generateBatch, applyNaming, presentation, DEFAULT_BATCH } from "./generate.ts";
import { weekIndexOf, skippedFrom } from "../shelf/index.ts";
import { daysElapsed } from "../goals/goals.ts";
import { activeGoalPeriod } from "../goals/active.ts";

const router: IRouter = Router();

/** Hard ceiling, so a request cannot ask the server to build unboundedly. */
const MAX_BATCH = 20;

/**
 * Reads a build profile from the request body, falling back to the stored one.
 *
 * Pulled out because the precedence — body over profile, field by field — is
 * the kind of thing that quietly stops being uniform once it is inlined among
 * a dozen other lines in a handler.
 */
function buildProfileFrom(
  body: Record<string, unknown>,
  goal: string,
  profile: { secondaryGoals: string[]; tastePreference: string[]; allergies: string[]; dislikedIngredients: string[] } | undefined,
): BuildProfile {
  const list = (key: string, fallback: string[] | undefined): string[] =>
    Array.isArray(body[key]) ? (body[key] as string[]) : fallback ?? [];

  return {
    primaryGoal: goal,
    secondaryGoals: list("secondaryGoals", profile?.secondaryGoals),
    tastePreference: list("tastePreference", profile?.tastePreference),
    allergies: list("allergies", profile?.allergies),
    dislikedIngredients: list("dislikedIngredients", profile?.dislikedIngredients),
    vegan: body.vegan === true,
  };
}

/** Ingredients the caller has refused for the current week, if any. */
async function skippedThisWeek(userId: number | undefined): Promise<string[]> {
  if (userId === undefined) return [];

  const period = await activeGoalPeriod(userId);
  if (!period) return [];

  const marks = await db
    .select({ ingredient: shelfMarksTable.ingredient, state: shelfMarksTable.state })
    .from(shelfMarksTable)
    .where(
      and(
        eq(shelfMarksTable.userId, userId),
        eq(shelfMarksTable.goalPeriodId, period.id),
        eq(shelfMarksTable.weekIndex, weekIndexOf(daysElapsed(period.startedAt))),
      ),
    );

  return skippedFrom(marks);
}

/**
 * Generate a batch of new recipes for a profile.
 *
 *   POST /api/recipes/generate  { goal?, preset?, count?, seedBase? }
 *
 * A POST because it writes. The intended flow is match first, then come here
 * when nothing fits or when the user wants something new anyway — keeping the
 * two apart means the search stays a cacheable GET and generation stays an
 * explicit act.
 *
 * Must be registered before the `/recipes/:id` route. See routes/index.ts.
 */
router.post("/recipes/generate", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const [profile] = req.user
    ? await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, req.user.userId))
        .limit(1)
    : [];

  const goal = typeof body.goal === "string" ? body.goal : profile?.primaryGoal ?? "";
  if (!GOALS.includes(goal as (typeof GOALS)[number])) {
    res.status(400).json({ error: `goal must be one of: ${GOALS.join(", ")}` });
    return;
  }

  const preset = PRESETS.some((p) => p.id === body.preset) ? (body.preset as Preset) : "great";
  const count = Math.min(
    typeof body.count === "number" && body.count > 0 ? Math.floor(body.count) : DEFAULT_BATCH,
    MAX_BATCH,
  );
  const seedBase = typeof body.seedBase === "number" ? Math.floor(body.seedBase) : Date.now() % 100000;

  const catalog = await loadCatalog();
  const buildProfile = buildProfileFrom(body, goal, profile);

  /**
   * Anything refused on this week's shelf is built around, not built with.
   *
   * Folded into the disliked list rather than given its own channel: the
   * builder already excludes those at every step and the allergen trail
   * already expects them to be absent. Refusing an ingredient for a week and
   * disliking it are the same instruction to a build, arrived at differently.
   *
   * Only `skipping`. Someone who marked an ingredient as one they are going to
   * buy should still be offered drinks that use it — the list is a plan, and
   * building around the plan would make the plan pointless.
   */
  const skipped = await skippedThisWeek(req.user?.userId);
  if (skipped.length > 0) {
    buildProfile.dislikedIngredients = [...buildProfile.dislikedIngredients, ...skipped];
  }
  const built = generateBatch(buildProfile, catalog, { preset, count, seedBase });

  // Named after building, and only what is worth offering — see applyNaming.
  const batch = (await applyNaming(built.slice(0, MAX_OFFERED), buildProfile, preset))
    .concat(built.slice(MAX_OFFERED))
    .map((d) => d);

  if (batch.length === 0) {
    // Reached when the constraints leave nothing to build with — every liquid
    // excluded, say. Said plainly rather than returned as an empty success,
    // which would read as "no good options" instead of "no options".
    res.status(422).json({
      error: "Nothing could be built from the catalog under these constraints",
      goal,
      preset,
    });
    return;
  }

  const rows = batch.map(({ recipe }) => ({ ...recipe, createdByUserId: req.user?.userId ?? null }));

  // Same drink, same slug: a batch often rediscovers a build from a different
  // seed, and two rows for one recipe would be two entries in a history that
  // only happened once.
  await db.insert(recipesTable).values(rows as never).onConflictDoNothing({
    target: recipesTable.slug,
  });

  const stored = await db
    .select()
    .from(recipesTable)
    .where(inArray(recipesTable.slug, batch.map((d) => d.recipe.slug)));

  const bySlug = new Map(stored.map((r) => [r.slug, r]));
  const look = new Map(batch.map((d) => [d.recipe.slug, presentation(d, catalog)]));
  const ordered = batch
    .map((d) => bySlug.get(d.recipe.slug))
    .filter((r): r is Recipe => r !== undefined);

  const above = ordered.filter((r) => (scoresOf(r)[goal] ?? 0) >= GOAL_MATCH_THRESHOLD);

  res.json({
    goal,
    preset,
    threshold: GOAL_MATCH_THRESHOLD,
    // Everything built and saved, against what is worth offering. The gap is
    // the honest part: a batch of ten with two that fit should not look like a
    // batch of two.
    generatedCount: ordered.length,
    matchCount: above.length,
    recipes: above.slice(0, MAX_OFFERED).map((r) => ({
      ...r,
      matchScore: scoresOf(r)[goal] ?? 0,
      // Derived from the drink's own ingredients, so a card looks like what is
      // in it and a published recipe has something to show without a photo.
      ...look.get(r.slug),
    })),
  });
});

export default router;
