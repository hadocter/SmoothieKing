/**
 * Allergen and diet checking.
 *
 * Domain only. `routes.ts` is imported directly by the router, not re-exported
 * here — a barrel that carries both makes every consumer of a pure function
 * pull in Express and the database, which is how the builder ended up unable
 * to be tested without a Postgres connection.
 */
export * from "./safety.ts";
