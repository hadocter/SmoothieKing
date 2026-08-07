import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, recipesTable } from "@workspace/db";
import { ListRecipesQueryParams, GetRecipeParams } from "@workspace/api-zod";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middlewares/auth.ts";
import { GOALS } from "../features/scoring/index.ts";

const router: IRouter = Router();

/**
 * Browsing recipes, and owning them.
 *
 * Matching and generation used to live here too and now have their own
 * features — they answer a different question ("what should I drink") from
 * this file ("show me the catalog"), fail for different reasons, and were the
 * two things most likely to change.
 *
 * These routes served a hard-coded array of four while the table had eight, so
 * half the catalog was unreachable from the app while sitting in Postgres.
 * Everything below reads the table.
 */

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
 * newest goals had no descriptions written for them, and inventing marketing
 * copy on the server would be the wrong place to do it. Both are stated
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

  const groups = GOALS.map((benefit) => ({
    benefit,
    label: BENEFIT_COPY[benefit].label,
    description: BENEFIT_COPY[benefit].description,
    // Grouped on the editorial `benefits` tags, deliberately. This is the
    // browsing view — it should show what a recipe was written to be, not what
    // a scoring function computed about it. Matching is the route for scores.
    recipes: rows.filter((r) => r.benefits.includes(benefit)),
  })).filter((g) => g.recipes.length > 0);

  res.json(groups);
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
      (r) => r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q),
    );
  }

  res.json(result);
});

/**
 * The signed-in user's own generated recipes, newest first.
 *
 * The consumption history's catalog side. Separate from `/recipes` because
 * these are not part of the catalog: they were built from one person's profile
 * and are visible to them whether or not they ever publish.
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
 * Publishing is the one action that takes something built from a person's
 * profile and shows it to other people, so it is deliberate, reversible, and
 * theirs alone to take.
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

  // The same 404 whether it does not exist or belongs to someone else. A
  // different status for each would let anyone map which ids are taken.
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
  // listing routes filter on `published` while this one hands the same rows to
  // anyone counting upward — every generated drink is built from somebody's
  // profile, so that is their data, not an unlisted page.
  const readable = recipe && (recipe.published || recipe.createdByUserId === req.user?.userId);

  if (!readable) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.json(recipe);
});

export default router;
