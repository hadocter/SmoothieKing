import { apiFetch } from "../api";

/**
 * Mapping free text onto onboarding options.
 *
 * The step keys are the contract with the server. Adding a step means adding
 * it in `features/elicitation/steps.ts` on the API side and here — nowhere
 * else.
 */
export type AssistStep = "activity" | "allergies" | "goals" | "taste" | "effort";

export interface ProposedOption {
  id: string;
  label: string;
}

export interface AssistResponse {
  step: string;
  /** Which provider answered — "groq" or "keyword (fallback)". */
  answeredBy: string;
  proposed: ProposedOption[];
  confidence: "high" | "medium" | "low";
  message: string;
  /** They said something clear that no option covers. Not the same as empty. */
  outOfDomain: boolean;
  unmappedText: string;
  /** What they are preparing for, if they named it. Empty otherwise. */
  occasion: string;
  /** Weeks until it, only when the message actually said so. */
  timeframeWeeks: number | null;
}

/** The extras a caller may want to keep alongside the chosen options. */
export interface AssistExtras {
  occasion: string;
  timeframeWeeks: number | null;
}

export function proposeOptions(
  step: AssistStep,
  text: string,
  token: string | null = null,
): Promise<AssistResponse> {
  return apiFetch<AssistResponse>("/api/onboarding/assist", token, {
    method: "POST",
    body: { step, text },
  });
}

export { AssistBox } from "./AssistBox";
