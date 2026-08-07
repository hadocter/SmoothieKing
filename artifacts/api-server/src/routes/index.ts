import { Router, type IRouter } from "express";
import healthRouter from "./health.ts";
import authRouter from "./auth.ts";
import userRouter from "./user.ts";
import recipesRouter from "./recipes.ts";
import ingredientsRouter from "./ingredients.ts";
import favoritesRouter from "./favorites.ts";
import creationsRouter from "./creations.ts";
import membershipRouter from "./membership.ts";

import recommendationRoutes from "../features/recommendation/routes.ts";
import generationRoutes from "../features/generation/routes.ts";
import safetyRoutes from "../features/safety/routes.ts";
import elicitationRoutes from "../features/elicitation/routes.ts";
import smoothieLogRoutes from "../features/logs/routes.ts";
import goalRoutes from "../features/goals/routes.ts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);

/**
 * Order matters here, and it is not stylistic.
 *
 * `recipesRouter` owns `/recipes/:id`, which matches `/recipes/match` and
 * `/recipes/generate` as well as any real id. Express takes the first router
 * that matches, so these two must be registered before it. Moving them below
 * turns both endpoints into a 400 from the id parser, which looks like a
 * client bug rather than a routing one.
 */
router.use(recommendationRoutes);
router.use(generationRoutes);
router.use(recipesRouter);

router.use(ingredientsRouter);
router.use(favoritesRouter);
router.use(creationsRouter);
router.use(membershipRouter);
router.use(safetyRoutes);
router.use(elicitationRoutes);
router.use(smoothieLogRoutes);
router.use(goalRoutes);

export default router;
