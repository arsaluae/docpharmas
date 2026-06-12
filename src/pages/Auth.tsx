import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, ShieldCheck, Building2, Phone } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "forgot" | "signup";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
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
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setFailedAttempts((n) => n + 1);
          throw error;
        }
        // Block deactivated users from entering the app
        const uid = signInData.user?.id;
        if (uid) {
          const { data: tu } = await (supabase as any)
            .from("tenant_users")
            .select("is_active")
            .eq("user_id", uid)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          if (!tu) {
            await supabase.auth.signOut();
            setFailedAttempts(0);
            throw new Error("Your account has been deactivated. Please contact your administrator.");
          }
        }
        setFailedAttempts(0);
        navigate("/dashboard");

      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setResetSent(true);
      } else {
        // signup
        if (!companyName.trim()) throw new Error("Company name is required");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { company_name: companyName, phone },
          },
        });
        if (error) throw error;
        if (!data.user) throw new Error("Signup failed — no user returned");

        // Register pending signup via edge function (uses service-role to bypass RLS)
        const { error: fnErr } = await supabase.functions.invoke("manage-tenant", {
          body: {
            action: "create_pending_signup",
            user_id: data.user.id,
            email,
            company_name: companyName,
            phone: phone || null,
          },
        });
        if (fnErr) throw new Error(fnErr.message || "Could not register pending signup");

        setSignupSuccess(true);
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

  const titleMap: Record<Mode, string> = {
    login: "Sign in",
    forgot: "Reset password",
    signup: "Create account",
  };
  const subMap: Record<Mode, string> = {
    login: "Enter your credentials to access your workspace.",
    forgot: "We'll email you a secure reset link.",
    signup: "Register your company — activation requires admin approval.",
  };

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
            <div className="mouj-auth-mobile-brand flex-col items-start mb-8">
              <Wordmark />
            </div>

            {signupSuccess ? (
              <div>
                <h2 className="mb-1.5">Account submitted</h2>
                <p className="text-[13px] mouj-muted mb-7">
                  Check your inbox to confirm your email, then wait for admin approval.
                  You'll receive a notification once your workspace is activated.
                </p>
                <button
                  onClick={() => { setSignupSuccess(false); setMode("login"); setCompanyName(""); setPhone(""); setPassword(""); }}
                  className="mouj-cta"
                >
                  Back to sign in
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : resetSent ? (
              <div>
                <h2 className="mb-1.5">Check your inbox</h2>
                <p className="text-[13px] mouj-muted mb-7">
                  We've sent a password reset link to <span className="text-foreground/90 font-medium">{email}</span>.
                  The link expires in 1 hour. Don't see it? Check your spam folder.
                </p>
                <button
                  onClick={() => { setResetSent(false); setMode("login"); setPassword(""); }}
                  className="mouj-cta"
                >
                  Back to sign in
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-1.5">{titleMap[mode]}</h2>
                <p className="text-[13px] mouj-muted mb-7">{subMap[mode]}</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === "signup" && (
                    <>
                      <div>
                        <label className="mouj-label">Company name</label>
                        <div className="relative">
                          <Building2 className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-[1]" />
                          <input
                            type="text"
                            placeholder="Acme Pharma (Pvt) Ltd"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="mouj-input"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mouj-label">Phone (optional)</label>
                        <div className="relative">
                          <Phone className="mouj-input-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 z-[1]" />
                          <input
                            type="tel"
                            placeholder="+92 300 0000000"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="mouj-input"
                          />
                        </div>
                      </div>
                    </>
                  )}

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

                  {mode !== "forgot" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="mouj-label mb-0">Password</label>
                        {mode === "login" && (
                          <button type="button" onClick={() => setMode("forgot")} className="mouj-link">
                            Forgot?
                          </button>
                        )}
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

                  {mode === "login" && failedAttempts >= 2 && (
                    <div className="text-[12px] mouj-muted -mt-1 px-0.5">
                      Trouble signing in?{" "}
                      <button
                        type="button"
                        onClick={() => { setFailedAttempts(0); setMode("forgot"); }}
                        className="mouj-link"
                      >
                        Reset your password →
                      </button>
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
                    {loading
                      ? "Please wait…"
                      : mode === "login"
                        ? "Sign In"
                        : mode === "forgot"
                          ? "Send Reset Link"
                          : "Create account"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>

                {mode !== "forgot" && (
                  <div className="mt-5 text-center text-[12px] mouj-muted">
                    {mode === "login" ? (
                      <>
                        Don't have an account?{" "}
                        <button type="button" onClick={() => setMode("signup")} className="mouj-link">
                          Create one
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button type="button" onClick={() => setMode("login")} className="mouj-link">
                          Sign in
                        </button>
                      </>
                    )}
                  </div>
                )}

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
