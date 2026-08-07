import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import userRouter from "./user";
import recipesRouter from "./recipes";
import ingredientsRouter from "./ingredients";
import favoritesRouter from "./favorites";
import creationsRouter from "./creations";
import membershipRouter from "./membership";
import onboardingAssistRouter from "./onboarding-assist";
import safetyRouter from "./safety";
import smoothieLogsRouter from "./smoothie-logs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userRouter);
router.use(recipesRouter);
router.use(ingredientsRouter);
router.use(favoritesRouter);
router.use(creationsRouter);
router.use(membershipRouter);
router.use(onboardingAssistRouter);
router.use(safetyRouter);
router.use(smoothieLogsRouter);

export default router;
