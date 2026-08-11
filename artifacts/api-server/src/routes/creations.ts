import { Router, type IRouter } from "express";
import { eq, desc, sql, count, gte } from "drizzle-orm";
import {
  db,
  creationsTable,
  usersTable,
  smoothieLogsTable,
  goalPeriodsTable,
} from "@workspace/db";
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

/**
 * The board, counted.
 *
 * This returned 2,841 members, 47 creations this week and 19,260 rituals
 * completed, hardcoded, and the web app carried a second copy of the same
 * numbers as its fallback — so the figures survived an empty database, a
 * failed request and a fresh deployment identically.
 *
 * They are counted now, and they are allowed to be small. A real 3 is worth
 * more than an invented 2,841 on a service that refuses graded efficacy
 * claims, propagates a null rather than showing a partial total, and fails the
 * allergen check closed. Inventing the one number nobody checks is the same
 * move as all three, made in the other direction.
 *
 * `topGoal` is null when no period is active. The caller renders nothing for
 * it rather than falling back to a popular-sounding goal.
 */
router.get("/community/stats", async (_req, res): Promise<void> => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [[members], [thisWeek], [rituals], goals] = await Promise.all([
    db.select({ n: count() }).from(usersTable),
    db.select({ n: count() }).from(creationsTable).where(gte(creationsTable.createdAt, weekAgo)),
    db.select({ n: count() }).from(smoothieLogsTable),
    db
      .select({ goal: goalPeriodsTable.goal, n: count() })
      .from(goalPeriodsTable)
      .where(eq(goalPeriodsTable.active, true))
      .groupBy(goalPeriodsTable.goal)
      .orderBy(desc(count()))
      .limit(1),
  ]);

  res.json({
    members: members?.n ?? 0,
    creationsThisWeek: thisWeek?.n ?? 0,
    ritualsCompleted: rituals?.n ?? 0,
    topGoal: goals[0]?.goal ?? null,
  });
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
