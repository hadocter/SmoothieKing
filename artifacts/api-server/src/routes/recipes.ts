import { Router, type IRouter } from "express";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db, recipesTable } from "@workspace/db";
import {
  ListRecipesQueryParams,
  GetRecipeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatRecipe(r: typeof recipesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    tagline: r.tagline,
    description: r.description,
    prepTimeMinutes: r.prepTimeMinutes,
    servings: r.servings,
    calories: r.calories,
    protein: r.protein,
    benefits: r.benefits,
    skinBenefitScore: r.skinBenefitScore,
    ingredients: r.ingredients as {name: string; amount: string; unit: string; benefit: string | null}[],
    steps: r.steps,
    imageUrl: r.imageUrl,
    isFeatured: r.isFeatured,
    difficulty: r.difficulty,
    tags: r.tags,
  };
}

router.get("/recipes/featured", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.isFeatured, true))
    .limit(6);
  res.json(rows.map(formatRecipe));
});

router.get("/recipes/by-benefit", async (_req, res): Promise<void> => {
  const allRecipes = await db.select().from(recipesTable);
  const benefitMap: Record<string, { label: string; description: string }> = {
    "glowy-skin": {
      label: "Glowy Skin",
      description: "K-beauty inspired blends that nourish skin from within — collagen-boosting, antioxidant-rich rituals.",
    },
    "hydration": {
      label: "Deep Hydration",
      description: "Replenish and retain moisture at a cellular level. High water-content ingredients meet electrolyte balance.",
    },
    "sun-ritual": {
      label: "Sun Ritual",
      description: "Lycopene, beta-carotene, and antioxidants that work with your skin's natural UV defense systems.",
    },
    "protein-power": {
      label: "Protein & Power",
      description: "High-performance shakers engineered for muscle recovery and sustained energy — no compromise on taste.",
    },
    "anti-inflammatory": {
      label: "Anti-Inflammatory",
      description: "Turmeric, ginger, and adaptogen blends that calm the body and reduce oxidative stress.",
    },
    "detox-clarity": {
      label: "Detox & Clarity",
      description: "Chlorophyll-dense, liver-supportive combinations that reset the system and sharpen the mind.",
    },
  };

  const groups = Object.entries(benefitMap).map(([benefit, meta]) => ({
    benefit,
    label: meta.label,
    description: meta.description,
    recipes: allRecipes
      .filter((r) => r.benefits.includes(benefit))
      .map(formatRecipe),
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

  const conditions = [];
  if (category) conditions.push(eq(recipesTable.category, category));
  if (benefit) conditions.push(sql`${recipesTable.benefits} @> ARRAY[${benefit}]::text[]`);
  if (search) conditions.push(ilike(recipesTable.name, `%${search}%`));

  const rows = conditions.length
    ? await db.select().from(recipesTable).where(and(...conditions))
    : await db.select().from(recipesTable);

  res.json(rows.map(formatRecipe));
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetRecipeParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.json(formatRecipe(row));
});

export default router;
