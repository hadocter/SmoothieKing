import { useEffect, useState } from "react";

/**
 * The wait while drinks are being built.
 *
 * A spinner says "the computer is busy". This says "something is being worked
 * out for you", which is the difference between waiting and anticipating — and
 * it is true: the server really is building ten drinks, scoring each one and
 * naming the ones worth showing.
 *
 * The lines are the actual stages in order, so a longer wait means a later
 * line rather than a bar that fills at a rate nobody chose. If the work
 * finishes early the scene is unmounted mid-sentence, which is fine; nothing
 * here claims to be a progress bar.
 *
 * Respects prefers-reduced-motion by holding still and just naming the stage.
 */

const STAGES = [
  "Reading your goal",
  "Ruling out anything you can't have",
  "Choosing what goes in",
  "Balancing the glass",
  "Scoring each one against what you're after",
  "Naming the ones worth showing",
];

const STAGE_MS = 900;

function reduceMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BlendingScene({ goalHex = "#4A7C59" }: { goalHex?: string }) {
  const [stage, setStage] = useState(0);
  const still = reduceMotion();

  useEffect(() => {
    if (still) return;
    const id = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      STAGE_MS,
    );
    return () => window.clearInterval(id);
  }, [still]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-40 h-40 mb-10">
        {/* Three rings at different speeds. Not a spinner ring: they orbit a
            centre that is slowly taking on the goal's colour, so the shape
            reads as something coming together rather than something loading. */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`absolute inset-0 rounded-full border-2 ${still ? "" : "animate-spin"}`}
            style={{
              borderColor: `${goalHex}${["55", "33", "22"][i]}`,
              borderTopColor: goalHex,
              animationDuration: `${1.6 + i * 0.9}s`,
              animationDirection: i % 2 === 0 ? "normal" : "reverse",
              transform: `scale(${1 - i * 0.16})`,
            }}
          />
        ))}
        <span
          className={`absolute inset-[38%] rounded-full ${still ? "" : "animate-pulse"}`}
          style={{ background: goalHex, opacity: 0.85 }}
        />
      </div>

      <p className="font-serif text-2xl font-medium mb-2 text-center px-6">{STAGES[stage]}…</p>
      <p className="text-sm text-muted-foreground">Building a few for you to choose from.</p>

      <div className="flex gap-1.5 mt-8">
        {STAGES.map((_, i) => (
          <span
            key={i}
            className="w-6 h-1 rounded-full transition-colors duration-500"
            style={{ background: i <= stage ? goalHex : "hsl(var(--muted))" }}
          />
        ))}
      </div>
    </div>
  );
}
