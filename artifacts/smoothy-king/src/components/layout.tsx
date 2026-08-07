import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Droplet, Blend, Sparkles, Heart, Menu, Users, CreditCard, X, LogOut, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, isLoggedIn, logout } = useAuth();

  const navItems = [
    { label: "Today", path: "/builder", icon: Blend },
    { label: "Community", path: "/community", icon: Users },
    { label: "Recipes", path: "/recipes", icon: Sparkles },
    { label: "Ingredients", path: "/ingredients", icon: Droplet },
    { label: "Membership", path: "/membership", icon: CreditCard },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary font-serif font-semibold text-2xl tracking-wide hover:opacity-80 transition-opacity">
            <Blend className="h-6 w-6" />
            <span>Smoothy King</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 font-sans font-medium text-sm">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-1.5 transition-colors ${
                  location === item.path 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            <Link href="/favorites">
              <Button variant="ghost" size="icon" className="text-primary rounded-full">
                <Heart className="h-5 w-5" />
              </Button>
            </Link>

            {isLoggedIn ? (
              <div className="flex items-center gap-3 border-l pl-6">
                <Link href="/profile" className="flex items-center gap-1.5 text-foreground hover:text-primary font-medium">
                  <UserCircle className="w-5 h-5 text-primary" />
                  <span>{user?.nickname}</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={logout} title="Log Out" className="text-muted-foreground hover:text-destructive">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-l pl-6">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="rounded-full">Log In</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="rounded-full">Sign Up</Button>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Nav */}
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/favorites">
              <Button variant="ghost" size="icon" className="text-primary rounded-full">
                <Heart className="h-5 w-5" />
              </Button>
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background border-l-0 w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-6 mt-12">
                  {isLoggedIn ? (
                    <div className="flex items-center justify-between border-b pb-4 mb-2">
                      <Link href="/profile" className="flex items-center gap-2 text-foreground hover:text-primary">
                        <UserCircle className="w-6 h-6 text-primary" />
                        <span className="font-semibold text-lg">{user?.nickname}</span>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
                        Log Out
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 border-b pb-4 mb-2">
                      <Link href="/login">
                        <Button variant="outline" className="w-full justify-start rounded-full">Log In</Button>
                      </Link>
                      <Link href="/signup">
                        <Button className="w-full justify-start rounded-full">Sign Up</Button>
                      </Link>
                    </div>
                  )}

                  {navItems.map((item) => (
                    <Link 
                      key={item.path} 
                      href={item.path}
                      className={`flex items-center gap-3 text-lg font-serif transition-colors ${
                        location === item.path 
                          ? "text-primary font-medium" 
                          : "text-muted-foreground"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t bg-card py-12 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-primary font-serif font-semibold text-2xl mb-6">
            <Blend className="h-6 w-6" />
            <span>Smoothy King</span>
          </div>
          <p className="text-muted-foreground font-serif italic max-w-md mx-auto mb-8">
            Beauty and health built one intentional ingredient at a time.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm font-sans text-muted-foreground">
            <Link href="/recipes" className="hover:text-primary transition-colors">Recipes</Link>
            <Link href="/ingredients" className="hover:text-primary transition-colors">Ingredients</Link>
            <Link href="/community" className="hover:text-primary transition-colors">Community</Link>
            <Link href="/membership" className="hover:text-primary transition-colors">Membership</Link>
          </div>
          <div className="mt-12 text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Smoothy King. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
