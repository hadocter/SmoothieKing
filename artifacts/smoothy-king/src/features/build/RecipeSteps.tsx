import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
import type { BuiltDrink } from "./index";

/**
 * Making it, one step at a time.
 *
 * One step on screen at a time rather than a numbered list, because this is
 * read standing at a blender with one hand free. A list is for planning; this
 * is for doing.
 *
 * Reaching the end is what counts as having made and drunk it, and that is
 * where the consumption log is written — not at generation. A batch produces
 * ten drinks and a person has one of them, so logging earlier would record
 * nine that never happened, and nothing later recovers from a history that was
 * wrong when it was written.
 *
 * Steps can be gone back through. Someone who taps ahead by accident should
 * not have to restart the recipe, and the log is only written at the end.
 */
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
  const [at, setAt] = useState(0);
  const last = at >= steps.length - 1;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <span className="text-primary font-bold text-sm tracking-widest uppercase mb-2 block">
          Making it
        </span>
        <h1 className="font-serif text-4xl font-medium">{drink.name}</h1>
      </div>

      <div className="flex gap-1.5 mb-8">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= at ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <div className="rounded-3xl border bg-card p-8 min-h-[14rem] flex flex-col justify-center mb-8">
        <div className="text-sm text-muted-foreground mb-3">
          Step {at + 1} of {steps.length}
        </div>
        <p className="font-serif text-2xl leading-relaxed">{steps[at]}</p>
      </div>

      {/* The full list stays available underneath. The one-at-a-time view is
          for doing; someone who wants to see the whole thing should not have
          to page through it. */}
      <details className="mb-8 rounded-2xl border bg-muted/30 p-4">
        <summary className="text-sm font-medium cursor-pointer">Everything at once</summary>
        <ul className="mt-4 space-y-2">
          {drink.ingredients.map((i, idx) => (
            <li key={idx} className="text-sm flex gap-3">
              <span className="text-muted-foreground w-16 shrink-0 tabular-nums">
                {i.amount}
                {i.unit}
              </span>
              <span>{i.name}</span>
            </li>
          ))}
        </ul>
        <ol className="mt-4 space-y-1.5 list-decimal list-inside text-sm text-muted-foreground">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>

      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          className="rounded-full px-6"
          disabled={at === 0}
          onClick={() => setAt((n) => Math.max(0, n - 1))}
        >
          Back
        </Button>

        {last ? (
          <Button
            size="lg"
            className="rounded-full px-8 gap-2"
            disabled={finishing}
            onClick={onFinished}
          >
            <Check className="w-4 h-4" />
            {finishing ? "Saving…" : "Made it"}
          </Button>
        ) : (
          <Button
            size="lg"
            className="rounded-full px-8 gap-2"
            onClick={() => setAt((n) => Math.min(steps.length - 1, n + 1))}
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
