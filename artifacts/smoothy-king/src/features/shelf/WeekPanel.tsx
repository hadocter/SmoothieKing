import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { WeekShelf } from "./WeekShelf";
import { IngredientPicker } from "./IngredientPicker";
import { getWeekReview, setWeekList, type WeekReview, type ListMode } from "./index";

/**
 * The week: what it has been, and what it needs next.
 *
 * Two halves in the order a person cares about them. What happened — drinks
 * made, days kept up, what the goal got out of it — and then the list, which
 * is the only thing on this screen that asks anything of them.
 *
 * The rollover is the part worth getting right. A new week does not start from
 * nothing: there is usually half a bag of oats left, and a list that ignores
 * that is a list that costs money to follow. So the first question is what is
 * left, and the three answers after it are the three decisions people actually
 * make — keep what I had, build me something around the leftovers, or let me
 * choose.
 */
export function WeekPanel() {
  const { token } = useAuth();
  const [review, setReview] = useState<WeekReview | null>(null);
  const [leftovers, setLeftovers] = useState<string[]>([]);
  const [mode, setMode] = useState<"review" | "picking">("review");
  const [saving, setSaving] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getWeekReview(token)
      .then((r) => !cancelled && setReview(r))
      .catch(() => !cancelled && setReview({ active: false }));
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  async function choose(m: ListMode, ingredients?: string[]) {
    setSaving(true);
    try {
      await setWeekList(
        {
          mode: m,
          keep: leftovers,
          ...(m === "carried" ? { ingredients: review?.previousWeek?.items ?? [] } : {}),
          ...(m === "manual" ? { ingredients: ingredients ?? [] } : {}),
        },
        token,
      );
      setMode("review");
      // Re-read rather than patch: the list, the marks and the drink count all
      // move together, and reconstructing that here is a second copy of rules
      // the server just applied.
      setNonce((n) => n + 1);
    } finally {
      setSaving(false);
    }
  }

  if (review === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (!review.active) {
    return (
      <p className="text-sm text-muted-foreground">
        A week belongs to a goal. Set one and this fills in.
      </p>
    );
  }

  if (mode === "picking") {
    return (
      <IngredientPicker
        initial={leftovers}
        busy={saving}
        submitLabel="Use these this week"
        onCancel={() => setMode("review")}
        onDone={(ingredients) => void choose("manual", ingredients)}
      />
    );
  }

  const s = review.summary!;
  const previous = review.previousWeek?.items ?? [];
  const pct = Math.round(((review.daysElapsed ?? 0) / (review.daysTotal || 1)) * 100);

  return (
    <div className="space-y-8">
      {/* ---- what the week has been ---- */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-serif text-2xl font-medium">
            Week {review.weekIndex} of {review.weeksTotal}
          </h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            day {review.daysElapsed} of {review.daysTotal}
          </span>
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-5">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Figure value={String(s.drinks.length)} label="drinks made" />
          <Figure value={`${s.daysWithADrink}/${s.daysSoFar}`} label="days kept up" />
          {/* A week that cannot be added up says so, rather than reporting a
              total that quietly leaves drinks out. */}
          <Figure
            value={s.calories === null ? "—" : String(s.calories)}
            label={s.calories === null ? `kcal · ${s.unpriced} unknown` : "kcal this week"}
          />
          <Figure
            value={s.protein === null ? "—" : `${s.protein}`}
            label="g protein"
          />
        </div>

        {s.goals.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {s.goals.map((g) => (
              <span
                key={g.goal}
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${GOAL_COLORS[g.goal] ?? "bg-muted"}`}
              >
                {GOAL_LABELS[g.goal] ?? g.goal} · {g.drinks}
              </span>
            ))}
          </div>
        )}

        {s.drinks.length > 0 && (
          <ul className="mt-5 space-y-1.5">
            {s.drinks.slice(0, 5).map((d, i) => (
              <li key={`${d.id}-${i}`} className="flex items-baseline gap-3 text-sm">
                <span className="text-muted-foreground tabular-nums text-xs w-14 shrink-0">
                  {new Date(d.drankAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                </span>
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {d.calories === null ? "—" : `${d.calories} kcal`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {s.drinks.length === 0 && (
          <p className="text-sm text-muted-foreground mt-4">
            Nothing made this week yet.
          </p>
        )}
      </section>

      {/* ---- setting the list ---- */}
      <section className="border-t pt-8">
        {previous.length > 0 && (
          <>
            <h3 className="font-serif text-xl font-medium mb-1">Anything left from last week?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tap what you still have. We&rsquo;ll keep it in and not ask you to buy it again.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {previous.map((n) => {
                const on = leftovers.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setLeftovers((l) => (l.includes(n) ? l.filter((x) => x !== n) : [...l, n]))
                    }
                    className={`px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5 transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {on && <Check className="w-3.5 h-3.5" />}
                    {n}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="grid gap-2 sm:grid-cols-3">
          {previous.length > 0 && (
            <Choice
              icon={RotateCcw}
              title="Keep last week's"
              line="Same list again."
              busy={saving}
              onClick={() => void choose("carried")}
            />
          )}
          <Choice
            icon={Sparkles}
            title={leftovers.length > 0 ? "Build around what's left" : "Build me a list"}
            line={
              leftovers.length > 0
                ? `Keeps your ${leftovers.length} and fills in the rest.`
                : "Whatever this week's drinks will ask for."
            }
            busy={saving}
            onClick={() => void choose("rebuilt")}
          />
          <Choice
            icon={Hand}
            title="I'll choose instead"
            line="Pick the ingredients yourself."
            busy={saving}
            onClick={() => setMode("picking")}
          />
        </div>
      </section>

      {/* ---- the list itself ---- */}
      <section className="border-t pt-8">
        <WeekShelf key={nonce} />
      </section>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="font-serif text-2xl font-medium tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Choice({
  icon: Icon,
  title,
  line,
  busy,
  onClick,
}: {
  icon: typeof RotateCcw;
  title: string;
  line: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="text-left rounded-2xl border bg-card p-4 hover:border-primary/50 transition-colors disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="w-5 h-5 mb-2 animate-spin text-primary" />
      ) : (
        <Icon className="w-5 h-5 mb-2 text-primary" />
      )}
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{line}</p>
    </button>
  );
}
