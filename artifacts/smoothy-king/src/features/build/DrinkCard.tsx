import type { BuiltDrink } from "./index";

/**
 * One drink, offered as a choice.
 *
 * The gradient is derived from the ingredients actually in it, so six cards
 * look different because they are different drinks rather than because a
 * palette was cycled. A green one is green because there is spinach in it,
 * which means the picture carries real information and someone can choose on
 * a glance before reading anything.
 *
 * Three ingredients underneath, not the full list: the point of this screen is
 * choosing between drinks, and a complete recipe on every card turns six
 * choices into six paragraphs.
 */
export function DrinkCard({
  drink,
  selected,
  onSelect,
}: {
  drink: BuiltDrink;
  selected: boolean;
  onSelect: () => void;
}) {
  const css = drink.appearance?.css ?? "linear-gradient(160deg, #e5e5e5, #c9c9c9)";
  const onBlend = drink.appearance?.onBlend ?? "#1a1a1a";
  const named = drink.representativeIngredients ?? drink.ingredients.slice(0, 3).map((i) => i.name);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group text-left rounded-3xl overflow-hidden border-2 transition-all duration-300 ${
        selected
          ? "border-primary ring-4 ring-primary/10 shadow-xl scale-[1.01]"
          : "border-transparent shadow-sm hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      <div
        className="h-32 flex items-end p-4 transition-transform duration-500 group-hover:scale-[1.03]"
        style={{ background: css }}
      >
        <span
          className="text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm"
          style={{ background: "rgba(255,255,255,0.75)", color: "#1a1a1a" }}
        >
          {Math.round(drink.matchScore * 100)}% fit
        </span>
        <span className="sr-only" style={{ color: onBlend }} />
      </div>

      <div className="bg-card p-4">
        <h3 className="font-serif text-lg font-medium leading-snug mb-1.5">{drink.name}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{named.join(" · ")}</p>
        <p className="text-xs text-muted-foreground">
          {/* Null, not zero. Some ingredients have no sourced figure, and a
              total that quietly omits them would be wrong rather than smaller. */}
          {drink.calories === null ? "Calories not known" : `${drink.calories} kcal`}
          {drink.protein !== null && ` · ${drink.protein}g protein`}
          {` · ${drink.prepTimeMinutes} min`}
        </p>
      </div>
    </button>
  );
}
