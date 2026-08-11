import { Router, type IRouter } from "express";
import { invalid } from "../lib/validation.ts";
import { and, desc, eq, gte, inArray, sql, count } from "drizzle-orm";
import {
  db,
  creationLikesTable,
  creationsTable,
  recipesTable,
  usersTable,
  smoothieLogsTable,
  goalPeriodsTable,
} from "@workspace/db";
import { ListCreationsQueryParams } from "@workspace/api-zod";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middlewares/auth.ts";
import { GOALS } from "../features/scoring/index.ts";

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

router.get("/creations", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = ListCreationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    invalid(res, parsed.error);
    return;
  }
  const { sort, goal } = parsed.data;

  const rows = await db
    .select()
    .from(creationsTable)
    .orderBy(sort === "popular" ? desc(creationsTable.likes) : desc(creationsTable.createdAt));

  const visible = goal ? rows.filter((c) => c.goal === goal) : rows;
  const liked = req.user && visible.length > 0
    ? await db
        .select({ creationId: creationLikesTable.creationId })
        .from(creationLikesTable)
        .where(
          and(
            eq(creationLikesTable.userId, req.user.userId),
            inArray(creationLikesTable.creationId, visible.map((creation) => creation.id)),
          ),
        )
    : [];
  const likedIds = new Set(liked.map((like) => like.creationId));

  res.json(visible.map((creation) => ({
    ...creation,
    likedByMe: likedIds.has(creation.id),
    // Only build-flow posts carry a recipe. Seeded editorial examples stay
    // readable, but cannot promise an unavailable one-click recreation.
    recipeId: creation.recipeId,
  })));
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

router.post("/creations", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const recipeId = typeof body.recipeId === "number" ? body.recipeId : null;
  if (!recipeId) {
    res.status(400).json({ error: "Post a drink from your builder history." });
    return;
  }

  const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId)).limit(1);
  // Posts are statements about a finished build. Do not accept a user-supplied
  // ingredient list or author name, both of which would make that statement
  // impossible to verify.
  if (!recipe || recipe.createdByUserId !== req.user!.userId || recipe.source !== "generated" || !recipe.published) {
    res.status(404).json({ error: "That published builder recipe was not found." });
    return;
  }

  const goal = recipe.tags.find((tag) => GOALS.includes(tag as (typeof GOALS)[number])) ?? recipe.benefits[0];
  if (!goal) {
    res.status(422).json({ error: "That recipe has no goal to share with the community." });
    return;
  }

  const authorName = req.user!.nickname;
  const initials =
    authorName
      .split(/\s+/)
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "SK";

  const values = {
    name: recipe.name,
    authorName,
    authorInitials: initials,
    goal,
    story: recipe.description,
    ingredients: recipe.ingredients,
    likes: 0,
    colorHex: typeof body.colorHex === "string" && /^#[0-9a-f]{6}$/i.test(body.colorHex) ? body.colorHex : "#3B82F6",
    recipeId: recipe.id,
    imageUrl: recipe.imageUrl || null,
  };

  const [existing] = await db.select().from(creationsTable).where(eq(creationsTable.recipeId, recipe.id)).limit(1);
  const [created] = existing
    ? await db.update(creationsTable).set(values).where(eq(creationsTable.id, existing.id)).returning()
    : await db.insert(creationsTable).values(values).returning();

  res.status(201).json(created);
});

router.post("/creations/:id/like", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "We couldn't find that post." });
    return;
  }

  const [creation] = await db.select({ id: creationsTable.id }).from(creationsTable).where(eq(creationsTable.id, id)).limit(1);
  if (!creation) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }

  const [reaction] = await db
    .insert(creationLikesTable)
    .values({ creationId: id, userId: req.user!.userId })
    .onConflictDoNothing()
    .returning();

  // Only a newly recorded account reaction changes the displayed count.
  const [updated] = await db
    .update(creationsTable)
    .set({ likes: reaction ? sql`${creationsTable.likes} + 1` : creationsTable.likes })
    .where(eq(creationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }
  res.json({ ...updated, likedByMe: true });
});

router.post("/creations/:id/unlike", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "", 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "We couldn't find that post." });
    return;
  }

  const [reaction] = await db
    .delete(creationLikesTable)
    .where(and(eq(creationLikesTable.creationId, id), eq(creationLikesTable.userId, req.user!.userId)))
    .returning();
  const [updated] = await db
    .update(creationsTable)
    // Floored at zero: a double-unlike should not take a post negative.
    .set({ likes: reaction ? sql`greatest(${creationsTable.likes} - 1, 0)` : creationsTable.likes })
    .where(eq(creationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Creation not found" });
    return;
  }
  res.json({ ...updated, likedByMe: false });
});

export default router;
