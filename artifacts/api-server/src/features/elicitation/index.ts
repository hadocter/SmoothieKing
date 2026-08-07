/**
 * Mapping free text onto onboarding options.
 *
 * Only the step catalog and the proposal type are public. The schema, the
 * adapter and the providers are internals — swapping the model out should not
 * be visible from outside this folder.
 */
export { STEPS, STEP_KEYS, stepByKey, type StepOption, type StepSpec } from "./steps.ts";
export type { Proposal } from "./adapt.ts";
