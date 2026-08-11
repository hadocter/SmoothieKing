import type { Ingredient } from "@workspace/db";

/**
 * Reader-facing ingredient copy.
 *
 * Builder data deliberately stays in the database in its full, technical
 * form. The catalogue is a different surface: it should describe every item
 * consistently and should not turn a nutrient list into a treatment claim.
 * Keeping the presentation at the API boundary also updates established
 * databases; changing only the seed would leave existing deployments with
 * their old copy forever.
 */

const STOCK_PHOTOS: Record<string, string> = {
  Mango: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1200&q=82",
  "Dragon Fruit": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1200&q=82",
  "Coconut Water": "https://images.unsplash.com/photo-1560717845-968823efbee1?auto=format&fit=crop&w=1200&q=82",
  Blueberry: "https://images.unsplash.com/photo-1494597564530-871f2b93ac55?auto=format&fit=crop&w=1200&q=82",
  Watermelon: "https://images.unsplash.com/photo-1560717845-968823efbee1?auto=format&fit=crop&w=1200&q=82",
  Spinach: "https://images.unsplash.com/photo-1622484211771-9b93ca12b41e?auto=format&fit=crop&w=1200&q=82",
  Kefir: "https://images.unsplash.com/photo-1494597564530-871f2b93ac55?auto=format&fit=crop&w=1200&q=82",
  "Whey Protein Isolate": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8?auto=format&fit=crop&w=1200&q=82",
  "Greek yogurt": "https://images.unsplash.com/photo-1494597564530-871f2b93ac55?auto=format&fit=crop&w=1200&q=82",
  Avocado: "https://images.unsplash.com/photo-1622484211771-9b93ca12b41e?auto=format&fit=crop&w=1200&q=82",
  Strawberry: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1200&q=82",
  Strawberries: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=1200&q=82",
};

const CATEGORY_NOUN: Record<string, string> = {
  fruit: "fruit",
  vegetable: "vegetable",
  protein: "protein ingredient",
  liquid: "liquid",
  fat: "rich ingredient",
  adaptogen: "spice or botanical ingredient",
  superfood: "plant ingredient",
};

function readableList(items: string[]): string {
  if (items.length === 0) return "its listed nutrition data";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export interface PresentedIngredient extends Ingredient {
  /** Optional real food photography; the UI has a purpose-built fallback. */
  imageUrl: string | null;
  /** Never leave an empty image shell when no photo fits the ingredient. */
  gradient: string;
}

export function presentIngredient(ingredient: Ingredient): PresentedIngredient {
  const role = ingredient.slot ? `as a ${ingredient.slot}` : "for balance";
  const flavor = ingredient.flavors.length ? ` Its profile is ${readableList(ingredient.flavors)}.` : "";
  const highlights = readableList(ingredient.nutrientHighlights.slice(0, 3));
  const hex = ingredient.hex || "#64748B";

  return {
    ...ingredient,
    description: `${ingredient.name} is a ${CATEGORY_NOUN[ingredient.category] ?? "smoothie"} used ${role}.${flavor} The catalog highlights ${highlights}.`,
    imageUrl: STOCK_PHOTOS[ingredient.name] ?? null,
    gradient: `radial-gradient(circle at 18% 14%, rgba(255,255,255,.72), transparent 34%), linear-gradient(145deg, ${hex}, #172033)`,
  };
}
