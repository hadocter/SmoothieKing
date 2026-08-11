import { useAuth } from "@/lib/auth-context";
import { VisitorHome } from "@/features/home/VisitorHome";
import { MemberHome } from "@/features/home/MemberHome";

/**
 * Two pages at one address.
 *
 * A redirect to /builder for members would have been a line, but it would have
 * meant the app has no home — nowhere that answers "where am I with this"
 * without starting something. The two components are separate rather than one
 * page with conditions through it, because they are not variations on a
 * layout: one is an argument for signing up and the other is a day in
 * progress.
 */
export default function Home() {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <MemberHome /> : <VisitorHome />;
}
