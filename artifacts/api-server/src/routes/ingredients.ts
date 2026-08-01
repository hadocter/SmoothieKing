import { Router, type IRouter } from "express";

const router: IRouter = Router();

export const MOCK_INGREDIENTS = [
  { id: 1, name: "Mango", category: "fruit", benefits: ["glowy-skin", "anti-inflammatory"], skinBenefitKey: "vitamin-c-boost", description: "Rich in vitamins A and C, mango brightens and evens skin tone.", koreanName: "망고", nutrientHighlights: ["Vitamin C", "Vitamin A", "Beta-Carotene"] },
  { id: 2, name: "Dragon Fruit", category: "fruit", benefits: ["glowy-skin", "hydration"], skinBenefitKey: "radiance", description: "Hydration powerhouse with betalains that promote a luminous complexion.", koreanName: "드래곤 프루트", nutrientHighlights: ["Betalains", "Vitamin C", "Iron"] },
  { id: 3, name: "Turmeric", category: "adaptogen", benefits: ["anti-inflammatory", "glowy-skin"], skinBenefitKey: "brightening", description: "Curcumin inhibits melanin production and reduces redness at cellular level.", koreanName: "강황", nutrientHighlights: ["Curcumin", "Manganese", "Iron"] },
  { id: 4, name: "Spirulina", category: "superfood", benefits: ["detox-clarity", "anti-inflammatory", "protein-power"], skinBenefitKey: "detox-clarity", description: "Phycocyanin binds to toxins leaving skin noticeably clearer.", koreanName: "스피루리나", nutrientHighlights: ["Phycocyanin", "Protein", "Iron"] },
  { id: 5, name: "Collagen Peptides", category: "protein", benefits: ["glowy-skin", "protein-power"], skinBenefitKey: "collagen-synthesis", description: "Hydrolyzed marine collagen improves skin elasticity and moisture retention.", koreanName: "콜라겐 펩타이드", nutrientHighlights: ["Type I Collagen", "Amino Acids"] },
  { id: 6, name: "Coconut Water", category: "liquid", benefits: ["hydration"], skinBenefitKey: "electrolyte-hydration", description: "Matches human plasma electrolyte profile for cellular hydration.", koreanName: "코코넛 워터", nutrientHighlights: ["Potassium", "Electrolytes"] },
  { id: 7, name: "Ginger", category: "spice", benefits: ["anti-inflammatory", "detox-clarity"], skinBenefitKey: "circulation", description: "Gingerol stimulates peripheral blood flow for healthy natural flush.", koreanName: "생강", nutrientHighlights: ["Gingerol", "Antioxidants"] },
  { id: 8, name: "Matcha", category: "superfood", benefits: ["detox-clarity", "glowy-skin"], skinBenefitKey: "egcg-antioxidant", description: "Concentrated EGCG catechins neutralize free radicals 137x faster than green tea.", koreanName: "말차", nutrientHighlights: ["EGCG", "L-Theanine"] },
  { id: 9, name: "Blueberry", category: "fruit", benefits: ["glowy-skin", "anti-inflammatory"], skinBenefitKey: "anthocyanin-shield", description: "Highest antioxidant density among fruits, protecting microvascular structures.", koreanName: "블루베리", nutrientHighlights: ["Anthocyanins", "Vitamin K"] },
  { id: 10, name: "Avocado", category: "fat", benefits: ["glowy-skin", "hydration"], skinBenefitKey: "lipid-barrier", description: "Monounsaturated oleic acid reinforces skin lipid barrier.", koreanName: "아보카도", nutrientHighlights: ["Oleic Acid", "Vitamin E"] },
  { id: 11, name: "Whey Protein Isolate", category: "protein", benefits: ["protein-power"], skinBenefitKey: "amino-acid-building", description: "Micro-filtered whey isolate providing complete BCAA profile.", koreanName: "휘이 단백질", nutrientHighlights: ["BCAAs", "Leucine"] },
  { id: 12, name: "Watermelon", category: "fruit", benefits: ["sun-ritual", "hydration"], skinBenefitKey: "lycopene-uv-shield", description: "Citrulline and lycopene synergy for intercellular hydration and UV protection.", koreanName: "수박", nutrientHighlights: ["Citrulline", "Lycopene"] },
];

router.get("/ingredients", async (_req, res): Promise<void> => {
  res.json(MOCK_INGREDIENTS);
});

export default router;
