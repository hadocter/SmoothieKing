import { Router, type IRouter } from "express";
import { invalid } from "../lib/validation.ts";
import { eq, and } from "drizzle-orm";
import { db, recipesTable, type Recipe } from "@workspace/db";
import { ListRecipesQueryParams, GetRecipeParams } from "@workspace/api-zod";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middlewares/auth.ts";
import { GOALS } from "../features/scoring/index.ts";
import { makesClaim, sanitiseStory } from "../features/naming/index.ts";

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

function ingredientNames(ingredients: unknown): string[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients
    .map((ingredient) => (ingredient && typeof ingredient === "object" && typeof ingredient.name === "string" ? ingredient.name : null))
    .filter((name): name is string => name !== null);
}

/**
 * Database copy is a record of how a recipe was originally written, not a
 * licence to repeat an old treatment claim on every public page. Curated rows
 * get neutral editorial copy; member rows retain their voice after the same
 * claim filter used by the naming flow. Private drafts stay untouched.
 */
function presentPublicRecipe(recipe: Recipe): Recipe {
  const names = ingredientNames(recipe.ingredients);
  const ingredientLine = names.length > 0 ? names.slice(0, 4).join(", ") : "the listed ingredients";
  const safeName = makesClaim(recipe.name) ? "Shared smoothie" : recipe.name;

  if (recipe.source === "curated") {
    return {
      ...recipe,
      name: safeName,
      tagline: `A kitchen recipe with ${ingredientLine}.`,
      description: `A kitchen-built recipe made with ${ingredientLine}.`,
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((ingredient) => ({
            ...(ingredient && typeof ingredient === "object" ? ingredient : {}),
            benefit: null,
          }))
        : [],
    };
  }

  return {
    ...recipe,
    name: safeName,
    tagline: "A smoothie shared by a community member.",
    description: sanitiseStory(recipe.description ?? "") || "A smoothie shared by a community member.",
  };
}

router.get("/recipes/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(recipesTable)
    .where(and(visible, eq(recipesTable.isFeatured, true)));
  res.json(rows.map(presentPublicRecipe));
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
    recipes: rows.filter((r) => r.benefits.includes(benefit)).map(presentPublicRecipe),
  })).filter((g) => g.recipes.length > 0);

  res.json(groups);
});

router.get("/recipes", async (req, res): Promise<void> => {
  const parsed = ListRecipesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    invalid(res, parsed.error);
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
        (r.description ?? "").toLowerCase().includes(q) ||
        r.benefits.some((benefit) => benefit.toLowerCase().includes(q)) ||
        (r.ingredients as { name?: unknown }[]).some(
          (ingredient) => typeof ingredient.name === "string" && ingredient.name.toLowerCase().includes(q),
        ),
    );
  }

  res.json(result.map(presentPublicRecipe));
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
    invalid(res, params.error);
    return;
  }

  const published = (req.body ?? {}).published;
  if (typeof published !== "boolean") {
    res.status(400).json({ error: "We couldn't tell whether to publish or unpublish that." });
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

/**
 * Edit one of your own recipes.
 *
 *   PATCH /api/recipes/:id  { name?, description?, imageUrl? }
 *
 * The name and story arrive written by a model and the author edits them, so
 * this is the endpoint that makes those a draft rather than a decision. Only
 * the three fields a person would actually change — the ingredients and the
 * scores are what the drink *is*, and letting them be edited would decouple a
 * recipe from the numbers computed about it.
 *
 * `imageUrl` accepts a data URL. That is the right call for a local build with
 * no object storage and the wrong one for production: images live in the same
 * row as the recipe, so every listing query drags them along. Moving to real
 * storage means changing this one field's contract.
 */
const MAX_IMAGE_CHARS = 2_000_000; // ~1.5MB of base64.

router.patch("/recipes/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRecipeParams.safeParse({ id: raw });
  if (!params.success) {
    invalid(res, params.error);
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: { name?: string; description?: string; imageUrl?: string } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (!name) {
      res.status(400).json({ error: "Give it a name before saving." });
      return;
    }
    if (makesClaim(name)) {
      res.status(400).json({ error: "Names can describe the drink, but cannot make a health claim." });
      return;
    }
    patch.name = name;
  }
  if (typeof body.description === "string") {
    const description = sanitiseStory(body.description.trim().slice(0, 1000));
    patch.description = description || "A smoothie shared by a community member.";
  }
  if (typeof body.imageUrl === "string") {
    if (body.imageUrl.length > MAX_IMAGE_CHARS) {
      res.status(413).json({ error: "That photo is too large. Try one under 2 MB." });
      return;
    }
    // Only inline data or nothing. A remote URL here would let a recipe pull
    // an image from anywhere, which is someone else's bandwidth and a tracking
    // pixel waiting to happen.
    if (body.imageUrl && !body.imageUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "That photo couldn't be read. Pick a different one." });
      return;
    }
    patch.imageUrl = body.imageUrl;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing was changed." });
    return;
  }

  const [recipe] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, params.data.id))
    .limit(1);

  // Same 404 for "not yours" as for "not there", so ids cannot be mapped by
  // their status codes.
  if (!recipe || recipe.createdByUserId !== req.user!.userId) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const [updated] = await db
    .update(recipesTable)
    .set(patch)
    .where(eq(recipesTable.id, recipe.id))
    .returning();

  res.json(updated);
});

router.get("/recipes/:id", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRecipeParams.safeParse({ id: raw });
  if (!params.success) {
    invalid(res, params.error);
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

  res.json(recipe.published ? presentPublicRecipe(recipe) : recipe);
});

export default router;
