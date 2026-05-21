import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight } from "lucide-react";
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

  return (
    <div className="mouj-dark-auth min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center">
          <span className="mouj-auth-wordmark">MOUJ <span className="mouj-auth-wordmark-accent">PHARMA</span></span>
          <span className="mouj-auth-sub">PHARMACEUTICALS · ERP</span>
        </div>

        <div className="mouj-auth-card">
          <h2 className="text-[20px] font-medium mb-1.5 tracking-tight">
            {mode === "login" ? "Welcome back" : "Reset password"}
          </h2>
          <p className="text-[13px] mouj-muted mb-7">
            {mode === "login" ? "Sign in to your MOUJ workspace" : "We'll send you a reset link"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="relative">
              <Mail className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mouj-input"
                required
              />
            </div>
            {mode === "login" && (
              <div className="relative">
                <Lock className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mouj-input"
                  required
                  minLength={6}
                />
              </div>
            )}

            <div className="flex justify-end pt-0.5">
              {mode === "login" ? (
                <button type="button" onClick={() => setMode("forgot")} className="mouj-link">
                  Forgot password?
                </button>
              ) : (
                <button type="button" onClick={() => setMode("login")} className="mouj-link">
                  Back to sign in
                </button>
              )}
            </div>

            <button type="submit" disabled={loading} className="mouj-cta mt-2">
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Send Reset Link"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mouj-muted mt-6 tracking-wide">
          MOUJ PHARMACEUTICALS · ERP
        </p>
      </div>
    </div>
  );
}
