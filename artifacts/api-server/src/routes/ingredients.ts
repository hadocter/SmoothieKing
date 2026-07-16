import { Router, type IRouter } from "express";
import { db, ingredientsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/ingredients", async (_req, res): Promise<void> => {
  const rows = await db.select().from(ingredientsTable);
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    benefits: r.benefits,
    skinBenefitKey: r.skinBenefitKey,
    description: r.description,
    koreanName: r.koreanName,
    nutrientHighlights: r.nutrientHighlights,
  })));
});

export default router;
