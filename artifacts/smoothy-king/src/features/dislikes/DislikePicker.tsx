import { useMemo } from "react";
import { X } from "lucide-react";

/**
 * Picking ingredients you would rather not have.
 *
 * Forty-three chips in one flat wall is a list, not a choice — to find dairy
 * you read all of it, and most people give up and pick whatever they happen to
 * notice first. Two changes fix that without adding a search box nobody wants
 * to type into mid-signup.
 *
 * Grouped by the catalog's own `category` column, so the grouping is data
 * rather than a second taxonomy maintained by hand. Categories are ordered by
 * how likely someone is to have a view about them — fruit and protein first,
 * liquids and adaptogens last.
 *
 * And the handful people are most often avoiding sits at the top, repeated
 * from the groups below rather than moved out of them. Repetition is the point:
 * someone scanning for "dairy" finds it immediately, and someone reading the
 * protein group still sees kefir where it belongs. Selection state is shared,
 * so ticking either copy ticks both — two chips, one fact.
 */

export interface DislikeIngredient {
  id: number;
  name: string;
  category: string;
  contains?: string[];
}

interface Props {
  ingredients: DislikeIngredient[];
  selected: string[];
  onToggle: (name: string) => void;
}

/**
 * Most-avoided first, then the rest.
 *
 * Not alphabetical and not the catalog's order: this is a rough ranking of how
 * often someone has an opinion, which is the only ordering that saves anyone
 * scrolling.
 */
const CATEGORY_ORDER = ["protein", "fruit", "vegetable", "fat", "superfood", "adaptogen", "liquid"];

const CATEGORY_LABEL: Record<string, string> = {
  protein: "Protein & dairy",
  fruit: "Fruit & sweet",
  vegetable: "Vegetables",
  fat: "Nuts & fats",
  superfood: "Seeds & grains",
  adaptogen: "Spices & botanicals",
  liquid: "Liquids",
};

/**
 * The allergens worth surfacing before anything else.
 *
 * The four the catalog actually tags, which is also most of what people avoid.
 * Anything carrying one of these appears in the shortcut row.
 */
const COMMON_ALLERGENS = ["dairy", "tree-nut", "gluten", "soy", "peanut"];

function Chip({
  name,
  selected,
  onToggle,
}: {
  name: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={`px-4 py-2.5 rounded-2xl border transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
        selected
          ? "bg-muted text-muted-foreground border-border line-through opacity-60"
          : "bg-card hover:bg-muted border-transparent"
      }`}
    >
      {name}
      {selected && <X className="w-3.5 h-3.5" />}
    </button>
  );
}

export function DislikePicker({ ingredients, selected, onToggle }: Props) {
  const groups = useMemo(() => {
    const byCategory = new Map<string, DislikeIngredient[]>();
    for (const i of ingredients) {
      const key = i.category ?? "other";
      byCategory.set(key, [...(byCategory.get(key) ?? []), i]);
    }
    // Known categories in the order above, then anything the catalog grows
    // later — an unrecognised category shows up at the end rather than
    // disappearing, which is what a hand-maintained list would do to it.
    const known = CATEGORY_ORDER.filter((c) => byCategory.has(c));
    const rest = [...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [...known, ...rest].map((key) => ({
      key,
      label: CATEGORY_LABEL[key] ?? key,
      items: (byCategory.get(key) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [ingredients]);

  const common = useMemo(
    () =>
      ingredients
        .filter((i) => (i.contains ?? []).some((a) => COMMON_ALLERGENS.includes(a)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [ingredients],
  );

  return (
    <div>
      {common.length > 0 && (
        <div className="mb-8">
          <h4 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">
            Most often avoided
          </h4>
          <div className="flex flex-wrap gap-3">
            {common.map((i) => (
              <Chip
                key={`common-${i.id}`}
                name={i.name}
                selected={selected.includes(i.name)}
                onToggle={() => onToggle(i.name)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            These appear again in their groups below — either one works.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.key}>
            <h4 className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-3">
              {g.label}
            </h4>
            <div className="flex flex-wrap gap-3">
              {g.items.map((i) => (
                <Chip
                  key={i.id}
                  name={i.name}
                  selected={selected.includes(i.name)}
                  onToggle={() => onToggle(i.name)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
