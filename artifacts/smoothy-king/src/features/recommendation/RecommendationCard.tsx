import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import type { RecommendedRecipe } from "./index";

/**
 * One recommended smoothie.
 *
 * Deliberately not the existing RecipeCard: that one is an image-led browsing
 * tile, and this has to carry a fit score, the ingredient line, and the action
 * that puts the drink in someone's history. Forcing both into one component
 * would mean a prop for every difference.
 */
export function RecommendationCard({
  recipe,
  logged,
  onLog,
}: {
  recipe: RecommendedRecipe;
  logged: boolean;
  onLog: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-2">
        <Link href={`/recipes/${recipe.id}`} className="font-serif text-xl font-medium hover:underline">
          {recipe.name}
        </Link>
        <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
          {Math.round(recipe.matchScore * 100)}% fit
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{recipe.tagline}</p>
      <p className="text-sm mb-4">{recipe.ingredients.map((i) => i.name).join(" · ")}</p>

      <div className="text-xs text-muted-foreground mb-4 mt-auto">
        {/* Null, not zero. Some ingredients have no sourced figure, and a total
            that quietly omits them would be wrong rather than smaller. */}
        {recipe.calories === null ? "Calories not known" : `${recipe.calories} kcal`}
        {recipe.protein !== null && ` · ${recipe.protein}g protein`}
      </div>

      <Button
        variant={logged ? "outline" : "default"}
        className="rounded-full gap-2 w-full"
        disabled={logged}
        onClick={() => onLog(recipe.id)}
      >
        {logged ? (
          <>
            <Check className="w-4 h-4" /> In your history
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> I drank this
          </>
        )}
      </Button>
    </div>
  );
}
