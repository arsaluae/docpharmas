import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, Sparkles, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import moujLogo from "@/assets/mouj-logo.png";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
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
    <div className="min-h-screen w-full grid md:grid-cols-2 bg-background">
      {/* Left — brand panel */}
      <div className="auth-brand-panel relative hidden md:flex flex-col justify-between p-10 lg:p-14 text-white">
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center">
            <img src={moujLogo} alt="MOUJ" className="h-7 w-auto" />
          </div>
          <div className="leading-tight">
            <div className="font-heading text-base font-semibold tracking-tight">MOUJ</div>
            <div className="text-[11px] text-white/60 uppercase tracking-[0.18em]">Pharmaceuticals</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/8 backdrop-blur-sm border border-white/12 text-[11px] text-white/80 uppercase tracking-[0.15em]">
            <Sparkles className="h-3 w-3" />
            ERP for modern pharma
          </div>
          <h1 className="font-heading text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">
            Operations,<br />
            <span className="bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
              quietly orchestrated.
            </span>
          </h1>
          <p className="text-white/65 text-[15px] leading-relaxed max-w-sm">
            Sales, inventory, finance and compliance — one calm surface designed for distributors who move fast and never lose a batch.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 max-w-sm">
            <div className="flex items-center gap-2.5 text-[12px] text-white/70">
              <div className="h-7 w-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              Batch & expiry traced
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-white/70">
              <div className="h-7 w-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5" />
              </div>
              Realtime ledgers
            </div>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-white/40 tracking-wide">
          © {new Date().getFullYear()} MOUJ Pharmaceuticals · Karachi, PK
        </div>

        {/* floating glow accents */}
        <div className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-indigo-500/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* Right — form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10 relative">
        {/* mobile brand strip */}
        <div className="md:hidden flex flex-col items-center mb-8 gap-3">
          <img src={moujLogo} alt="MOUJ" className="h-12 w-auto" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="font-heading text-3xl font-semibold text-foreground tracking-tight">
              {mode === "login" ? "Welcome back" : "Reset password"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              {mode === "login"
                ? "Sign in to continue to your ERP workspace."
                : "Enter your email and we'll send a secure reset link."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-secondary/40 border-border/70 focus:border-primary/60"
                  required
                  autoFocus
                />
              </div>
            </div>

            {mode === "login" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 bg-secondary/40 border-border/70 focus:border-primary/60"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-[11px] text-primary hover:underline font-medium"
              >
                ← Back to sign in
              </button>
            )}

            <Button
              type="submit"
              disabled={loading}
              variant="premium"
              className="w-full h-11 mt-2 group"
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Send Reset Link"}
              <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-border/60 text-center">
            <p className="text-[11px] text-muted-foreground">
              Protected workspace · Multi-tenant isolated
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
