import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WeekPanel } from "@/features/shelf/WeekPanel";
import { getWeekReview, type WeekReview } from "@/features/shelf";

/**
 * The week, at its own address.
 *
 * The same panel the home console's week tab shows — this is the thing someone
 * opens in a shop, on a phone, away from the day's drink, and a deep link to
 * it should land on the whole week rather than half of it.
 */
export default function Shelf() {
  const { isLoggedIn, token } = useAuth();
  const [review, setReview] = useState<WeekReview | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    getWeekReview(token)
      .then((r) => !cancelled && setReview(r))
      .catch(() => !cancelled && setReview({ active: false }));
    return () => {
      cancelled = true;
    };
  }, [token, isLoggedIn, nonce]);

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
      {review === null ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : (
        <WeekPanel review={review} onChanged={() => setNonce((n) => n + 1)} />
      )}
    </div>
  );
}
