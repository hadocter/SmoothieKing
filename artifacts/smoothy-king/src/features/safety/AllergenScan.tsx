import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldAlert, Check, X, Loader2 } from "lucide-react";
import { hasConstraints, type SafetyReport } from "./index";

/**
 * The allergen check, shown happening.
 *
 * Every ingredient is named, weighed against every stated allergy, and cleared
 * or flagged, one at a time. The verdicts are the server's — this component
 * paces them, it does not compute them. Showing a check that was decided
 * somewhere else, or worse re-deciding it in the browser where it could
 * disagree, would make the reassuring part of this the part that is not true.
 *
 * It only appears when the user has actually stated an allergy. A verification
 * scene for someone with nothing to verify is theatre, and theatre here would
 * teach people to skip past the one screen that matters when they do have
 * something to declare.
 *
 * Respects prefers-reduced-motion by showing the finished result immediately.
 */

const STEP_MS = 420;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AllergenScan({ report }: { report: SafetyReport }) {
  const stated = hasConstraints(report);

  const [revealed, setRevealed] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!stated) return;
    if (prefersReducedMotion()) {
      setRevealed(report.checks.length);
      return;
    }
    setRevealed(0);
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= report.checks.length && timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }, STEP_MS);
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, [report, stated]);

  if (!stated) return null;

  const done = revealed >= report.checks.length;
  const labels = [
    ...report.checkedAgainst.allergens,
    ...report.checkedAgainst.excludedNames,
    ...(report.checkedAgainst.vegan ? ["animal products"] : []),
  ];

  return (
    <div
      className={`rounded-3xl border-2 p-6 transition-colors duration-700 ${
        done
          ? report.safe
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-destructive/40 bg-destructive/5"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-3 mb-1">
        {!done ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : report.safe ? (
          <ShieldCheck className="w-5 h-5 text-emerald-600 animate-in zoom-in duration-500" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-destructive animate-in zoom-in duration-500" />
        )}
        <h3 className="font-serif text-xl font-medium">
          {!done ? "Checking every ingredient…" : report.safe ? "Clear" : "Not clear"}
        </h3>
      </div>

      <p className="text-sm text-muted-foreground mb-5">
        Checked against {labels.join(", ")}. Ingredient by ingredient, no guessing.
      </p>

      <ul className="space-y-1.5">
        {report.checks.map((c, i) => {
          const shown = i < revealed;
          return (
            <li
              key={`${c.name}-${i}`}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300 ${
                shown ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
              } ${c.passed ? "bg-background/60" : "bg-destructive/10"}`}
            >
              <span
                className={`shrink-0 w-6 h-6 rounded-full grid place-items-center ${
                  c.passed ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/20 text-destructive"
                }`}
              >
                {c.passed ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              </span>

              <span className="font-medium text-sm">{c.name}</span>

              <span className="ml-auto text-xs text-muted-foreground">
                {c.violations.length > 0
                  ? `contains ${c.violations.join(", ")}`
                  : c.contains.length > 0
                    ? `${c.contains.join(", ")} — not one of yours`
                    : "nothing to declare"}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Said out loud rather than folded into the pass/fail. A constraint we
          could not enforce is not a constraint that passed, and the difference
          matters most to the person who stated it. */}
      {done && report.unresolvedConstraints.length > 0 && (
        <p className="text-sm text-muted-foreground mt-5 border-t pt-4">
          We don&apos;t track {report.unresolvedConstraints.join(", ")} in our ingredients, so this check
          couldn&apos;t cover it.
        </p>
      )}

      {done && report.unknownIngredients.length > 0 && (
        <p className="text-sm text-destructive mt-3">
          {report.unknownIngredients.join(", ")} isn&apos;t in our ingredient list, so we can&apos;t say
          what&apos;s in it.
        </p>
      )}
    </div>
  );
}
