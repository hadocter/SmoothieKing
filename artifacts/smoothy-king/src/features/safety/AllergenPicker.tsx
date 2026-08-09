import { useEffect, useMemo, useState } from "react";
import { X, Plus, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch } from "../api";

/**
 * Declaring an allergy.
 *
 * Two kinds, and between them they cover everything the check can enforce.
 *
 * The classes come from the catalog rather than a written list. The written
 * one had drifted both ways: peanut was tagged on peanut butter with no way to
 * select it, while Shellfish, Egg, Peach and Kiwi were offered against a
 * catalog containing none of them — a picker promising to filter something it
 * has never seen. Deriving the set keeps it complete by construction and stops
 * it offering anything it cannot act on.
 *
 * The second kind is any single ingredient by name. Someone allergic to banana
 * is not expressing a preference, and the old shape had nowhere for them to
 * say so except the dislikes list further down, which generation avoids but
 * the safety check does not treat as unsafe. Named here, it is enforced by the
 * same check as dairy.
 *
 * Nothing else is offered. That is the point: everything selectable is
 * enforced, and everything enforceable is selectable.
 */

interface AllergenClass {
  id: string;
  label: string;
  /** What in the catalog carries it, so the choice is not made blind. */
  ingredients: string[];
}

interface AllergenCatalog {
  classes: AllergenClass[];
  ingredients: string[];
}

interface Props {
  /** Stored allergy strings — class labels and ingredient names, mixed. */
  selected: string[];
  onChange: (next: string[]) => void;
}

export function AllergenPicker({ selected, onChange }: Props) {
  const [catalog, setCatalog] = useState<AllergenCatalog | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void apiFetch<AllergenCatalog>("/api/safety/allergens", null)
      .then((c) => !cancelled && setCatalog(c))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (value: string) =>
    onChange(
      selected.some((s) => s.toLowerCase() === value.toLowerCase())
        ? selected.filter((s) => s.toLowerCase() !== value.toLowerCase())
        : [...selected, value],
    );

  const has = (value: string) => selected.some((s) => s.toLowerCase() === value.toLowerCase());

  /** Ingredients matching the search, minus ones already covered by a class. */
  const matches = useMemo(() => {
    if (!catalog || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    return catalog.ingredients.filter((n) => n.toLowerCase().includes(q)).slice(0, 8);
  }, [catalog, query]);

  /** Named ingredients, as opposed to class labels. */
  const namedIngredients = selected.filter(
    (s) => !catalog?.classes.some((c) => c.label.toLowerCase() === s.toLowerCase()),
  );

  if (!catalog) {
    return <p className="text-sm text-muted-foreground">Loading allergens…</p>;
  }

  return (
    <div>
      <div className="flex items-start gap-2 mb-4">
        <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Anything here is filtered out and checked again before you drink it. For things you just
          don&apos;t like, use the list below instead.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {catalog.classes.map((c) => {
          const on = has(c.label);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.label)}
              aria-pressed={on}
              title={`In our ingredients: ${c.ingredients.join(", ")}`}
              className={`px-4 py-2.5 rounded-2xl border transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
                on
                  ? "bg-destructive/10 text-destructive border-destructive/30 ring-1 ring-destructive/20"
                  : "bg-card hover:bg-muted border-transparent"
              }`}
            >
              {c.label}
              <span className="text-xs opacity-60">({c.ingredients.length})</span>
              {on && <X className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Allergic to something else?</label>
        <Input
          value={query}
          placeholder="Search our ingredients — e.g. banana"
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-xl mb-3"
        />

        {query.trim().length >= 2 && matches.length === 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            Nothing by that name in our ingredients — so there&apos;s nothing to filter out.
          </p>
        )}

        {matches.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {matches.map((name) => (
              <button
                key={name}
                type="button"
                disabled={has(name)}
                onClick={() => {
                  toggle(name);
                  setQuery("");
                }}
                className={`px-3 py-1.5 rounded-full text-sm border inline-flex items-center gap-1.5 ${
                  has(name)
                    ? "bg-muted text-muted-foreground border-border cursor-default"
                    : "bg-card hover:bg-muted border-border"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {name}
              </button>
            ))}
          </div>
        )}

        {namedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {namedIngredients.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                className="px-3 py-1.5 rounded-full text-sm bg-destructive/10 text-destructive border border-destructive/30 inline-flex items-center gap-1.5"
              >
                {name}
                <X className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
