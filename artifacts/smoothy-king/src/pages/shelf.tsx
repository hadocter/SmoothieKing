import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { WeekShelf } from "@/features/shelf/WeekShelf";

/**
 * The week's shopping, on its own screen.
 *
 * Its own route rather than a panel on the builder: this is the thing someone
 * opens in a shop, on a phone, away from the day's drink.
 */
export default function Shelf() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <h1 className="font-serif text-3xl font-medium mb-3">Your week&rsquo;s list</h1>
        <p className="text-muted-foreground mb-6">
          The list is built around your goal, so it needs an account to know what yours is.
        </p>
        <Link href="/login">
          <Button className="rounded-full px-8">Log in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 md:py-14 max-w-2xl">
      <WeekShelf />
    </div>
  );
}
