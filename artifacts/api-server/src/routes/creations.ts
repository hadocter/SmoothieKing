import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, creationsTable } from "@workspace/db";
import { ListCreationsQueryParams, CreateCreationBody } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * The community board.
 *
 * This served an in-memory array, so every post vanished on the next restart
 * while six seeded rows sat in the `creations` table that nothing read. It is
 * the same drift that had `/recipes` serving four mocks against eight real
 * rows, and it is why a drink built, made and published in the new flow never
 * reached the board: the flow wrote a recipe, the board read a mock.
 *
 * A creation is the social object — author, story, likes — and a recipe is the
 * drink. They stay separate, joined by `recipeId`, so a post can point at what
 * it was made from without the board having to know how a recipe is built.
 */

router.get("/creations", async (req, res): Promise<void> => {
  const parsed = ListCreationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sort, goal } = parsed.data;

  const rows = await db
    .select()
    .from(creationsTable)
    .orderBy(sort === "popular" ? desc(creationsTable.likes) : desc(creationsTable.createdAt));

  res.json(goal ? rows.filter((c) => c.goal === goal) : rows);
});

router.post("/creations", async (req, res): Promise<void> => {
  const parsed = CreateCreationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const initials =
    parsed.data.authorName
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "SK";

  const body = req.body as Record<string, unknown>;

  const [created] = await db
    .insert(creationsTable)
    .values({
      name: parsed.data.name,
      authorName: parsed.data.authorName,
      authorInitials: initials,
      goal: parsed.data.goal,
      story: parsed.data.story ?? null,
      ingredients: parsed.data.ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        benefit: i.benefit ?? null,
      })),
      likes: 0,
      colorHex: parsed.data.colorHex ?? "#3B82F6",
      // Not in the generated body schema yet — the spec has not caught up with
      // the build flow. Read defensively rather than dropped, so a post from
      // that flow keeps its link and its photo.
      recipeId: typeof body.recipeId === "number" ? body.recipeId : null,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
    })
    .returning();

  res.status(201).json(created);
});

router.post("/creations/:id/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // Incremented in the database rather than read-modify-written here, so two
  // people liking at once do not overwrite each other's count.
  const [updated] = await db
    .update(creationsTable)
    .set({ likes: sql`${creationsTable.likes} + 1` })
    .where(eq(creationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }
  res.json(updated);
});

router.post("/creations/:id/unlike", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [updated] = await db
    .update(creationsTable)
    // Floored at zero: a double-unlike should not take a post negative.
    .set({ likes: sql`greatest(${creationsTable.likes} - 1, 0)` })
    .where(eq(creationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }
  res.json(updated);
});

export default router;
