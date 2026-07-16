import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, creationsTable } from "@workspace/db";
import { ListCreationsQueryParams, CreateCreationBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatCreation(c: typeof creationsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    authorName: c.authorName,
    authorInitials: c.authorInitials,
    goal: c.goal,
    story: c.story,
    ingredients: c.ingredients as { name: string; amount: string; unit: string; benefit: string | null }[],
    likes: c.likes,
    colorHex: c.colorHex,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/creations", async (req, res): Promise<void> => {
  const parsed = ListCreationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { sort, goal } = parsed.data;

  let query = db.select().from(creationsTable).$dynamic();
  if (goal) query = query.where(eq(creationsTable.goal, goal));
  query = sort === "popular"
    ? query.orderBy(desc(creationsTable.likes), desc(creationsTable.createdAt))
    : query.orderBy(desc(creationsTable.createdAt));

  const rows = await query;
  res.json(rows.map(formatCreation));
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

  const [row] = await db
    .insert(creationsTable)
    .values({
      name: parsed.data.name,
      authorName: parsed.data.authorName,
      authorInitials: initials,
      goal: parsed.data.goal,
      story: parsed.data.story ?? null,
      ingredients: parsed.data.ingredients,
      colorHex: parsed.data.colorHex ?? null,
    })
    .returning();

  res.status(201).json(formatCreation(row!));
});

router.post("/creations/:id/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .update(creationsTable)
    .set({ likes: sql`${creationsTable.likes} + 1` })
    .where(eq(creationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }
  res.json(formatCreation(row));
});

router.delete("/creations/:id/like", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .update(creationsTable)
    .set({ likes: sql`GREATEST(${creationsTable.likes} - 1, 0)` })
    .where(eq(creationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }
  res.json(formatCreation(row));
});

export default router;
