import { AppLayout } from "@/components/layout/AppLayout";
import { IngredientCard } from "@/components/ui/ingredient-card";
import { useListIngredients } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useState } from "react";

export default function Ingredients() {
  const { data: ingredients, isLoading } = useListIngredients();
  const [search, setSearch] = useState("");

  const filteredIngredients = ingredients?.filter(ing => 
    ing.name.toLowerCase().includes(search.toLowerCase()) || 
    ing.category.toLowerCase().includes(search.toLowerCase()) ||
    ing.benefits.some(b => b.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-12 md:py-20">
        <header className="mb-16 max-w-2xl mx-auto text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-serif text-foreground mb-6"
          >
            Ingredient Glossary
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-muted-foreground font-sans text-sm md:text-base leading-relaxed mb-8"
          >
            An apothecary-style library of nature's most potent compounds. Understand exactly what you're putting into your body and onto your skin.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative max-w-md mx-auto"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search ingredients, benefits..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-full text-sm font-sans outline-none transition-all"
            />
          </motion.div>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredIngredients?.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <p className="font-serif text-xl text-foreground mb-2">No ingredients found</p>
            <p className="text-sm font-sans text-muted-foreground">Try a different search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredIngredients?.map((ing, i) => (
              <IngredientCard key={ing.id} ingredient={ing} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}