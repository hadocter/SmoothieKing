import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShoppingBasket, Check, Repeat2, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  getWeekShelf,
  markIngredient,
  getSubstitutes,
  SHELF_ANSWERS,
  SLOT_LABEL,
  type ShelfItem,
  type ShelfState,
  type Substitute,
  type WeekShelf as Shelf,
} from "./index";

/**
 * What this week asks you to have in.
 *
 * The list is not a nutritionist's opinion — it is the builder run repeatedly
 * against this person's goal, with the ingredients it reaches for most often
 * put in front of them. So it cannot recommend something the builder would
 * never pick, and the count underneath ("these nine make forty drinks") is
 * measured by building against the list rather than estimated.
 *
 * Three answers, because there are three. Something you own, something you are
 * going to buy, and something you are not. Collapsing the last two into
 * "missing" would lose the only distinction that changes what we do: a thing
 * being bought this afternoon should still appear in tonight's drinks, and a
 * thing refused should be built around.
 */
export function WeekShelf() {
  const { token } = useAuth();
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [swaps, setSwaps] = useState<{ options: Substitute[]; note: string | null } | null>(null);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getWeekShelf(token)
      .then((s) => !cancelled && setShelf(s))
      .catch(() => !cancelled && setShelf({ active: false, weekIndex: null, drinksPossible: 0, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!shelf?.items.length) return;
    setRevealed(0);
    const timer = window.setInterval(() => {
      setRevealed((count) => {
        if (count >= shelf.items.length) {
          window.clearInterval(timer);
          return count;
        }
        return count + 1;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [shelf?.weekIndex, shelf?.items.length]);

  async function answer(item: ShelfItem, state: ShelfState) {
    // Tapping the answer already showing clears it — "I haven't decided" is a
    // state someone can go back to, and is not the same as skipping.
    const next = item.state === state ? null : state;
    setPending(item.name);
    try {
      await markIngredient(item.name, next, token);
      setShelf((s) =>
        s === null
          ? s
          : {
              ...s,
              items: s.items.map((i) =>
                i.name === item.name ? { ...i, state: next, substitute: null } : i,
              ),
            },
      );
      if (next === "skipping") void openSwaps(item.name);
      else if (swapFor === item.name) setSwapFor(null);
    } finally {
      setPending(null);
    }
  }

  async function chooseSwap(item: ShelfItem, substitute: string | null) {
    setPending(item.name);
    try {
      const saved = await markIngredient(item.name, "skipping", token, substitute);
      setShelf((s) =>
        s === null
          ? s
          : {
              ...s,
              items: s.items.map((i) =>
                i.name === item.name ? { ...i, state: "skipping", substitute: saved.substitute } : i,
              ),
            },
      );
      setSwapFor(null);
    } finally {
      setPending(null);
    }
  }

  async function openSwaps(name: string) {
    setSwapFor(name);
    setSwaps(null);
    try {
      const r = await getSubstitutes(name, token);
      setSwaps({ options: r.options, note: r.note });
    } catch {
      setSwaps({ options: [], note: "We couldn't look up alternatives just now." });
    }
  }

  if (shelf === null) {
    return (
      <div className="rounded-3xl border bg-card p-6 overflow-hidden relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
        <div className="flex items-center gap-3 mb-5">
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-5 animate-pulse" />
          </span>
          <div>
            <p className="font-serif text-xl font-medium">Building this week&rsquo;s shelf</p>
            <p className="text-sm text-muted-foreground">Balancing the drink structure around your goal…</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {["Choosing a base and protein", "Adding flavour variety", "Checking the list can make real drinks"].map((line, index) => (
            <div key={line} className="flex items-center gap-2 text-sm text-muted-foreground" style={{ animationDelay: `${index * 160}ms` }}>
              <Loader2 className="size-3.5 animate-spin text-primary" />
              {line}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!shelf.active) {
    return (
      <div className="rounded-2xl border border-dashed bg-card/50 p-6 text-center">
        <p className="font-medium mb-1">No goal running</p>
        <p className="text-sm text-muted-foreground mb-4">
          A shopping list is a week of a goal. Set one and this fills in.
        </p>
        <Link href="/goal">
          <Button size="sm" className="rounded-full">
            Set a goal
          </Button>
        </Link>
      </div>
    );
  }

  const buying = shelf.items.filter((i) => i.state === "buying");
  const answered = shelf.items.filter((i) => i.state !== null).length;

  return (
    <div>
      <div className="flex items-start gap-3 mb-2">
        <ShoppingBasket className="w-6 h-6 text-primary shrink-0 mt-1" />
        <div>
          <h2 className="font-serif text-3xl font-medium leading-tight">
            This week, you&rsquo;ll need
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Week {shelf.weekIndex} of {shelf.weeksTotal} ·{" "}
            {/* The figure is built from the list, not asserted about it. */}
            these {shelf.items.length} make{" "}
            <span className="font-medium text-foreground">{shelf.drinksPossible} different drinks</span>{" "}
            that fit your goal
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-6">
        {shelf.daysLeftInWeek === 1
          ? "A new list tomorrow."
          : `A new list in ${shelf.daysLeftInWeek} days.`}{" "}
        Amounts aren&rsquo;t fixed — what you make each day depends on the time and taste you
        pick that morning.
      </p>

      <ul className="space-y-2">
        {shelf.items.map((item, index) => (
          <li
            key={item.name}
            className="transition-all duration-500 ease-out"
            style={{ opacity: index < revealed ? 1 : 0, transform: index < revealed ? "translateY(0)" : "translateY(12px)" }}
          >
            <div
              className={`rounded-2xl border p-4 transition-colors ${
                item.state === "skipping"
                  ? "bg-muted/40 border-border"
                  : item.state
                    ? "border-primary/40 bg-card"
                    : "bg-card"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-x-3 sm:gap-y-2">
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium ${item.state === "skipping" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SLOT_LABEL[item.slot] ?? item.slot}
                    {item.essential && " · needed for every drink"}
                    {" · in "}
                    {item.usedIn} of this week&rsquo;s builds
                  </p>
                  {item.substitute && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Using {item.substitute} instead this week
                    </p>
                  )}
                </div>

                <div className="flex w-full gap-1.5 shrink-0 self-start sm:w-auto sm:self-auto">
                  {SHELF_ANSWERS.map((a) => (
                    <button
                      key={a.state}
                      type="button"
                      title={a.hint}
                      aria-pressed={item.state === a.state}
                      disabled={pending === item.name}
                      onClick={() => void answer(item, a.state)}
                      className={`flex-1 sm:flex-none px-3 py-1.5 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 ${
                        item.state === a.state
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {pending === item.name && item.state !== a.state ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        a.label
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Refusing something is the moment to offer the alternative,
                  not a separate screen they have to go looking for. */}
              {swapFor === item.name && (
                <div className="mt-4 pt-4 border-t">
                  {swaps === null ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Looking for something else…
                    </p>
                  ) : swaps.options.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{swaps.note}</p>
                  ) : (
                    <>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Repeat2 className="w-3.5 h-3.5" />
                        Use instead
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {swaps.options.map((o) => (
                          <button
                            key={o.name}
                            type="button"
                            disabled={pending === item.name}
                            onClick={() => void chooseSwap(item, o.name)}
                            className="px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                          >
                            {o.name}
                            {o.sharedFlavors.length > 0 && (
                              <span className="text-xs opacity-70"> · {o.sharedFlavors[0]}</span>
                            )}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={pending === item.name}
                          onClick={() => void chooseSwap(item, null)}
                          className="px-3 py-1.5 rounded-full text-sm border border-border text-muted-foreground hover:border-primary/50 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <X className="size-3.5" /> Skip without a substitute
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Choose one to prioritise it in this week&rsquo;s builds, or skip the ingredient without a replacement.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* The part someone takes to a shop. Only what they said they would buy —
          a list that also contains what they already own is not a list. */}
      {buying.length > 0 && (
        <div className="mt-8 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
          <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">
            To pick up — {buying.length}
          </p>
          <ul className="space-y-1.5">
            {buying.map((i) => (
              <li key={i.name} className="flex items-center gap-2.5 text-sm">
                <span className="w-4 h-4 rounded border-2 border-primary/40 shrink-0" />
                {i.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {answered === shelf.items.length && buying.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground flex items-center gap-2">
          <Check className="w-4 h-4 text-primary" />
          Nothing to buy — you&rsquo;re set for the week.
        </p>
      )}
    </div>
  );
}
