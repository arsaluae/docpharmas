import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated");
      setTimeout(() => navigate("/auth"), 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const Wordmark = () => (
    <div>
      <span className="mouj-auth-wordmark">
        MOUJ <span className="mouj-auth-wordmark-accent">PHARMA</span>
      </span>
      <div className="mouj-auth-sub">Pharmaceuticals · ERP</div>
    </div>
  );

  return (
    <div className="mouj-dark-auth">
      <div className="mouj-auth-shell">
        <aside className="mouj-auth-brand">
          <Wordmark />
          <div>
            <h1 className="mouj-auth-headline">
              Set a new<br />
              <em>secure password.</em>
            </h1>
            <p className="mouj-auth-tag">
              Choose a strong password you haven't used before. You'll be redirected
              back to sign in once it's saved.
            </p>
          </div>
          <div className="mouj-auth-meta">
            <span><span className="mouj-auth-dot" />Secure session</span>
            <span>v2.0</span>
          </div>
        </aside>

        <main className="mouj-auth-form-wrap">
          <div className="mouj-auth-card">
            <div className="mouj-auth-mobile-brand flex-col items-start mb-8">
              <Wordmark />
            </div>

            {!isRecovery ? (
              <div>
                <h2 className="mb-1.5">Invalid reset link</h2>
                <p className="text-[13px] mouj-muted mb-7">
                  This link may have expired or already been used. Request a new one from the sign-in page.
                </p>
                <button onClick={() => navigate("/auth")} className="mouj-cta">
                  Back to sign in <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : done ? (
              <div>
                <h2 className="mb-1.5">Password updated</h2>
                <p className="text-[13px] mouj-muted mb-7">
                  Redirecting you to the sign-in page…
                </p>
              </div>
            ) : (
              <>
                <h2 className="mb-1.5">Set new password</h2>
                <p className="text-[13px] mouj-muted mb-7">
                  Enter and confirm your new password below.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mouj-label">New password</label>
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

                  <div>
                    <label className="mouj-label">Confirm password</label>
                    <div className="relative">
                      <Lock className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-[1]" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mouj-input"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="mouj-cta mt-2">
                    {loading ? "Updating…" : "Update password"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                <div className="mouj-foot flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 opacity-60" />
                  <span>Encrypted · role-based access</span>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
