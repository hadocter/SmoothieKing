import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  getPickerCatalog,
  composeCheck,
  SLOT_LABEL,
  type SlotGroup,
  type CompositionReport,
} from "./index";

/**
 * Choosing the week's ingredients by hand.
 *
 * Open — any of the catalogue, as many as you like — and shaped, which is the
 * harder half. A drink is a fixed sequence of slots, so a selection with no
 * base and one flavour is not a smaller week, it is a week with no drinks in
 * it. Someone finding that out the next morning is finding out too late.
 *
 * The shaping is done by arranging rather than by forbidding. Ingredients are
 * grouped into the slots they fill, each group says what a drink takes from it
 * ("pick 2"), and a group still short is marked while they choose. Nothing is
 * disabled: the person can take five flavours and no sweetener, because both
 * are real answers. Only a selection that cannot build anything is refused,
 * and it is refused with the list of what is missing.
 *
 * The counting is the server's. A second implementation in the browser would
 * be a second opinion about what a drink needs, and the two would eventually
 * disagree in front of someone.
 */
export function IngredientPicker({
  initial = [],
  busy = false,
  submitLabel = "Use these",
  onCancel,
  onDone,
}: {
  initial?: string[];
  busy?: boolean;
  submitLabel?: string;
  onCancel: () => void;
  onDone: (ingredients: string[]) => void;
}) {
  const { token } = useAuth();
  const [groups, setGroups] = useState<SlotGroup[] | null>(null);
  const [chosen, setChosen] = useState<string[]>(initial);
  const [report, setReport] = useState<CompositionReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPickerCatalog(token)
      .then((c) => !cancelled && setGroups(c.slots))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Checked as they choose, so "you still need a base" arrives while it is
  // still easy to act on.
  useEffect(() => {
    let cancelled = false;
    composeCheck(chosen, token)
      .then((r) => !cancelled && setReport(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [chosen, token]);

  const picked = useMemo(() => new Set(chosen), [chosen]);
  const toggle = (name: string) =>
    setChosen((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]));

  const need = (slot: string) => report?.slots.find((s) => s.slot === slot);

  if (groups === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-serif text-2xl font-medium mb-1">Pick your own</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Anything you like, as much as you like. We only check it can still make a drink —
        each group says what one takes from it.
      </p>

      {/* Room for the sticky verdict, so the last group is never under it. */}
      <div className="space-y-6 pb-28">
        {groups.map((g) => {
          const req = need(g.slot);
          return (
            <div key={g.slot}>
              <div className="flex items-baseline gap-2 mb-2 pb-1.5 border-b">
                <span className="font-semibold text-sm">{SLOT_LABEL[g.slot] ?? g.slot}</span>
                <span className="text-xs text-muted-foreground">
                  {g.optional ? "optional" : g.picks === 1 ? "a drink takes 1" : `a drink takes ${g.picks}`}
                </span>
                <span
                  className={`text-xs ml-auto tabular-nums ${
                    req?.short ? "text-destructive font-medium" : "text-muted-foreground"
                  }`}
                >
                  {req?.chosen ?? 0} chosen
                  {req?.short && ` — need ${g.picks}`}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {g.ingredients.map((i) => {
                  const on = picked.has(i.name);
                  return (
                    <button
                      key={i.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(i.name)}
                      title={i.flavors.length > 0 ? i.flavors.join(", ") : undefined}
                      className={`px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5 transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {on && <Check className="w-3.5 h-3.5" />}
                      {i.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* The verdict, stated the whole time rather than on submit. */}
      <div
        className={`sticky bottom-4 mt-8 rounded-2xl border-2 p-4 backdrop-blur bg-background/90 ${
          report?.buildable ? "border-primary/40" : "border-destructive/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            {report === null ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
              </p>
            ) : report.buildable ? (
              <p className="text-sm">
                <span className="font-medium">{chosen.length} ingredients</span> ·{" "}
                {/* Counted the same way as the 440,640 on the landing page. */}
                makes <span className="font-medium">{report.drinksPossible} different drinks</span>
              </p>
            ) : (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Still need{" "}
                {report.missing.map((m) => (SLOT_LABEL[m] ?? m).toLowerCase()).join(", ")}
              </p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>
              Back
            </Button>
            <Button
              size="sm"
              className="rounded-full px-6"
              disabled={!report?.buildable || busy}
              onClick={() => onDone(chosen)}
            >
              {busy ? "Saving…" : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
