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
  /**
   * What this option covers, in the words people actually use.
   *
   * Shown to the model alongside the label. Without it, "I want a muscular
   * body" was answered out-of-domain roughly a third of the time — the option
   * is called "Protein & Power" and nothing said that muscle belongs to it, so
   * a model told to be careful was careful in the wrong direction. Naming the
   * scope is not a hint to guess; it is the definition a person would need too.
   */
  covers?: string;
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
      { id: "sedentary", label: "Mostly Sedentary", covers: "desk job, little or no exercise" },
      { id: "light", label: "Lightly Active", covers: "occasional walks, exercise once or twice a week" },
      { id: "moderate", label: "Moderately Active", covers: "exercise three to five days a week" },
      { id: "active", label: "Very Active", covers: "hard training most days, lifting, running" },
      { id: "very_active", label: "Extremely Active", covers: "twice-daily or professional-level training" },
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
      { id: "glowy-skin", label: "Glowy Skin", covers: "skin, complexion, glow, dullness, breakouts, looking well" },
      { id: "hydration", label: "Deep Hydration", covers: "thirst, dryness, water intake, feeling parched" },
      { id: "sun-ritual", label: "Sun Ritual", covers: "protecting skin from sun exposure, being outdoors a lot, after burning" },
      { id: "protein-power", label: "Protein & Power", covers: "muscle, strength, getting bigger or leaner, lifting, recovery after training, a fit or muscular body" },
      { id: "anti-inflammatory", label: "Anti-Inflammatory", covers: "soreness, aching joints, recovery, feeling inflamed or puffy" },
      { id: "detox-clarity", label: "Detox & Clarity", covers: "feeling sluggish or heavy, wanting a reset, cutting sugar" },
      { id: "gut-health", label: "Gut Health", covers: "digestion, bloating, stomach trouble, regularity" },
      { id: "energy-focus", label: "Energy & Focus", covers: "tiredness, afternoon crashes, concentration, staying alert" },
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
      { id: "effort-quick", label: "Quick and small", covers: "in a rush, no time, grab and go" },
      { id: "effort-light", label: "Light", covers: "something small, not much, light" },
      { id: "effort-great", label: "Full and balanced", covers: "a proper one, balanced, worth the time" },
      { id: "effort-heavy", label: "Big — a meal", covers: "hungry, replacing a meal, big and filling" },
    ],
  },
  {
    key: "taste",
    question: "What do you like it to taste like?",
    multi: true,
    options: [
      { id: "sweet", label: "Sweet", covers: "sweet, sugary, fruity" },
      { id: "sour", label: "Tart & Citrus", covers: "tart, sharp, citrus, tangy" },
      { id: "nutty", label: "Nutty & Rich", covers: "nutty, rich, chocolatey, creamy" },
      { id: "fresh", label: "Fresh & Herbal", covers: "fresh, green, herbal, refreshing, clean" },
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
