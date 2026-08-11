import { useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, Hand, ArrowRight, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { useAuth } from "@/lib/auth-context";
import { WeekShelf } from "./WeekShelf";
import { IngredientPicker } from "./IngredientPicker";
import { setWeekList, type WeekReview, type ListMode } from "./index";

/**
 * The week: what it needs, and what it has been.
 *
 * In that order, and the order is the point. A week whose ingredients have not
 * been decided opens on deciding them — knowing what is in the kitchen comes
 * before knowing what to make from it, and a Monday that starts by offering a
 * drink is offering it in the wrong order. Once the list is settled the panel
 * inverts: the summary leads, and the rollover controls move below it where
 * they are available without being asked for.
 *
 * The rollover starts from the fact that a new week does not start from
 * nothing — there is half a bag of oats left. So the first question is what
 * survived, and the three answers after it are the three decisions people
 * actually make.
 */
export function WeekPanel({
  review,
  onChanged,
  onSettled,
}: {
  review: WeekReview;
  /** Re-read after anything is written. The list, the marks and the count move together. */
  onChanged: () => void;
  /** Called the first time a week's list is decided, so the shell can move on. */
  onSettled?: () => void;
}) {
  const { token } = useAuth();
  const [leftovers, setLeftovers] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  async function choose(mode: ListMode, ingredients?: string[]) {
    setSaving(true);
    try {
      await setWeekList(
        {
          mode,
          keep: leftovers,
          ...(mode === "carried" ? { ingredients: review.previousWeek?.items ?? [] } : {}),
          ...(mode === "manual" ? { ingredients: ingredients ?? [] } : {}),
        },
        token,
      );
      setPicking(false);
      onChanged();
      if (!review.settled) onSettled?.();
    } finally {
      setSaving(false);
    }
  }

  if (!review.active) {
    return (
      <p className="text-sm text-muted-foreground">
        A week belongs to a goal. Set one and this fills in.
      </p>
    );
  }

  if (picking) {
    return (
      <IngredientPicker
        initial={leftovers}
        busy={saving}
        submitLabel="Use these this week"
        onCancel={() => setPicking(false)}
        onDone={(ingredients) => void choose("manual", ingredients)}
      />
    );
  }

  const rollover = (
    <Rollover
      review={review}
      leftovers={leftovers}
      setLeftovers={setLeftovers}
      saving={saving}
      onChoose={choose}
      onPick={() => setPicking(true)}
    />
  );

  /* -------------------------------------------------- not decided yet */
  if (!review.settled) {
    return (
      <div>
        <div className="flex items-start gap-3 mb-2">
          <ShoppingBasket className="w-6 h-6 text-primary shrink-0 mt-1" />
          <div>
            <h2 className="font-serif text-3xl font-medium leading-tight">
              {review.firstWeek ? "First, what you'll need" : `Week ${review.weekIndex} starts now`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {review.firstWeek
                ? "Sort the ingredients out and the drinks follow."
                : "New week, new list. Let's sort the ingredients first."}
            </p>
          </div>
        </div>
        <div className="mt-6">{rollover}</div>
      </div>
    );
  }

  /* -------------------------------------------------- settled */
  const s = review.summary!;
  const pct = Math.round(((review.daysElapsed ?? 0) / (review.daysTotal || 1)) * 100);

  return (
    <div className="space-y-8">
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
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
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
          <Figure value={s.protein === null ? "—" : `${s.protein}`} label="g protein" />
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

        {s.drinks.length > 0 ? (
          <ul className="mt-5 space-y-1.5">
            {s.drinks.slice(0, 5).map((d, i) => (
              <li key={`${d.id}-${i}`} className="flex items-baseline gap-3 text-sm">
                <span className="text-muted-foreground tabular-nums text-xs w-14 shrink-0">
                  {new Date(d.drankAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs ml-auto">
                  {d.calories === null ? "—" : `${d.calories} kcal`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-4">Nothing made this week yet.</p>
        )}
      </section>

      <section className="border-t pt-8">
        <WeekShelf />
      </section>

      {/* Available, not asked for. The list is already decided; changing it is
          something someone comes looking for rather than something to put in
          front of them every time they open the week. */}
      <details className="border-t pt-6 group">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground list-none">
          Change this week&rsquo;s list →
        </summary>
        <div className="mt-5">{rollover}</div>
      </details>
    </div>
  );
}

/** The leftovers question and the three answers. Shown alone before a week is
 *  decided, and tucked away once it is. */
function Rollover({
  review,
  leftovers,
  setLeftovers,
  saving,
  onChoose,
  onPick,
}: {
  review: WeekReview;
  leftovers: string[];
  setLeftovers: (fn: (l: string[]) => string[]) => void;
  saving: boolean;
  onChoose: (m: ListMode) => void;
  onPick: () => void;
}) {
  const previous = review.previousWeek?.items ?? [];

  return (
    <div>
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
            onClick={() => onChoose("carried")}
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
          onClick={() => onChoose("rebuilt")}
        />
        <Choice
          icon={Hand}
          title="I'll choose instead"
          line="Pick the ingredients yourself."
          busy={saving}
          onClick={onPick}
        />
      </div>
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
      <p className="font-medium text-sm flex items-center gap-1.5">
        {title}
        <ArrowRight className="w-3.5 h-3.5 opacity-40" />
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{line}</p>
    </button>
  );
}
