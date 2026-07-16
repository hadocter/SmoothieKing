import { Ingredient } from "@workspace/api-client-react";
import { motion } from "framer-motion";

export function IngredientCard({ 
  ingredient, 
  index = 0 
}: { 
  ingredient: Ingredient; 
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col p-6 rounded-lg border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-serif text-2xl mb-1">{ingredient.name}</h3>
          {ingredient.koreanName && (
            <p className="text-sm font-sans tracking-widest text-muted-foreground uppercase">{ingredient.koreanName}</p>
          )}
        </div>
        <span className="text-xs uppercase tracking-wider text-accent border border-accent/30 bg-accent/5 px-2 py-1 rounded-full">
          {ingredient.category}
        </span>
      </div>
      
      <p className="text-sm leading-relaxed mb-6 flex-1 text-muted-foreground">
        {ingredient.description}
      </p>

      {ingredient.skinBenefitKey && (
        <div className="mb-4">
          <span className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Key Skin Benefit</span>
          <span className="font-serif text-lg text-primary">{ingredient.skinBenefitKey.replace(/-/g, ' ')}</span>
        </div>
      )}

      {ingredient.benefits && ingredient.benefits.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-auto">
          {ingredient.benefits.map((b) => (
            <span key={b} className="text-[10px] uppercase tracking-[0.1em] bg-secondary/30 text-secondary-foreground/80 px-2 py-0.5 rounded-sm">
              {b.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}