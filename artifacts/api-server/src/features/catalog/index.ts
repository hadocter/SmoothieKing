import { db, ingredientsTable } from "@workspace/db";
import type { BuildableIngredient } from "../generation/index.ts";

/**
 * The ingredient catalog, in the shape the other features need.
 *
 * One loader rather than one per feature. Scoring, safety and building each
 * read a different subset of the same columns, and three separate queries
 * would let three parts of one request disagree about what an ingredient is —
 * which, for the part that checks allergens, is not a theoretical problem.
 *
 * `BuildableIngredient` is a superset of what scoring and safety take, so this
 * satisfies all three without any of them seeing columns they do not use.
 */
export async function loadCatalog(): Promise<BuildableIngredient[]> {
  return db
    .select({
      name: ingredientsTable.name,
      benefits: ingredientsTable.benefits,
      proteinG: ingredientsTable.proteinG,
      servingGrams: ingredientsTable.servingGrams,
      contains: ingredientsTable.contains,
      animal: ingredientsTable.animal,
      slot: ingredientsTable.slot,
      hex: ingredientsTable.hex,
      flavors: ingredientsTable.flavors,
      kcal: ingredientsTable.kcal,
    })
    .from(ingredientsTable);
}
