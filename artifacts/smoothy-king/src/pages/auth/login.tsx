import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Blend, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/features/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useLogin();
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const isValid = email.includes("@") && password.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          login(data.user, data.token);
          toast({ title: "Welcome Back! 👋", description: `Good to see you again, ${data.user.nickname}!` });
          setLocation("/");
        },
        onError: (err: unknown) => {
          toast({
            title: "Couldn't log you in",
            description: errorMessage(err, "Check your email and password, then try again."),
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
          <h1 className="font-serif text-3xl md:text-4xl font-medium mb-3">Welcome Back</h1>
          <p className="text-muted-foreground font-sans">
            Continue your functional smoothie ritual
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold mb-2 block">Email</label>
            <Input
              id="login-email"
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
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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
          </div>

          <Button
            id="login-submit"
            type="submit"
            size="lg"
            className="w-full h-14 rounded-xl text-lg gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
            disabled={!isValid || loginMutation.isPending}
          >
            {loginMutation.isPending ? "Logging in..." : "Log In"}
            <ArrowRight className="w-5 h-5" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
