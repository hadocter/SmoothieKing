import { useState } from "react";
import { useSignup } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Blend, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const isValid =
    email.includes("@") &&
    password.length >= 6 &&
    password === confirmPassword &&
    nickname.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    signupMutation.mutate(
      { data: { email, password, nickname: nickname.trim() } },
      {
        onSuccess: (data) => {
          login(data.user, data.token);
          toast({ title: "Welcome! 🎉", description: `Account created for ${data.user.nickname}.` });
          setLocation("/onboarding");
        },
        onError: (err: any) => {
          const message = err?.data?.error || err?.message || "Failed to create account.";
          toast({ title: "Error", description: message, variant: "destructive" });
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
            />
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
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-destructive mt-1">Password must be at least 6 characters</p>
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
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">Passwords do not match</p>
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
