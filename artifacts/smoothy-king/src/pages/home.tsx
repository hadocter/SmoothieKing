import { useAuth } from "@/lib/auth-context";
import { VisitorHome } from "@/features/home/VisitorHome";
import { Console } from "@/features/home/Console";

/**
 * Two pages at one address.
 *
 * Signed out it is an argument for signing up. Signed in it is a console: two
 * tabs on one axis of time, today and this week, with the rest of the app one
 * click away. They are separate components rather than one page with
 * conditions through it, because they are not variations on a layout.
 */
export default function Home() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <Console /> : <VisitorHome />;
}
