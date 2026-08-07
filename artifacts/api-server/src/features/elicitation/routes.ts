import { Router, type IRouter } from "express";
import { logger } from "../../lib/logger.ts";
import { STEP_KEYS, stepByKey } from "./steps.ts";
import { KeywordAssistProvider, resolveProvider } from "./provider.ts";

const router: IRouter = Router();

const provider = resolveProvider();
const fallback = new KeywordAssistProvider();

/** Long enough for a real answer, short enough not to be a prompt-injection canvas. */
const MAX_TEXT = 500;

/**
 * Map a free-text sentence onto one onboarding step's options.
 *
 *   POST /api/onboarding/assist  { step: "goals", text: "..." }
 *
 * The response is a *suggestion*. It highlights buttons; it never sets
 * anything. Onboarding still submits through the same endpoint it always did,
 * with whatever the user actually tapped, so nothing a model returns can reach
 * a profile without a person having agreed to it in the UI.
 *
 * That matters most on the allergies step. A model that misses an allergy is
 * dangerous in a way a model that misses a taste preference is not, and the
 * only safe shape for this is one where a proposal can add a candidate chip
 * and can never tick, untick, or remove one on its own.
 */
router.post("/onboarding/assist", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const step = typeof body.step === "string" ? body.step : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";

  if (!stepByKey(step)) {
    res.status(400).json({ error: `step must be one of: ${STEP_KEYS.join(", ")}` });
    return;
  }
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  if (text.length > MAX_TEXT) {
    res.status(400).json({ error: `text must be ${MAX_TEXT} characters or fewer` });
    return;
  }

  let proposal;
  let answeredBy = provider.name;

  try {
    proposal = await provider.propose(step, text);
  } catch (err) {
    // Onboarding does not fail because a third party did. The keyword provider
    // answers instead, and the response says which one did — degrading quietly
    // into something worse without saying so is how a feature stops being
    // trustworthy.
    logger.warn({ err, step, provider: provider.name }, "Assist provider failed; using keyword fallback");
    proposal = await fallback.propose(step, text);
    answeredBy = `${fallback.name} (fallback)`;
  }

  res.json({
    step,
    answeredBy,
    // Options to highlight. The client is expected to require a tap.
    proposed: proposal.proposed,
    confidence: proposal.confidence,
    message: proposal.message,
    // True when they said something clear that no option covers. Distinct from
    // an empty proposal, and the client should say something different for it.
    outOfDomain: proposal.outOfDomain,
    unmappedText: proposal.unmappedText,
  });
});

export default router;
