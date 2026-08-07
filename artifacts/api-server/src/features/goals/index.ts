/**
 * Goals and the periods they are pursued over.
 *
 * Domain only — see routes.ts for wiring. The claim register in goals.ts is
 * the part other features must not route around: anything that shows goal copy
 * reads it from here.
 */
export * from "./goals.ts";
