import { useState } from "react";
import { useSignup } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Blend, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/features/api";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const signupMutation = useSignup();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  /**
   * The same rule the server enforces.
   *
   * This used to be `email.includes("@")`, which let `name@host` through the
   * form and straight into a server that requires a real address — so the
   * first time anyone heard the rule was as a rejected request. The two must
   * agree, and the client is the side that can say so before a round trip.
   */
  const emailLooksRight = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  const touched = { email: email.length > 0, password: password.length > 0 };
  const errors = {
    email: touched.email && !emailLooksRight ? "That doesn't look like an email address yet." : null,
    password: touched.password && password.length < 6 ? "Use at least 6 characters." : null,
    confirm:
      confirmPassword.length > 0 && password !== confirmPassword
        ? "These two don't match."
        : null,
  };

  const isValid =
    emailLooksRight &&
    password.length >= 6 &&
    password === confirmPassword &&
    nickname.trim().length > 0;

  /** Why the button is off, so a disabled control is never a silent refusal. */
  const blocker = !nickname.trim()
    ? "Pick a nickname to continue."
    : !email.trim()
      ? "Add your email to continue."
      : !emailLooksRight
        ? "Check the email address."
        : password.length < 6
          ? "Your password needs at least 6 characters."
          : password !== confirmPassword
            ? "The two passwords need to match."
            : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    signupMutation.mutate(
      { data: { email, password, nickname: nickname.trim() } },
      {
        onSuccess: (data) => {
          login(data.user, data.token);
          toast({ title: "Welcome! 🎉", description: `Account created for ${data.user.nickname}.` });
          // Goal first, profile second. Knowing what someone is after is what
          // lets every screen after this say why it is showing them something;
          // height and allergies are refinements of an answer they have not
          // given yet.
          setLocation("/goal");
        },
        onError: (err: unknown) => {
          toast({
            title: "Couldn't create your account",
            description: errorMessage(err, "Please check the form and try again."),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Blend className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium mb-3">Create an Account</h1>
          <p className="text-muted-foreground font-sans">
            Start your personalized functional smoothie journey
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold mb-2 block">Nickname</label>
            <Input
              id="signup-nickname"
              placeholder="e.g. Smoothy King"
              className="h-12 rounded-xl bg-background"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Email</label>
            <Input
              id="signup-email"
              type="email"
              placeholder="example@email.com"
              className="h-12 rounded-xl bg-background"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
            />
            {errors.email && (
              <p id="signup-email-error" className="text-xs text-destructive mt-1">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Password</label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                className="h-12 rounded-xl bg-background pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p id="signup-password-error" className="text-xs text-destructive mt-1">
                {errors.password}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold mb-2 block">Confirm Password</label>
            <Input
              id="signup-confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              className="h-12 rounded-xl bg-background"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {errors.confirm && (
              <p id="signup-confirm-error" className="text-xs text-destructive mt-1">
                {errors.confirm}
              </p>
            )}
          </div>

          <Button
            id="signup-submit"
            type="submit"
            size="lg"
            className="w-full h-14 rounded-xl text-lg gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
            disabled={!isValid || signupMutation.isPending}
          >
            {signupMutation.isPending ? "Creating Account..." : "Get Started"}
            <ArrowRight className="w-5 h-5" />
          </Button>

          {/* A greyed-out button that will not say why is its own kind of
              unhelpful error. */}
          {blocker && !signupMutation.isPending && (
            <p className="text-sm text-muted-foreground text-center">{blocker}</p>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
