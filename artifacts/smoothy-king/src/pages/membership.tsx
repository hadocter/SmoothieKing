import { useListPlans } from "@workspace/api-client-react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function Membership() {
  const { data: plans, isLoading } = useListPlans();
  const { toast } = useToast();

  const handleCheckout = () => {
    toast({
      title: "Coming Soon",
      description: "Membership checkout is currently disabled in this preview.",
    });
  };

  return (
    <div className="min-h-screen bg-card py-20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="font-serif text-5xl md:text-6xl font-medium mb-6">
            Invest in your <span className="italic text-primary">daily ritual.</span>
          </h1>
          <p className="font-sans text-lg text-muted-foreground leading-relaxed">
            Smoothy King is a monthly membership for those who take their nutrition seriously. 
            Access premium ingredients, exclusive community blends, and the daily habit of feeling good.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className={`h-[500px] rounded-3xl ${i === 1 ? 'md:h-[550px]' : ''}`} />
            ))
          ) : (Array.isArray(plans) && plans.length > 0 ? plans : [
            { id: 1, name: "Essential", tagline: "For the curious blender establishing a daily routine.", pricePerMonth: 29, features: ["Access to 50+ official recipes", "Personalized health onboarding", "Custom Smoothie Builder", "Standard ingredient library"], isPopular: false, accentHex: null },
            { id: 2, name: "Ritual Pass", tagline: "Our flagship membership for dedicated wellness enthusiasts.", pricePerMonth: 49, features: ["Everything in Essential", "Unlimited custom blend saves", "K-Beauty skin benefit scoring", "Priority community recipe sharing", "Monthly ingredient box discounts"], isPopular: true, accentHex: "#10B981" },
            { id: 3, name: "Laboratory VIP", tagline: "The ultimate concierge nutrition & functional blend experience.", pricePerMonth: 89, features: ["Everything in Ritual Pass", "1-on-1 Nutritionist consultations", "Exclusive adaptogen drops", "Free express shipping"], isPopular: false, accentHex: null }
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
                Choose {plan.name}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-24 text-center">
          <h2 className="font-serif text-3xl font-medium mb-4">Not ready to subscribe?</h2>
          <p className="text-muted-foreground mb-8">You can still browse recipes and join the community for free.</p>
          <Button variant="link" className="text-primary font-medium">View the Community Wall</Button>
        </div>
      </div>
    </div>
  );
}
