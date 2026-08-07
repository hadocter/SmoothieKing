/**
 * Finding a recipe that fits a goal and is safe for whoever is asking.
 *
 * The read half of the flow; generation is the other half and lives in its own
 * feature, because "search what exists" and "build something new" fail for
 * different reasons and should be replaceable independently.
 */
export * from "./matching.ts";
