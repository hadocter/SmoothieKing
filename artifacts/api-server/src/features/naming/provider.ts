/**
 * The naming provider.
 *
 * Same shape as the elicitation feature's: Groq when a key is present, a
 * written fallback otherwise, and the caller is told which one answered. The
 * two features deliberately do not share a client — they use different
 * response modes (JSON object here, tool calling there) and coupling them
 * would mean one feature's model choice constrained the other's.
 */

import {
  adaptNaming,
  fallbackNaming,
  namingPrompt,
  NAMING_SYSTEM,
  type NamingInput,
  type NamingResult,
} from "./naming.ts";

export interface NamingProvider {
  readonly name: string;
  write(input: NamingInput): Promise<NamingResult>;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqNamingProvider implements NamingProvider {
  readonly name = "groq";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = process.env.GROQ_MODEL ?? DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async write(input: NamingInput): Promise<NamingResult> {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        // From the environment. Never logged, echoed or stored.
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: NAMING_SYSTEM },
          { role: "user", content: namingPrompt(input) },
        ],
      }),
    });

    // The status only — the body can echo request content, and a user's
    // ingredient list does not belong in the logs.
    if (!res.ok) throw new Error(`Groq API error ${res.status}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") return adaptNaming({}, input, this.name);

    try {
      return adaptNaming(JSON.parse(content) as { name?: unknown; story?: unknown }, input, this.name);
    } catch {
      return adaptNaming({}, input, this.name);
    }
  }
}

export class FallbackNamingProvider implements NamingProvider {
  readonly name = "fallback";
  async write(input: NamingInput): Promise<NamingResult> {
    return fallbackNaming(input);
  }
}

const fallback = new FallbackNamingProvider();

export function resolveNamingProvider(): NamingProvider {
  const key = process.env.GROQ_API_KEY?.trim();
  const provider = (process.env.LLM_PROVIDER ?? "groq").trim().toLowerCase();
  if (provider !== "keyword" && key) return new GroqNamingProvider(key);
  return fallback;
}

/**
 * Name a drink, never failing.
 *
 * Generation produces a batch of ten and each one needs a name. A model call
 * that throws would take the whole batch down, and a batch failing because a
 * third party is slow is a much worse outcome than a batch of plainly-named
 * drinks. The caller gets a name either way and can see which it is.
 */
export async function nameDrink(
  input: NamingInput,
  provider: NamingProvider = resolveNamingProvider(),
): Promise<NamingResult> {
  try {
    return await provider.write(input);
  } catch {
    return fallbackNaming(input);
  }
}
