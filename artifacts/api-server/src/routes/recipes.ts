import { Router, type IRouter } from "express";
import { ListRecipesQueryParams, GetRecipeParams } from "@workspace/api-zod";

const router: IRouter = Router();

export const MOCK_RECIPES = [
  {
    id: 1,
    name: "The Glow Ritual",
    slug: "the-glow-ritual",
    category: "smoothie",
    tagline: "Your daily skin supplement, liquefied.",
    description: "Inspired by Korean 'glass skin' philosophy — a complexion so luminous it appears backlit.",
    prepTimeMinutes: 5,
    servings: 1,
    calories: 280,
    protein: 12,
    benefits: ["glowy-skin", "anti-inflammatory"],
    skinBenefitScore: 10,
    ingredients: [
      { name: "Mango", amount: "1", unit: "cup", benefit: "Vitamin C brightening" },
      { name: "Dragon Fruit", amount: "1/2", unit: "cup", benefit: "Betalain antioxidants" },
      { name: "Collagen Peptides", amount: "1", unit: "scoop", benefit: "Collagen synthesis" },
      { name: "Coconut Water", amount: "3/4", unit: "cup", benefit: "Electrolyte hydration" },
      { name: "Turmeric", amount: "1/4", unit: "tsp", benefit: "Curcumin brightening" },
    ],
    steps: [
      "Freeze mango and dragon fruit overnight.",
      "Add coconut water to blender first.",
      "Layer in frozen fruits, collagen, and turmeric.",
      "Blend on high for 45 seconds.",
      "Pour into a chilled glass and enjoy."
    ],
    imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7dd0dc9?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    difficulty: "easy",
    tags: ["glow", "collagen", "vitamin-c", "korean-beauty"],
  },
  {
    id: 2,
    name: "Jade Depth",
    slug: "jade-depth",
    category: "smoothie",
    tagline: "Forty shades of green. One purpose: clarity.",
    description: "A deep-chlorophyll detox smoothie drawing from Japan's matcha tradition and Korea's botanical rituals.",
    prepTimeMinutes: 5,
    servings: 1,
    calories: 195,
    protein: 8,
    benefits: ["detox-clarity", "anti-inflammatory"],
    skinBenefitScore: 8,
    ingredients: [
      { name: "Spinach", amount: "2", unit: "cups", benefit: "Chlorophyll detox" },
      { name: "Matcha", amount: "1", unit: "tsp", benefit: "EGCG antioxidants" },
      { name: "Avocado", amount: "1/4", unit: "whole", benefit: "Healthy fat absorption" },
      { name: "Ginger", amount: "1", unit: "inch", benefit: "Circulation activation" },
      { name: "Coconut Water", amount: "1", unit: "cup", benefit: "Electrolyte base" },
    ],
    steps: [
      "Add coconut water and spinach, blend until smooth.",
      "Add matcha, avocado, and ginger.",
      "Blend 60 seconds on high.",
      "Serve fresh."
    ],
    imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    difficulty: "easy",
    tags: ["detox", "matcha", "alkaline", "energy"],
  },
  {
    id: 3,
    name: "Cloud Nine Shaker",
    slug: "cloud-nine-shaker",
    category: "shaker",
    tagline: "Muscle recovery as a meditative act.",
    description: "Engineered for active athletes. 42g of clean protein with a creamy vanilla-coconut base.",
    prepTimeMinutes: 3,
    servings: 1,
    calories: 420,
    protein: 42,
    benefits: ["protein-power"],
    skinBenefitScore: 5,
    ingredients: [
      { name: "Whey Protein Isolate", amount: "2", unit: "scoops", benefit: "Muscle synthesis" },
      { name: "Avocado", amount: "1/4", unit: "whole", benefit: "Recovery fats" },
      { name: "Coconut Water", amount: "1", unit: "cup", benefit: "Electrolytes" },
      { name: "Blueberry", amount: "1/2", unit: "cup", benefit: "Recovery boost" },
    ],
    steps: [
      "Combine coconut water and blueberries in blender.",
      "Add avocado and whey protein.",
      "Blend for 30 seconds.",
      "Drink post-workout."
    ],
    imageUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    difficulty: "easy",
    tags: ["protein", "recovery", "performance"],
  },
  {
    id: 4,
    name: "Soleil Protocol",
    slug: "soleil-protocol",
    category: "smoothie",
    tagline: "Wear sunscreen. Drink this.",
    description: "Lycopene, beta-carotene, and citrulline for cellular UV defense and deep hydration.",
    prepTimeMinutes: 7,
    servings: 1,
    calories: 190,
    protein: 4,
    benefits: ["sun-ritual", "hydration"],
    skinBenefitScore: 9,
    ingredients: [
      { name: "Watermelon", amount: "2", unit: "cups", benefit: "Citrulline & lycopene" },
      { name: "Mango", amount: "1/2", unit: "cup", benefit: "Beta-carotene defense" },
      { name: "Coconut Water", amount: "1/2", unit: "cup", benefit: "Hydration base" },
    ],
    steps: [
      "Blend watermelon and coconut water.",
      "Add mango and blend high for 45s.",
      "Serve chilled."
    ],
    imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7dd0dc9?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    difficulty: "easy",
    tags: ["sun-ritual", "uv-defense", "hydration"],
  },
];

router.get("/recipes/featured", async (_req, res): Promise<void> => {
  res.json(MOCK_RECIPES.filter((r) => r.isFeatured));
});

router.get("/recipes/by-benefit", async (_req, res): Promise<void> => {
  const benefitMap: Record<string, { label: string; description: string }> = {
    "glowy-skin": { label: "Glowy Skin", description: "K-beauty inspired collagen & antioxidant blends." },
    "hydration": { label: "Deep Hydration", description: "Replenish moisture at a cellular level." },
    "sun-ritual": { label: "Sun Ritual", description: "Natural lycopene & beta-carotene UV defense." },
    "protein-power": { label: "Protein & Power", description: "High-performance muscle recovery." },
    "anti-inflammatory": { label: "Anti-Inflammatory", description: "Curcumin & adaptogen calming blends." },
    "detox-clarity": { label: "Detox & Clarity", description: "Chlorophyll-dense system reset." },
  };

  const groups = Object.entries(benefitMap).map(([benefit, meta]) => ({
    benefit,
    label: meta.label,
    description: meta.description,
    recipes: MOCK_RECIPES.filter((r) => r.benefits.includes(benefit)),
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

  let result = MOCK_RECIPES;
  if (category) result = result.filter((r) => r.category === category);
  if (benefit) result = result.filter((r) => r.benefits.includes(benefit));
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
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

  const recipe = MOCK_RECIPES.find((r) => r.id === params.data.id);
  if (!recipe) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.json(recipe);
});

export default router;
