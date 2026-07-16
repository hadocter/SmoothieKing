import { Router, type IRouter } from "express";
import healthRouter from "./health";
import recipesRouter from "./recipes";
import ingredientsRouter from "./ingredients";
import favoritesRouter from "./favorites";

const router: IRouter = Router();

router.use(healthRouter);
router.use(recipesRouter);
router.use(ingredientsRouter);
router.use(favoritesRouter);

export default router;
