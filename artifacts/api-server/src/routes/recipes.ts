import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, recipesTable, ingredientsTable, userProfilesTable, type Recipe } from "@workspace/db";
import { ListRecipesQueryParams, GetRecipeParams } from "@workspace/api-zod";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  GOALS,
  GOAL_MATCH_THRESHOLD,
  MAX_OFFERED,
  type GoalScores,
} from "../lib/scoring";
import { checkRecipe, constraintsFrom } from "../lib/safety";
import { PRESETS, type BuildProfile, type BuildableIngredient, type Preset } from "../lib/builder";
import { generateBatch, DEFAULT_BATCH } from "../lib/generate";

const router: IRouter = Router();

/**
 * These routes served a hard-coded MOCK_RECIPES array of four. The database
 * has eight — the mock had drifted, so half the catalog was unreachable from
 * the app while sitting in Postgres the whole time. Everything below reads the
 * table.
 */

/**
 * Just the columns safety, scoring and building need.
 *
 * A `BuildableIngredient` is a `CheckableIngredient` plus what it costs and
 * where it goes, so one query serves all three and they cannot end up looking
 * at different versions of the catalog within a request.
 */
async function loadCatalog(): Promise<BuildableIngredient[]> {
  return db
    .select({
      name: ingredientsTable.name,
      benefits: ingredientsTable.benefits,
      proteinG: ingredientsTable.proteinG,
      servingGrams: ingredientsTable.servingGrams,
      contains: ingredientsTable.contains,
      animal: ingredientsTable.animal,
      slot: ingredientsTable.slot,
      hex: ingredientsTable.hex,
      flavors: ingredientsTable.flavors,
      kcal: ingredientsTable.kcal,
    })
    .from(ingredientsTable);
}

function scoresOf(recipe: Recipe): GoalScores {
  const raw = recipe.goalScores;
  return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as GoalScores) : {};
}

/** Only published recipes are visible on the browsing routes. */
const visible = eq(recipesTable.published, true);

router.get("/recipes/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(recipesTable)
    .where(and(visible, eq(recipesTable.isFeatured, true)));
  res.json(rows);
});

/**
 * Goal ids to the copy shown above each group.
 *
 * Duplicated from the web app's GOAL_LABELS, which is not ideal — but the two
 * new goals had no descriptions written for them and inventing marketing copy
 * on the server would be the wrong place to do it. Both new entries are stated
 * plainly and can be rewritten by whoever owns the voice.
 */
const BENEFIT_COPY: Record<string, { label: string; description: string }> = {
  "glowy-skin": { label: "Glowy Skin", description: "K-beauty inspired collagen & antioxidant blends." },
  "hydration": { label: "Deep Hydration", description: "Replenish moisture at a cellular level." },
  "sun-ritual": { label: "Sun Ritual", description: "Natural lycopene & beta-carotene UV defense." },
  "protein-power": { label: "Protein & Power", description: "High-performance muscle recovery." },
  "anti-inflammatory": { label: "Anti-Inflammatory", description: "Curcumin & adaptogen calming blends." },
  "detox-clarity": { label: "Detox & Clarity", description: "Chlorophyll-dense system reset." },
  "gut-health": { label: "Gut Health", description: "Fermented and fibre-rich blends for digestion." },
  "energy-focus": { label: "Energy & Focus", description: "Caffeine and adaptogens for sustained attention." },
};

router.get("/recipes/by-benefit", async (_req, res): Promise<void> => {
  const rows = await db.select().from(recipesTable).where(visible);

  const groups = GOALS.map((benefit) => {
    const copy = BENEFIT_COPY[benefit];
    return {
      benefit,
      label: copy.label,
      description: copy.description,
      // Grouped on the editorial `benefits` tags, deliberately. This is the
      // browsing view — it should show what a recipe was written to be, not
      // what a scoring function computed about it. Matching is the route that
      // uses scores.
      recipes: rows.filter((r) => r.benefits.includes(benefit)),
    };
  }).filter((g) => g.recipes.length > 0);

  res.json(groups);
});

/**
 * Recipes that fit a goal, safe for whoever is asking.
 *
 *   GET /api/recipes/match?goal=gut-health[&allergies=Dairy,Tree%20Nuts][&vegan=true]
 *
 * Order of operations matters and is fixed: safety filters first, then the
 * goal threshold, then ranking. Filtering on fit first and checking safety
 * afterwards would produce the same list here, but it makes safety a property
 * of the presentation rather than of the set — and the moment anything caches
 * or paginates the ranked list, an unsafe recipe is in it.
 *
 * Allergies come from the signed-in user's profile. The query parameters
 * override them, so the flow can be exercised without an account and so a
 * one-off constraint does not have to be saved to a profile to take effect.
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
  const constraints = constraintsFrom({ allergies }, catalog, {
    vegan: req.query.vegan === "true",
  });

  const rows = await db.select().from(recipesTable).where(visible);

  const safe: { recipe: Recipe; score: number }[] = [];
  let blockedCount = 0;

  for (const recipe of rows) {
    const report = checkRecipe(recipe.ingredients, catalog, constraints);
    if (!report.safe) {
      blockedCount += 1;
      continue;
    }
    const score = scoresOf(recipe)[goal] ?? 0;
    if (score >= GOAL_MATCH_THRESHOLD) safe.push({ recipe, score });
  }

  safe.sort((a, b) => b.score - a.score || a.recipe.id - b.recipe.id);

  res.json({
    goal,
    threshold: GOAL_MATCH_THRESHOLD,
    // How many cleared the bar in total, before the display cap. The client
    // needs this to say "6 of 11" rather than implying six is all there is.
    matchCount: safe.length,
    blockedBySafety: blockedCount,
    // Reported so the client can be honest that a stated allergy could not be
    // enforced, rather than showing a clean result that implies it was.
    unenforceableAllergies: constraints.unresolved,
    // Capped, not padded: everything returned genuinely clears the threshold.
    // See MAX_OFFERED for why the cap is six.
    recipes: safe.slice(0, MAX_OFFERED).map(({ recipe, score }) => ({ ...recipe, matchScore: score })),
  });
});

/**
 * Generate a batch of new recipes for a profile.
 *
 *   POST /api/recipes/generate  { goal?, preset?, count?, seedBase? }
 *
 * The counterpart to matching, and a POST because it writes. The intended flow
 * is: match first, offer what already fits, and come here when nothing does or
 * when the user wants something new anyway. Keeping them separate means the
 * search stays a cacheable GET and generation stays an explicit act.
 *
 * A batch rather than one drink, because one deterministic build is one answer
 * and the point of offering is to let someone choose. Everything generated is
 * stored — the batch is the user's history, and storing only the one they
 * picked would lose what they were choosing between.
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

  const preset = PRESETS.some((p) => p.id === body.preset)
    ? (body.preset as Preset)
    : "great";

  // Capped so a request cannot ask the server to build an unbounded number of
  // drinks. Ten is the default batch; more than that is not more choice, it is
  // the same shortlist re-walked.
  const count = Math.min(
    typeof body.count === "number" && body.count > 0 ? Math.floor(body.count) : DEFAULT_BATCH,
    20,
  );
  const seedBase = typeof body.seedBase === "number" ? Math.floor(body.seedBase) : Date.now() % 100000;

  const catalog = await loadCatalog();
  const buildProfile: BuildProfile = {
    primaryGoal: goal,
    secondaryGoals: Array.isArray(body.secondaryGoals)
      ? (body.secondaryGoals as string[])
      : profile?.secondaryGoals ?? [],
    tastePreference: Array.isArray(body.tastePreference)
      ? (body.tastePreference as string[])
      : profile?.tastePreference ?? [],
    allergies: Array.isArray(body.allergies)
      ? (body.allergies as string[])
      : profile?.allergies ?? [],
    dislikedIngredients: Array.isArray(body.dislikedIngredients)
      ? (body.dislikedIngredients as string[])
      : profile?.dislikedIngredients ?? [],
    vegan: body.vegan === true,
  };

  const batch = generateBatch(buildProfile, catalog, {
    preset,
    count,
    seedBase,
  });

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

  const rows = batch.map((r) => ({ ...r, createdByUserId: req.user?.userId ?? null }));

  // Same drink, same slug: a batch often rediscovers a build from a different
  // seed, and two rows for one recipe would be two entries in a history that
  // only happened once.
  await db.insert(recipesTable).values(rows as never).onConflictDoNothing({
    target: recipesTable.slug,
  });

  const stored = await db
    .select()
    .from(recipesTable)
    .where(inArray(recipesTable.slug, batch.map((r) => r.slug)));

  const bySlug = new Map(stored.map((r) => [r.slug, r]));
  const ordered = batch
    .map((r) => bySlug.get(r.slug))
    .filter((r): r is Recipe => r !== undefined);

  const above = ordered.filter((r) => (scoresOf(r)[goal] ?? 0) >= GOAL_MATCH_THRESHOLD);

  res.json({
    goal,
    preset,
    threshold: GOAL_MATCH_THRESHOLD,
    // Everything built and saved, against what is worth offering. The gap
    // between the two is the honest part: a batch that produced ten drinks and
    // only two that fit the goal should not look like a batch of two.
    generatedCount: ordered.length,
    matchCount: above.length,
    recipes: above.slice(0, MAX_OFFERED).map((r) => ({ ...r, matchScore: scoresOf(r)[goal] ?? 0 })),
  });
});

router.get("/recipes", async (req, res): Promise<void> => {
  const parsed = ListRecipesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, benefit, search } = parsed.data;

  let result = await db.select().from(recipesTable).where(visible);
  if (category) result = result.filter((r) => r.category === category);
  if (benefit) result = result.filter((r) => r.benefits.includes(benefit));
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }

  res.json(result);
});

/**
 * The signed-in user's own generated recipes, newest first.
 *
 * This is the consumption history. It is a separate route from `/recipes`
 * because these are not part of the catalog: they were built from one person's
 * profile and answers, and they are visible to that person whether or not they
 * ever choose to publish them.
 */
router.get("/recipes/mine", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const rows = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.createdByUserId, req.user!.userId));

  res.json(rows.sort((a, b) => b.id - a.id));
});

/**
 * Publish or unpublish one of your own recipes.
 *
 *   POST /api/recipes/:id/publish  { published: boolean }
 *
 * Ownership is checked rather than assumed, and a recipe nobody owns — a
 * curated one — cannot be flipped through here at all. Publishing is the one
 * action that takes something built from a person's profile and shows it to
 * other people, so it is deliberate, reversible, and theirs alone to take.
 */
router.post("/recipes/:id/publish", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRecipeParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const published = (req.body ?? {}).published;
  if (typeof published !== "boolean") {
    res.status(400).json({ error: "published must be true or false" });
    return;
  }

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, params.data.id))
    .limit(1);

  // Same 404 whether it does not exist or belongs to someone else. A different
  // status for each would let anyone map which ids are taken.
  if (!recipe || recipe.createdByUserId !== req.user!.userId) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const [updated] = await db
    .update(recipesTable)
    .set({ published })
    .where(eq(recipesTable.id, recipe.id))
    .returning();

  res.json(updated);
});

router.get("/recipes/:id", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRecipeParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, params.data.id))
    .limit(1);

  // An unpublished recipe is only its owner's to read. Without this the
  // listing routes filter on `published` while this one hands the same rows
  // out to anyone who counts upward — every generated drink is built from
  // somebody's profile, so that is their data, not an unlisted page.
  const readable =
    recipe && (recipe.published || recipe.createdByUserId === req.user?.userId);

  if (!readable) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.json(recipe);
});

export default router;
