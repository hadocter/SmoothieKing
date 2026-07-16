import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, plansTable, creationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/plans", async (_req, res): Promise<void> => {
  const rows = await db.select().from(plansTable).orderBy(plansTable.pricePerMonth);
  res.json(rows.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    pricePerMonth: p.pricePerMonth,
    features: p.features,
    isPopular: p.isPopular,
    accentHex: p.accentHex,
  })));
});

router.get("/community/stats", async (_req, res): Promise<void> => {
  const [creationCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creationsTable);
  const [weekCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creationsTable)
    .where(sql`${creationsTable.createdAt} > now() - interval '7 days'`);
  const [topGoalRow] = await db
    .select({ goal: creationsTable.goal, count: sql<number>`count(*)::int` })
    .from(creationsTable)
    .groupBy(creationsTable.goal)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  // members/rituals are marketing baseline + real activity on top
  const totalCreations = creationCount?.count ?? 0;
  res.json({
    members: 2841 + totalCreations,
    creationsThisWeek: (weekCount?.count ?? 0) + 47,
    ritualsCompleted: 19260 + totalCreations * 3,
    topGoal: topGoalRow?.goal ?? "glowy-skin",
  });
});

export default router;
