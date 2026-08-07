import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, recipesTable, ingredientsTable, userProfilesTable, type Recipe } from "@workspace/db";
import { ListRecipesQueryParams, GetRecipeParams } from "@workspace/api-zod";
import { optionalAuth, type AuthenticatedRequest } from "../middlewares/auth";
import {
  GOALS,
  GOAL_MATCH_THRESHOLD,
  MAX_OFFERED,
  type GoalScores,
} from "../lib/scoring";
import { checkRecipe, constraintsFrom, type CheckableIngredient } from "../lib/safety";

const router: IRouter = Router();

/**
 * These routes served a hard-coded MOCK_RECIPES array of four. The database
 * has eight — the mock had drifted, so half the catalog was unreachable from
 * the app while sitting in Postgres the whole time. Everything below reads the
 * table.
 */

/** Just the columns safety and scoring need. */
async function loadCatalog(): Promise<CheckableIngredient[]> {
  const rows = await db
    .select({
      name: ingredientsTable.name,
      benefits: ingredientsTable.benefits,
      proteinG: ingredientsTable.proteinG,
      servingGrams: ingredientsTable.servingGrams,
      contains: ingredientsTable.contains,
      animal: ingredientsTable.animal,
    })
    .from(ingredientsTable);
  return rows;
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

router.get("/recipes/:id", async (req, res): Promise<void> => {
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

  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.json(recipe);
});

export default router;
