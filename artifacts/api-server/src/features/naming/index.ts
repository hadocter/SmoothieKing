/**
 * Naming a drink and drafting its story.
 *
 * `nameDrink` never throws — see provider.ts for why a batch of ten must not
 * fail because one model call did.
 */
export * from "./naming.ts";
export { nameDrink, resolveNamingProvider, FallbackNamingProvider, type NamingProvider } from "./provider.ts";
