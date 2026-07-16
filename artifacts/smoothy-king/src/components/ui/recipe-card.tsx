import { Recipe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import placeholderImg from "@assets/generated_images/recipe-glow.jpg";

export function RecipeCard({ 
  recipe, 
  index = 0, 
  priority = false 
}: { 
  recipe: Recipe; 
  index?: number; 
  priority?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col gap-4 cursor-pointer h-full"
    >
      <Link href={`/recipes/${recipe.id}`} className="absolute inset-0 z-10">
        <span className="sr-only">View {recipe.name}</span>
      </Link>
      
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-muted">
        <img 
          src={recipe.imageUrl || placeholderImg} 
          alt={recipe.name}
          className="object-cover w-full h-full transition-transform duration-1000 ease-out group-hover:scale-105"
          loading={priority ? "eager" : "lazy"}
        />
        {recipe.skinBenefitScore && (
          <div className="absolute top-3 left-3 bg-background/90 backdrop-blur text-foreground text-xs px-3 py-1 rounded-full font-sans tracking-wider border border-border/50">
            {recipe.skinBenefitScore}/10 Glow
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-xl text-foreground mb-1 group-hover:text-primary transition-colors">{recipe.name}</h3>
            <p className="text-sm text-muted-foreground font-sans tracking-wide">{recipe.tagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-auto pt-2">
          {recipe.benefits.slice(0, 2).map((b) => (
            <span key={b} className="text-[10px] uppercase tracking-[0.1em] bg-secondary/40 text-secondary-foreground/80 px-2.5 py-1 rounded-full border border-secondary">
              {b.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}