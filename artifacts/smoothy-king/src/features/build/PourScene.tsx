import { useEffect, useRef, useState } from "react";
import type { BuiltDrink } from "./index";

/**
 * The chosen drink being assembled.
 *
 * Ingredients land one at a time, the glass fills and takes the drink's
 * colour, and the numbers underneath climb as they go. It is the moment the
 * choice becomes a thing rather than a card.
 *
 * The numbers are real. Each ingredient's own contribution is added as it
 * lands, so the total at the end is the total the server computed rather than
 * a figure animated toward independently — an animation that arrives at a
 * different number than the recipe would be a lie told slowly.
 *
 * A total the server could not compute stays uncomputable here. Some
 * ingredients have no USDA figure, and a counter cannot climb to null: the
 * calorie readout says so instead of resolving to a confident zero.
 *
 * Respects prefers-reduced-motion by showing the finished glass at once.
 */

const STEP_MS = 620;

function reduceMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Parses the stored `amount` back to a number for the fill maths. */
const grams = (amount: string): number => {
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
};

export function PourScene({
  drink,
  onDone,
}: {
  drink: BuiltDrink;
  onDone: () => void;
}) {
  const items = drink.ingredients;
  const still = reduceMotion();
  const [landed, setLanded] = useState(still ? items.length : 0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (still) return;
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 1;
      setLanded(n);
      if (n >= items.length && timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, STEP_MS);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [items.length, still]);

  const done = landed >= items.length;

  const totalGrams = items.reduce((sum, i) => sum + grams(i.amount), 0);
  const pouredGrams = items.slice(0, landed).reduce((sum, i) => sum + grams(i.amount), 0);
  const fillPct = totalGrams > 0 ? Math.round((pouredGrams / totalGrams) * 100) : 0;

  // Proportional to how much of the glass has landed, so the figures and the
  // liquid tell the same story, and both end exactly on the recipe's own.
  const share = totalGrams > 0 ? pouredGrams / totalGrams : 0;
  const kcal = drink.calories === null ? null : Math.round(drink.calories * share);
  const protein = drink.protein === null ? null : Math.round(drink.protein * share * 10) / 10;
  const fit = Math.round(drink.matchScore * 100 * share);

  const css = drink.appearance?.css ?? "linear-gradient(160deg, #d8cfc2, #a89684)";
  const blend = drink.appearance?.blend ?? "#c9bcae";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        {/* The glass */}
        <div className="flex justify-center">
          <div
            className="relative w-48 h-72 rounded-b-[2.5rem] rounded-t-xl border-4 border-foreground/10 overflow-hidden bg-background/40"
            role="img"
            aria-label={`${fillPct}% poured`}
          >
            <div
              className="absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out"
              style={{ height: `${fillPct}%`, background: css }}
            />
            {/* A surface line, so the liquid reads as liquid rather than as a
                bar chart standing on end. */}
            <div
              className="absolute inset-x-0 transition-[bottom] duration-500 ease-out"
              style={{
                bottom: `calc(${fillPct}% - 4px)`,
                height: 8,
                background: blend,
                opacity: fillPct > 0 ? 0.55 : 0,
                filter: "blur(3px)",
              }}
            />
          </div>
        </div>

        {/* What is going in */}
        <div>
          <h2 className="font-serif text-3xl font-medium mb-1">{drink.name}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {done ? "Ready." : `Pouring — ${landed} of ${items.length}`}
          </p>

          <ul className="space-y-1.5">
            {items.map((i, idx) => {
              const shown = idx < landed;
              return (
                <li
                  key={`${i.name}-${idx}`}
                  className={`flex items-baseline gap-3 rounded-xl px-3 py-2 transition-all duration-300 ${
                    shown ? "opacity-100 translate-x-0 bg-card" : "opacity-0 translate-x-3"
                  }`}
                >
                  <span className="text-sm font-medium">{i.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {i.amount}
                    {i.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* The numbers */}
      <div className="grid grid-cols-3 gap-4 mt-10">
        <Figure
          label="Calories"
          /* Null cannot be counted up to. Saying so beats resolving to zero,
             which would read as a fact rather than as a gap. */
          value={kcal === null ? "—" : String(kcal)}
          note={drink.calories === null ? "not known for this one" : "kcal"}
        />
        <Figure
          label="Protein"
          value={protein === null ? "—" : `${protein}`}
          note={drink.protein === null ? "not known for this one" : "grams"}
        />
        <Figure label="Fit for your goal" value={`${fit}%`} note="of what you're after" />
      </div>

      <div className="flex justify-end mt-10 pt-6 border-t">
        <button
          type="button"
          onClick={onDone}
          disabled={!done}
          className="px-8 py-3 rounded-full bg-primary text-primary-foreground font-medium text-lg disabled:opacity-40 transition-opacity"
        >
          {done ? "Show me how to make it" : "Pouring…"}
        </button>
      </div>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 text-center">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className="font-serif text-4xl font-medium tabular-nums transition-all duration-300">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{note}</div>
    </div>
  );
}
