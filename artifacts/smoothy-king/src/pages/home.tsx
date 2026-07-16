import { AppLayout } from "@/components/layout/AppLayout";
import { RecipeCard } from "@/components/ui/recipe-card";
import { useGetFeaturedRecipes, useGetRecipesByBenefit } from "@workspace/api-client-react";
import heroImg from "@assets/generated_images/hero.jpg";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Home() {
  const { data: featuredRecipes, isLoading: featuredLoading } = useGetFeaturedRecipes();
  const { data: recipesByBenefit, isLoading: benefitsLoading } = useGetRecipesByBenefit();

  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative h-[85vh] w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 w-full h-full">
          <img 
            src={heroImg} 
            alt="Moody green smoothie" 
            className="w-full h-full object-cover scale-105 object-center"
            style={{ transform: "translateZ(0)" }}
          />
          <div className="absolute inset-0 bg-foreground/40 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/20" />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-white/80 font-sans text-xs sm:text-sm tracking-[0.3em] uppercase mb-6 block"
          >
            The Bay Area Wellness Protocol
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif text-white mb-8 leading-[1.1]"
          >
            Every recipe <br/>
            <span className="italic font-light">is a ritual.</span>
          </motion.h1>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <Link 
              href="/recipes" 
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-foreground font-sans text-xs tracking-[0.2em] uppercase hover:bg-white/90 transition-colors"
            >
              Explore Rituals
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-24 sm:py-32 px-6 max-w-4xl mx-auto text-center">
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="font-serif text-2xl sm:text-4xl leading-relaxed text-foreground"
        >
          We apply the precision of a 10-step Korean skincare routine to the art of clinical nutrition. Products that heal, hydrate, and illuminate from within.
        </motion.p>
      </section>

      {/* Featured Rituals */}
      <section className="py-16 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-sm font-sans tracking-[0.2em] uppercase text-muted-foreground mb-3">Curated Collection</h2>
            <h3 className="text-4xl font-serif text-foreground">Signature Protocols</h3>
          </div>
          <Link href="/recipes" className="hidden sm:block text-xs font-sans tracking-[0.1em] uppercase hover:text-primary transition-colors border-b border-transparent hover:border-primary pb-1">
            View All
          </Link>
        </div>

        {featuredLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3].map(i => (
              <div key={i} className="aspect-[4/5] bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 gap-y-16">
            {featuredRecipes?.map((recipe, i) => (
              <RecipeCard key={recipe.id} recipe={recipe} index={i} priority={i < 3} />
            ))}
          </div>
        )}
      </section>

      {/* Shop by Benefit */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto border-t border-border/50">
        <div className="text-center mb-16">
          <h2 className="text-sm font-sans tracking-[0.2em] uppercase text-muted-foreground mb-3">Targeted Healing</h2>
          <h3 className="text-4xl font-serif text-foreground">What does your skin need?</h3>
        </div>

        {benefitsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1,2,3,4].map(i => <div key={i} className="w-64 h-32 bg-muted animate-pulse rounded-md flex-shrink-0" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recipesByBenefit?.slice(0, 4).map((group, i) => (
              <motion.div
                key={group.benefit}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <Link href={`/recipes?benefit=${group.benefit}`} className="group block h-full p-8 border border-border bg-card hover:border-primary/50 transition-colors">
                  <h4 className="font-serif text-2xl text-foreground mb-2 group-hover:text-primary transition-colors">{group.label}</h4>
                  <p className="text-sm text-muted-foreground font-sans line-clamp-2">{group.description}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}