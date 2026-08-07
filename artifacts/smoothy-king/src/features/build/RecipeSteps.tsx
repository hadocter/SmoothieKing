import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import type { BuiltDrink, BuiltIngredient } from "./index";

/**
 * Making it.
 *
 * A scroll, not a deck. One card at a time meant you could not see what was
 * coming or check what you just did without paging backwards, which is the
 * wrong shape for something read standing at a blender — you look up, find
 * your place, and carry on. Everything is on the page and steps tick off as
 * you go.
 *
 * The overview that used to be a collapsed "everything at once" is now the top
 * of the page, where it does the job it was always doing: telling you what to
 * get out of the fridge before you start.
 *
 * Steps name the ingredient and its amount in their own right rather than
 * burying them in a sentence. "Pour in the coconut water first" is a nice line
 * and a bad instruction: at the blender you need the thing, the quantity and
 * the action, and prose makes you re-read to find all three.
 */

/** Pulls the ingredient a step is about out of the drink's own list. */
function ingredientFor(step: string, items: BuiltIngredient[]): BuiltIngredient | undefined {
  const lower = step.toLowerCase();
  // Longest name first: "almond milk" must win over "almond butter" when both
  // are present and the step mentions one of them.
  return [...items]
    .sort((a, b) => b.name.length - a.name.length)
    .find((i) => lower.includes(i.name.toLowerCase()));
}

/**
 * The verb, so the action can be shown apart from the explanation.
 *
 * Read off the step's own first word rather than stored — the steps are
 * generated as sentences and adding a parallel structured form would be two
 * descriptions of one instruction, free to disagree.
 */
function actionOf(step: string): string {
  const first = step.trim().split(/\s+/)[0].replace(/[^A-Za-z]/g, "");
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : "Add";
}

export function RecipeSteps({
  drink,
  onFinished,
  finishing,
}: {
  drink: BuiltDrink;
  onFinished: () => void;
  finishing: boolean;
}) {
  const steps = drink.steps.length > 0 ? drink.steps : ["Blend everything until smooth."];
  const [done, setDone] = useState<number[]>([]);

  const toggle = (i: number) =>
    setDone((prev) => (prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i]));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">
          Making it
        </span>
        <h1 className="font-serif text-4xl font-medium">{drink.name}</h1>
      </div>

      {/* What to get out first. */}
      <div className="rounded-2xl border bg-muted/30 p-5 mb-10">
        <h2 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">
          You&apos;ll need
        </h2>
        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {drink.ingredients.map((i, idx) => (
            <li key={idx} className="flex items-baseline gap-3 text-sm">
              <span className="font-semibold tabular-nums w-16 shrink-0 text-right">
                {i.amount}
                {i.unit}
              </span>
              <span>{i.name}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-4">
          {drink.prepTimeMinutes} minutes · {steps.length} steps
          {drink.calories !== null && ` · ${drink.calories} kcal`}
        </p>
      </div>

      <ol className="space-y-3 mb-10">
        {steps.map((step, i) => {
          const ticked = done.includes(i);
          const item = ingredientFor(step, drink.ingredients);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={ticked}
                className={`w-full text-left rounded-2xl border p-5 transition-all duration-200 flex gap-4 ${
                  ticked ? "bg-muted/40 border-border opacity-60" : "bg-card hover:border-primary/30"
                }`}
              >
                <span
                  className={`shrink-0 w-7 h-7 rounded-full grid place-items-center text-sm font-semibold mt-0.5 ${
                    ticked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ticked ? <Check className="w-4 h-4" /> : i + 1}
                </span>

                <div className="min-w-0">
                  {/* Thing, quantity, action — each in its own right, so none of
                      the three has to be hunted for in a sentence. */}
                  {item ? (
                    <div className={`mb-1.5 ${ticked ? "line-through" : ""}`}>
                      <span className="font-serif text-xl font-medium">{item.name}</span>
                      <span className="ml-2 text-xl font-semibold tabular-nums text-primary">
                        {item.amount}
                        {item.unit}
                      </span>
                      <span className="ml-2 text-sm uppercase tracking-widest text-muted-foreground">
                        {actionOf(step)}
                      </span>
                    </div>
                  ) : (
                    <div className={`font-serif text-xl font-medium mb-1.5 ${ticked ? "line-through" : ""}`}>
                      {actionOf(step)}
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex justify-between items-center gap-3 border-t pt-6">
        <span className="text-sm text-muted-foreground">
          {done.length} of {steps.length} done
        </span>
        {/* Not gated on ticking everything. The checkboxes are for keeping your
            place, not a form to complete — someone who made it from the top of
            the page should not have to tick six boxes to say so. */}
        <Button size="lg" className="rounded-full px-8 gap-2" disabled={finishing} onClick={onFinished}>
          <Check className="w-4 h-4" />
          {finishing ? "Saving…" : "Made it"}
        </Button>
      </div>
    </div>
  );
}
