/**
 * The onboarding options a free-text message can be mapped onto.
 *
 * Onboarding already works: four steps of buttons and chips, and nothing here
 * replaces any of it. What this adds is a second way in — type "I lift four
 * times a week and I'm trying to cut sugar" and get the buttons that sentence
 * points at, pre-highlighted, still needing a tap.
 *
 * Every option id below is the value the existing UI already stores, taken
 * from the page rather than re-invented. If these drift from the page the
 * proposals become unclickable, so the ids are the contract.
 */

/** Said nothing about this step. Distinct from "said something unmatched". */
export const UNSPECIFIED = "UNSPECIFIED";

/**
 * Said something clear that no option covers.
 *
 * The distinction from UNSPECIFIED is the whole point of having two sentinels.
 * Silence and "I want it to help my migraines" are different facts, and
 * collapsing them means the second one gets recorded as the user having said
 * nothing — which is how a system ends up confidently wrong about someone.
 */
export const OUT_OF_DOMAIN = "OUT_OF_DOMAIN";

export interface StepOption {
  id: string;
  label: string;
}

export interface StepSpec {
  key: string;
  /** What the step asks, used as context in the prompt. */
  question: string;
  /** Whether more than one option can be proposed at once. */
  multi: boolean;
  options: StepOption[];
}

/**
 * The four steps that take a categorical answer.
 *
 * Step 1's age, height and weight are numbers and a text box that guesses at
 * someone's weight would be worse than the field already there; only activity
 * level is a set of choices. Disliked ingredients are deliberately not here
 * either: that would mean mapping free text onto ingredient names, and name
 * matching is the failure this codebase already had once. The chip picker
 * handles it exactly and does not need help.
 */
export const STEPS: StepSpec[] = [
  {
    key: "activity",
    question: "How active are you?",
    multi: false,
    options: [
      { id: "sedentary", label: "Mostly Sedentary" },
      { id: "light", label: "Lightly Active" },
      { id: "moderate", label: "Moderately Active" },
      { id: "active", label: "Very Active" },
      { id: "very_active", label: "Extremely Active" },
    ],
  },
  {
    key: "allergies",
    question: "Anything you need filtered out?",
    multi: true,
    // The labels the page shows and the profile stores. The mapping from these
    // to catalog allergen ids lives in safety.ts and is not this module's job.
    options: [
      { id: "Dairy", label: "Dairy" },
      { id: "Tree Nuts", label: "Tree Nuts" },
      { id: "Soy", label: "Soy" },
      { id: "Gluten", label: "Gluten" },
      { id: "Shellfish", label: "Shellfish" },
      { id: "Egg", label: "Egg" },
      { id: "Banana", label: "Banana" },
      { id: "Peach", label: "Peach" },
      { id: "Kiwi", label: "Kiwi" },
    ],
  },
  {
    key: "goals",
    question: "What are you hoping this does for you?",
    multi: true,
    options: [
      { id: "glowy-skin", label: "Glowy Skin" },
      { id: "hydration", label: "Deep Hydration" },
      { id: "sun-ritual", label: "Sun Ritual" },
      { id: "protein-power", label: "Protein & Power" },
      { id: "anti-inflammatory", label: "Anti-Inflammatory" },
      { id: "detox-clarity", label: "Detox & Clarity" },
      { id: "gut-health", label: "Gut Health" },
      { id: "energy-focus", label: "Energy & Focus" },
    ],
  },
  {
    // Effort, as its own axis. "light one" and "no time" are answers about
    // the drink's size and how much handling it takes, and there was nowhere
    // for them to land — a sentence like "just refreshing, light one" came
    // back as no match at all, because the only thing being asked about was
    // goals.
    //
    // The ids are prefixed rather than reusing the preset names directly, so
    // no id belongs to two steps. That uniqueness is what lets a proposal be
    // validated against the step it was asked about.
    key: "effort",
    question: "How much of a drink, and how much work?",
    multi: false,
    options: [
      { id: "effort-quick", label: "Quick and small" },
      { id: "effort-light", label: "Light" },
      { id: "effort-great", label: "Full and balanced" },
      { id: "effort-heavy", label: "Big — a meal" },
    ],
  },
  {
    key: "taste",
    question: "What do you like it to taste like?",
    multi: true,
    options: [
      { id: "sweet", label: "Sweet" },
      { id: "sour", label: "Tart & Citrus" },
      { id: "nutty", label: "Nutty & Rich" },
      { id: "fresh", label: "Fresh & Herbal" },
    ],
  },
];

export const STEP_KEYS = STEPS.map((s) => s.key);

export const stepByKey = (key: string): StepSpec | undefined =>
  STEPS.find((s) => s.key === key);

/**
 * Every option id across every step, in one flat list.
 *
 * The schema needs one enum because the schema is frozen — see schema.ts. It
 * is the caller's job, not the model's, to know that "sweet" belongs to the
 * taste step and not to the goals step.
 */
export const ALL_OPTION_IDS = STEPS.flatMap((s) => s.options.map((o) => o.id));

/** Whether an id is one of the options for a given step. */
export function belongsToStep(stepKey: string, id: string): boolean {
  return stepByKey(stepKey)?.options.some((o) => o.id === id) ?? false;
}
