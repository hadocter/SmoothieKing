import { useListPlans } from "@workspace/api-client-react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Membership() {
  const { data: plans, isLoading } = useListPlans();
  const { toast } = useToast();

  const handleCheckout = () => {
    toast({
      title: "Coming Soon",
      description: "Checkout is not connected in this preview. We'll share availability when fulfillment opens in your area.",
    });
  };

  return (
    <div className="min-h-screen bg-card py-20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="font-serif text-5xl md:text-6xl font-medium mb-6">
            Make at home for <span className="italic text-primary">free.</span>
          </h1>
          <p className="font-sans text-lg text-muted-foreground leading-relaxed">
            The Builder, recipe library, saved recipes, and community are free to use. These optional plans are for real-world fulfillment: ingredients delivered to you or a finished smoothie ready for pickup.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className={`h-[500px] rounded-3xl ${i === 1 ? 'md:h-[550px]' : ''}`} />
            ))
          ) : (Array.isArray(plans) && plans.length > 0 ? plans : [
            { id: 1, name: "Ingredient Delivery", tagline: "A recurring grocery-ready box for making recipes at home.", pricePerMonth: 29, features: ["Two chilled ingredient kits each month", "Pre-portioned fruit, greens, and pantry add-ons", "Skip-week controls", "Supported delivery areas only"], isPopular: false, accentHex: null },
            { id: 2, name: "Pickup Pass", tagline: "Collect a freshly blended drink at a participating location.", pricePerMonth: 49, features: ["Four made-to-order pickup credits each month", "Choose a saved public recipe", "Time-window pickup", "Substitutions confirmed at handoff"], isPopular: true, accentHex: "#10B981" },
            { id: 3, name: "Blend & Pickup", tagline: "A fulfillment bundle for home blending and store pickup.", pricePerMonth: 89, features: ["Everything in Ingredient Delivery", "Four pickup credits", "One flexible skip per billing cycle", "Priority fulfillment support"], isPopular: false, accentHex: null }
          ]).map((plan) => (
            <div 
              key={plan.id} 
              className={`relative rounded-3xl p-8 bg-background border flex flex-col ${
                plan.isPopular 
                  ? 'md:scale-105 shadow-2xl border-primary ring-1 ring-primary/20 z-10' 
                  : 'shadow-sm hover:shadow-md transition-shadow'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-lg">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Most Popular
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="font-serif text-2xl font-medium mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground h-10">{plan.tagline}</p>
              </div>

              <div className="mb-8">
                <span className="text-5xl font-serif font-medium">${plan.pricePerMonth}</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="flex-1 space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                onClick={handleCheckout}
                size="lg"
                variant={plan.isPopular ? 'default' : 'outline'}
                className="w-full rounded-full h-12 text-base"
                style={plan.isPopular && plan.accentHex ? { backgroundColor: plan.accentHex, borderColor: plan.accentHex } : {}}
              >
                Request {plan.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-24 text-center">
          <h2 className="font-serif text-3xl font-medium mb-4">No subscription needed</h2>
          <p className="text-muted-foreground mb-8">You can build, save, publish, and browse recipes without a plan.</p>
          <Link href="/community"><Button variant="link" className="text-primary font-medium">View the Community Wall</Button></Link>
        </div>
      </div>
    </div>
  );
}
