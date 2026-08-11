import type { Ingredient } from "@workspace/db";
import { INGREDIENT_PHOTOS } from "./food-photos.generated.ts";

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

/**
 * Ingredient name to its bundled photo path, or null for the gradient.
 *
 * The photos are searched by name and downloaded into the web app's static
 * folder by scripts/fetch-food-photos.mjs, so nothing is loaded from
 * unsplash.com at runtime — a demo cannot be broken by their CDN. The list
 * this replaced was a hand-typed set of remote URLs that mapped Coconut Water
 * to a photo of salmon and gave three different ingredients the same picture.
 *
 * Only names in the generated manifest get a URL; an ingredient with no
 * fitting photo returns null and the card shows its own gradient. So a missing
 * photo is a deliberate absence rather than a broken image request.
 */
function photoFor(name: string): string | null {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return INGREDIENT_PHOTOS.has(slug) ? `/food/ingredients/${slug}.jpg` : null;
}

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
    imageUrl: photoFor(ingredient.name),
    gradient: `radial-gradient(circle at 18% 14%, rgba(255,255,255,.72), transparent 34%), linear-gradient(145deg, ${hex}, #172033)`,
  };
}
