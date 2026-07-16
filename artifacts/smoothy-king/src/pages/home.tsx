import { useGetCommunityStats, useGetFeaturedRecipes } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Blend, Sparkles, Activity, Droplets, ArrowUpRight, Users } from "lucide-react";
import { GOAL_COLORS, GOAL_LABELS } from "@/lib/colors";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetCommunityStats();
  const { data: featuredRecipes, isLoading: featuredLoading } = useGetFeaturedRecipes();

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative w-full min-h-[90dvh] flex items-center pt-16 pb-24 overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top_right,var(--color-goal-glowy)_0%,transparent_30%),radial-gradient(circle_at_bottom_left,var(--color-goal-hydration)_0%,transparent_30%)] opacity-20"></div>
        <div className="absolute inset-0 z-0 bg-background/40 backdrop-blur-[100px]"></div>
        
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>The Functional Smoothie Membership</span>
          </div>
          
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-foreground max-w-5xl leading-[1.1] mb-8">
            Build your beauty, <br className="hidden md:block" />
            <span className="italic text-primary">one ingredient</span> at a time.
          </h1>
          
          <p className="font-sans text-lg md:text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
            We empower you to build your own functional smoothie — every ingredient chosen for a purpose, inspired by the Korean skincare philosophy that beauty and health are built with intention.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link href="/builder">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform duration-300">
                <Blend className="w-5 h-5" />
                Build Your Blend
              </Button>
            </Link>
            <Link href="/membership">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg rounded-full gap-2 bg-background/50 backdrop-blur hover:bg-background/80">
                Explore Membership
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* The 5-Step Workflow Visualized */}
      <section className="py-24 bg-card relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl md:text-5xl font-medium mb-4">The Ritual</h2>
            <p className="text-muted-foreground font-sans text-lg">How it works, every single month.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 max-w-6xl mx-auto">
            {[
              { num: "01", title: "Set Intention", desc: "Choose your goal for the day—from Glowy Skin to Deep Hydration.", color: "bg-goal-glowy" },
              { num: "02", title: "Build", desc: "Select functional ingredients based on their specific benefits.", color: "bg-goal-hydration" },
              { num: "03", title: "Score", desc: "Watch your blend's benefit score rise as you layer nutrients.", color: "bg-goal-anti" },
              { num: "04", title: "Publish", desc: "Name your creation, give it a story, and share it.", color: "bg-goal-protein" },
              { num: "05", title: "Discover", desc: "Browse the community wall and get inspired by others.", color: "bg-goal-detox" }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-serif text-white shadow-lg mb-6 transition-transform group-hover:scale-110 ${step.color}`}>
                  {step.num}
                </div>
                <h3 className="font-serif text-xl font-medium mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground font-sans">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community Social Proof */}
      <section className="py-24 relative bg-primary text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-serif text-4xl md:text-6xl font-medium mb-6 leading-tight">
                Join a community of <br /><span className="italic opacity-80">intentional blenders</span>.
              </h2>
              <p className="font-sans text-lg opacity-80 mb-8 max-w-md">
                Every day, our members are crafting new recipes for vitality, clarity, and energy. Don't just drink a smoothie—join the movement.
              </p>
              <Link href="/community">
                <Button variant="secondary" size="lg" className="rounded-full gap-2">
                  View Community Wall
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {statsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-2xl bg-white/10" />
                ))
              ) : stats ? (
                <>
                  <StatCard value={stats.members.toLocaleString()} label="Active Members" icon={Users} />
                  <StatCard value={stats.creationsThisWeek.toLocaleString()} label="Creations This Week" icon={Blend} />
                  <StatCard value={stats.ritualsCompleted.toLocaleString()} label="Rituals Completed" icon={Activity} />
                  <StatCard 
                    value={GOAL_LABELS[stats.topGoal] || stats.topGoal} 
                    label="Top Goal" 
                    icon={Droplets} 
                    highlight 
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Rituals */}
      <section className="py-24 container mx-auto px-4">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="font-serif text-4xl font-medium mb-3">Featured Rituals</h2>
            <p className="text-muted-foreground font-sans">Curated blends from the Smoothy King lab.</p>
          </div>
          <Link href="/recipes" className="hidden md:flex items-center gap-2 text-primary font-medium hover:underline">
            View All <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
            ))
          ) : featuredRecipes?.slice(0, 3).map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`} className="group block">
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden mb-4 bg-muted">
                <img 
                  src={recipe.imageUrl || "https://images.unsplash.com/photo-1553530666-ba11a7dd0dc9?auto=format&fit=crop&q=80&w=800"} 
                  alt={recipe.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex gap-2 flex-wrap mb-3">
                    {recipe.benefits.slice(0, 2).map((benefit) => (
                      <span 
                        key={benefit} 
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${GOAL_COLORS[benefit] || 'bg-white text-black'}`}
                      >
                        {GOAL_LABELS[benefit] || benefit}
                      </span>
                    ))}
                  </div>
                  <h3 className="text-white font-serif text-2xl font-medium">{recipe.name}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center md:hidden">
          <Link href="/recipes">
            <Button variant="outline" className="rounded-full">View All Recipes</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({ value, label, icon: Icon, highlight = false }: { value: string | number, label: string, icon: any, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-3xl flex flex-col justify-between aspect-square ${highlight ? 'bg-white text-primary' : 'bg-white/10 backdrop-blur border border-white/10'}`}>
      <Icon className={`w-6 h-6 mb-4 ${highlight ? 'text-primary' : 'text-white/60'}`} />
      <div>
        <div className={`text-3xl font-serif font-medium mb-1 ${highlight ? 'text-primary' : 'text-white'}`}>{value}</div>
        <div className={`text-sm font-sans ${highlight ? 'text-primary/70' : 'text-white/70'}`}>{label}</div>
      </div>
    </div>
  );
}
