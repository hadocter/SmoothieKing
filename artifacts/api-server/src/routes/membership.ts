import { Router, type IRouter } from "express";

const router: IRouter = Router();

export const MOCK_PLANS = [
  {
    id: 1,
    name: "Ingredient Delivery",
    tagline: "A recurring grocery-ready box for making the recipes you already use for free.",
    pricePerMonth: 29,
    features: [
      "Two chilled ingredient kits each month",
      "Pre-portioned fruit, greens, and pantry add-ons",
      "Delivery scheduling and skip-week controls",
      "Available only in supported delivery areas",
    ],
    isPopular: false,
    accentHex: null,
  },
  {
    id: 2,
    name: "Pickup Pass",
    tagline: "For collecting a freshly blended drink at a participating Smoothy King location.",
    pricePerMonth: 49,
    features: [
      "Four made-to-order smoothie pickup credits each month",
      "Choose a saved public recipe before arriving",
      "Time-window pickup at participating locations",
      "Ingredient substitutions confirmed at handoff",
    ],
    isPopular: true,
    accentHex: "#10B981",
  },
  {
    id: 3,
    name: "Blend & Pickup",
    tagline: "A fulfillment bundle for people who alternate between home blending and store pickup.",
    pricePerMonth: 89,
    features: [
      "Everything in Ingredient Delivery",
      "Four made-to-order smoothie pickup credits each month",
      "One flexible delivery or pickup skip per billing cycle",
      "Priority help with delivery or pickup issues",
    ],
    isPopular: false,
    accentHex: null,
  },
];

router.get("/plans", async (_req, res): Promise<void> => {
  res.json(MOCK_PLANS);
});

export default router;
