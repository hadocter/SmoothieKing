/**
 * Choice assistance, behind a provider.
 *
 * Two implementations. Groq is the real one; the keyword provider is a
 * deterministic fallback that runs with no key, no network and no cost.
 *
 * The fallback is not a test stub. Onboarding is the first thing a new user
 * touches, and wiring it to a third-party API means an outage there becomes a
 * broken first impression here. With no key configured, or when the call
 * fails, the box keeps working on keywords and the user never learns which one
 * answered them. The buttons were always the primary path; this is assistance,
 * and assistance that takes the form down with it is not worth having.
 */

import { PROPOSE_SCHEMA, PROPOSE_SYSTEM } from "./schema.ts";
import { adaptPropose, type Proposal, type RawPropose } from "./adapt.ts";
import { stepByKey, UNSPECIFIED, type StepSpec } from "./steps.ts";

export interface AssistProvider {
  readonly name: string;
  propose(stepKey: string, userText: string): Promise<Proposal>;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * The server rejected the model's tool call as schema-invalid.
 *
 * Its own class so the caller can tell "the model answered badly" from "the
 * network is down". Groq validates tool arguments server-side and returns a
 * 400 for a malformed field, which is a content problem wearing an HTTP
 * error's clothes. Retrying cannot fix a schema mismatch, so it must not be
 * handled like a transport failure.
 */
class ToolCallRejected extends Error {
  constructor(detail: string) {
    super(`Tool call rejected by server-side validation: ${detail}`);
  }
}

/**
 * Rate limited. Worth waiting for, unlike everything else that can go wrong.
 *
 * A 429 says "ask again shortly"; a schema rejection says "this will never
 * work". Treating both as fatal is what made a burst of requests silently
 * degrade to keyword matching — 60% of calls during one measurement, and the
 * user has no way to tell, because the fallback answers in the same shape.
 */
class RateLimited extends Error {
  // A plain field, not a parameter property: Node runs these files by
  // stripping types, and `constructor(readonly x)` is syntax that has to be
  // compiled rather than erased. tsc accepts it; the test runner cannot load
  // the file at all.
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Rate limited, retry in ${retryAfterMs}ms`);
    this.retryAfterMs = retryAfterMs;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Small jitter so parallel axes do not retry in lockstep and collide again. */
const jitter = (ms: number) => ms + Math.random() * ms * 0.4;

function optionsPrompt(step: StepSpec): string {
  const lines = step.options
    .map((o) => `  - ${o.id}: ${o.label}${o.covers ? ` — covers ${o.covers}` : ""}`)
    .join("\n");
  return [
    `Step: ${step.key}`,
    `Question: ${step.question}`,
    `Choice: ${step.multi ? "one or more" : "exactly one"}`,
    "Options:",
    lines,
  ].join("\n");
}

export class GroqAssistProvider implements AssistProvider {
  readonly name = "groq";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.GROQ_MODEL ?? DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async propose(stepKey: string, userText: string): Promise<Proposal> {
    const step = stepByKey(stepKey);
    if (!step) throw new Error(`Unknown step "${stepKey}"`);

    // Two retries, because the limit is per-minute and a burst clears quickly.
    // Not more: past this the caller's fallback is a better answer than a user
    // watching a spinner.
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.callOnce(step, userText, stepKey);
      } catch (err) {
        if (!(err instanceof RateLimited) || attempt >= 2) throw err;
        await sleep(jitter(err.retryAfterMs));
      }
    }
  }

  private async callOnce(
    step: StepSpec,
    userText: string,
    stepKey: string,
  ): Promise<Proposal> {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        // The key comes from the environment and is never logged, echoed in a
        // response, or written to the database.
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        tool_choice: { type: "function", function: { name: "propose_options" } },
        tools: [
          {
            type: "function",
            function: {
              name: "propose_options",
              description: "Propose which of the step's options the user's message points to.",
              // The module constant, unmodified. See schema.ts for why this is
              // never narrowed to the current step.
              parameters: PROPOSE_SCHEMA,
            },
          },
        ],
        messages: [
          { role: "system", content: PROPOSE_SYSTEM },
          { role: "user", content: `${optionsPrompt(step)}\n\nUser said: "${userText}"` },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        // Groq sends a Retry-After in seconds when it has an opinion; a second
        // is a reasonable floor when it does not.
        const after = Number.parseFloat(res.headers.get("retry-after") ?? "");
        throw new RateLimited(Number.isFinite(after) ? after * 1000 : 1000);
      }
      const body = await res.text();
      if (res.status === 400 && body.includes("tool_use_failed")) {
        throw new ToolCallRejected(body.slice(0, 300));
      }
      // The body can echo request content; the status is enough to diagnose
      // without pasting a user's sentence into the logs.
      throw new Error(`Groq API error ${res.status}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (typeof args !== "string") return adaptPropose({}, stepKey, userText);

    let raw: RawPropose;
    try {
      raw = JSON.parse(args) as RawPropose;
    } catch {
      return adaptPropose({}, stepKey, userText);
    }
    return adaptPropose(raw, stepKey, userText);
  }
}

/**
 * Keyword matching over the step's own labels and a small synonym list.
 *
 * Deliberately literal. It exists so the feature degrades to something honest
 * rather than to nothing, and so the tests below can assert on behaviour
 * without a network call — not to imitate the model. Where it finds nothing it
 * says so, which is the same answer the model is asked to give in that case.
 */
export class KeywordAssistProvider implements AssistProvider {
  readonly name = "keyword";

  /**
   * Extra words that point at an option without containing its label.
   *
   * Short on purpose. Every entry is a claim that a word means an option, and
   * a long list of those written without evidence is just guessing at scale.
   */
  private static readonly HINTS: Record<string, string[]> = {
    sedentary: ["desk", "sitting", "no exercise", "hardly move"],
    light: ["walk", "occasional", "sometimes"],
    moderate: ["few times a week", "3 times", "moderate"],
    active: ["gym", "lift", "training", "run", "5 days", "6 days"],
    very_active: ["athlete", "twice a day", "every day", "intense"],
    Dairy: ["milk", "lactose", "cheese", "yogurt", "yoghurt"],
    "Tree Nuts": ["nut", "almond", "cashew", "walnut"],
    Soy: ["tofu", "soya"],
    Gluten: ["wheat", "celiac", "coeliac", "oat"],
    "glowy-skin": ["skin", "complexion", "glow", "acne"],
    hydration: ["hydrate", "water", "thirsty", "dry"],
    "sun-ritual": ["sun", "uv", "outdoors"],
    "protein-power": ["protein", "muscle", "lift", "gym", "recovery", "strength"],
    "anti-inflammatory": ["inflammation", "sore", "joint", "ache"],
    "detox-clarity": ["detox", "cleanse", "clarity", "reset"],
    "gut-health": ["gut", "digest", "bloat", "stomach", "bowel"],
    "energy-focus": ["energy", "focus", "tired", "concentrate", "slump", "crash", "alert"],
    "effort-quick": ["quick", "no time", "rush", "hurry", "fast"],
    "effort-light": ["light", "small", "not much", "just a"],
    "effort-great": ["proper", "full", "balanced", "good one"],
    "effort-heavy": ["big", "meal", "filling", "hungry", "replace"],
    sweet: ["sweet", "sugary"],
    sour: ["sour", "tart", "citrus", "lemon", "tangy"],
    nutty: ["nutty", "rich", "peanut", "chocolate"],
    fresh: ["fresh", "herbal", "green", "refreshing", "crisp", "clean"],
  };

  async propose(stepKey: string, userText: string): Promise<Proposal> {
    const step = stepByKey(stepKey);
    if (!step) throw new Error(`Unknown step "${stepKey}"`);

    const text = userText.toLowerCase();
    const hits = step.options.filter((o) => {
      if (text.includes(o.label.toLowerCase())) return true;
      return (KeywordAssistProvider.HINTS[o.id] ?? []).some((h) => text.includes(h));
    });

    // Routed through the same adapter as the model's output, so single-choice
    // truncation, deduplication and the empty case behave identically no
    // matter which provider answered.
    return adaptPropose(
      {
        stepKey,
        optionIds: hits.length > 0 ? hits.map((o) => o.id) : [UNSPECIFIED],
        confidence: hits.length > 0 ? "medium" : "low",
        message: hits.length > 0 ? `Matched on what you wrote: ${hits.map((o) => o.label).join(", ")}.` : "",
      },
      stepKey,
      userText,
    );
  }
}

/**
 * The provider this process uses.
 *
 * Groq when a key is present, keywords otherwise. Read once at import so a
 * request never has to think about configuration, and reported by name in the
 * response so it is visible which one answered.
 */
export function resolveProvider(): AssistProvider {
  const key = process.env.GROQ_API_KEY?.trim();
  const provider = (process.env.LLM_PROVIDER ?? "groq").trim().toLowerCase();
  if (provider !== "keyword" && key) return new GroqAssistProvider(key);
  return new KeywordAssistProvider();
}
