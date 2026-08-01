import { Router, type IRouter } from "express";

const router: IRouter = Router();

export const MOCK_PLANS = [
  {
    id: 1,
    name: "Essential",
    tagline: "For the curious blender establishing a daily routine.",
    pricePerMonth: 29,
    features: [
      "Access to 50+ official recipes",
      "Personalized health onboarding baseline",
      "Custom Smoothie Builder lab",
      "Standard ingredient library & search",
    ],
    isPopular: false,
    accentHex: null,
  },
  {
    id: 2,
    name: "Ritual Pass",
    tagline: "Our flagship membership for dedicated wellness enthusiasts.",
    pricePerMonth: 49,
    features: [
      "Everything in Essential",
      "Unlimited custom blend saves & sharing",
      "K-Beauty skin benefit rating score",
      "Priority community wall posting",
      "Monthly ingredient box discounts",
    ],
    isPopular: true,
    accentHex: "#10B981",
  },
  {
    id: 3,
    name: "Laboratory VIP",
    tagline: "The ultimate concierge nutrition & functional blend experience.",
    pricePerMonth: 89,
    features: [
      "Everything in Ritual Pass",
      "1-on-1 Nutritionist consultation",
      "Exclusive adaptogen & collagen drops",
      "Early access to new lab formulas",
      "Free express shipping on all orders",
    ],
    isPopular: false,
    accentHex: null,
  },
];

router.get("/plans", async (_req, res): Promise<void> => {
  res.json(MOCK_PLANS);
});

router.get("/community/stats", async (_req, res): Promise<void> => {
  res.json({
    members: 2841,
    creationsThisWeek: 47,
    ritualsCompleted: 19260,
    topGoal: "glowy-skin",
  });
});

export default router;
