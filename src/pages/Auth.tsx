import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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

  const Wordmark = ({ sub = true }: { sub?: boolean }) => (
    <div>
      <span className="mouj-auth-wordmark">
        MOUJ <span className="mouj-auth-wordmark-accent">PHARMA</span>
      </span>
      {sub && <div className="mouj-auth-sub">Pharmaceuticals · ERP</div>}
    </div>
  );

  return (
    <div className="mouj-dark-auth">
      <div className="mouj-auth-shell">
        {/* Left brand panel */}
        <aside className="mouj-auth-brand">
          <Wordmark />

          <div>
            <h1 className="mouj-auth-headline">
              Operations,<br />
              inventory and finance<br />
              in <em>one quiet workspace.</em>
            </h1>
            <p className="mouj-auth-tag">
              Sign in to manage sales, purchase orders, batches and ledgers across
              your distribution network — built for pharmaceutical teams.
            </p>
          </div>

          <div className="mouj-auth-meta">
            <span><span className="mouj-auth-dot" />Secure session</span>
            <span>v2.0</span>
          </div>
        </aside>

        {/* Right form panel */}
        <main className="mouj-auth-form-wrap">
          <div className="mouj-auth-card">
            {/* Mobile brand */}
            <div className="mouj-auth-mobile-brand flex-col items-start mb-8">
              <Wordmark />
            </div>

            <h2 className="mb-1.5">
              {mode === "login" ? "Sign in" : "Reset password"}
            </h2>
            <p className="text-[13px] mouj-muted mb-7">
              {mode === "login"
                ? "Enter your credentials to access your workspace."
                : "We'll email you a secure reset link."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mouj-label">Email</label>
                <div className="relative">
                  <Mail className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-[1]" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mouj-input"
                    required
                  />
                </div>
              </div>

              {mode === "login" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="mouj-label mb-0">Password</label>
                    <button type="button" onClick={() => setMode("forgot")} className="mouj-link">
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-[1]" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mouj-input"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              {mode === "forgot" && (
                <div className="flex justify-end">
                  <button type="button" onClick={() => setMode("login")} className="mouj-link">
                    Back to sign in
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading} className="mouj-cta mt-2">
                {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Send Reset Link"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mouj-foot flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 opacity-60" />
              <span>Encrypted · role-based access</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
