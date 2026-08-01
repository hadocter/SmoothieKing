import { Router, type IRouter } from "express";
import { ListCreationsQueryParams, CreateCreationBody } from "@workspace/api-zod";

const router: IRouter = Router();

export interface CreationItem {
  id: number;
  name: string;
  authorName: string;
  authorInitials: string;
  goal: string;
  story: string | null;
  ingredients: { name: string; amount: string; unit: string; benefit: string | null }[];
  likes: number;
  colorHex: string | null;
  createdAt: string;
}

const creationsStore: CreationItem[] = [
  {
    id: 1,
    name: "Matcha Citrus Glow",
    authorName: "Sarah K.",
    authorInitials: "SK",
    goal: "glowy-skin",
    story: "My daily morning skin ritual after 10k run.",
    ingredients: [
      { name: "Matcha", amount: "1", unit: "tsp", benefit: "Antioxidants" },
      { name: "Mango", amount: "1", unit: "cup", benefit: "Vitamin C" },
      { name: "Coconut Water", amount: "1", unit: "cup", benefit: "Hydration" },
    ],
    likes: 42,
    colorHex: "#10B981",
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Berry Collagen Shield",
    authorName: "Alex M.",
    authorInitials: "AM",
    goal: "anti-inflammatory",
    story: "Created for post-workout joint recovery.",
    ingredients: [
      { name: "Blueberry", amount: "1", unit: "cup", benefit: "Anthocyanins" },
      { name: "Collagen Peptides", amount: "1", unit: "scoop", benefit: "Joint repair" },
    ],
    likes: 29,
    colorHex: "#8B5CF6",
    createdAt: new Date().toISOString(),
  },
];

let nextCreationId = 3;

router.get("/creations", async (req, res): Promise<void> => {
  const parsed = ListCreationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sort, goal } = parsed.data;

  let result = [...creationsStore];
  if (goal) result = result.filter((c) => c.goal === goal);

  if (sort === "popular") {
    result.sort((a, b) => b.likes - a.likes);
  } else {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  res.json(result);
});

router.post("/creations", async (req, res): Promise<void> => {
  const parsed = CreateCreationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const initials = parsed.data.authorName
    .split(/\s+/)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const newCreation: CreationItem = {
    id: nextCreationId++,
    name: parsed.data.name,
    authorName: parsed.data.authorName,
    authorInitials: initials || "SK",
    goal: parsed.data.goal,
    story: parsed.data.story ?? null,
    ingredients: parsed.data.ingredients.map(i => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      benefit: i.benefit ?? null,
    })),
    likes: 0,
    colorHex: parsed.data.colorHex ?? "#3B82F6",
    createdAt: new Date().toISOString(),
  };

  creationsStore.unshift(newCreation);
  res.status(201).json(newCreation);
});

router.post("/creations/:id/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const creation = creationsStore.find((c) => c.id === id);
  if (!creation) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }

  creation.likes += 1;
  res.json(creation);
});

router.delete("/creations/:id/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const creation = creationsStore.find((c) => c.id === id);
  if (!creation) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }

  creation.likes = Math.max(0, creation.likes - 1);
  res.json(creation);
});

export default router;
