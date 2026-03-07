import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Pill, Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent to your email");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/[0.06] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-warning/[0.06] rounded-full blur-3xl" />
      </div>

      <div className="glass-card-glow w-full max-w-md p-8 relative z-10">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-primary">
            <Pill className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-foreground">PharmaZen</h1>
        </div>

        <h2 className="font-heading text-lg text-center text-foreground mb-1">
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {mode === "login" ? "Sign in to your ERP dashboard" : mode === "signup" ? "Register for access" : "We'll send you a reset link"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
              className="pl-10 bg-secondary/50 border-border focus:border-primary" required />
          </div>
          {mode !== "forgot" && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-secondary/50 border-border focus:border-primary" required minLength={6} />
            </div>
          )}

          {mode === "login" && (
            <button type="button" onClick={() => setMode("forgot")}
              className="text-xs text-primary hover:underline block ml-auto">
              Forgot password?
            </button>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : mode === "signup" ? "Sign Up" : "Send Reset Link"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "Don't have an account?" : mode === "signup" ? "Already have an account?" : "Remember your password?"}{" "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary hover:underline font-medium">
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <div className="mt-4 text-center">
          <button onClick={() => navigate("/landing")}
            className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Back to homepage
          </button>
        </div>
      </div>
    </div>
  );
}
