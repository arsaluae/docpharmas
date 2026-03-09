import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import docpharmasLogo from "@/assets/docpharmas-logo.jpg";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);
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
      toast.success("Password updated successfully!");
      navigate("/");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card-glow w-full max-w-md p-8 text-center">
          <img src={docpharmasLogo} alt="DocPharmas" className="h-8 w-8 rounded-lg object-cover mx-auto mb-4" />
          <h2 className="font-heading text-lg text-foreground mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-muted-foreground mb-4">This link may have expired or already been used.</p>
          <Button onClick={() => navigate("/auth")} variant="outline">Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/[0.06] rounded-full blur-3xl" />
      </div>
      <div className="glass-card-glow w-full max-w-md p-8 relative z-10">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <img src={docpharmasLogo} alt="DocPharmas" className="w-10 h-10 rounded-xl object-cover" />
          <h1 className="font-heading font-bold text-2xl text-foreground">DocPharmas</h1>
        </div>
        <h2 className="font-heading text-lg text-center text-foreground mb-1">Set New Password</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">Enter your new password below</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="pl-10 bg-secondary/50 border-border" required minLength={6} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 bg-secondary/50 border-border" required minLength={6} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Updating..." : "Update Password"} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
}
