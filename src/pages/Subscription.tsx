import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Upload, Copy, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const BANK_DETAILS = {
  name: "Arslan Amir",
  bank: "Meezan Bank",
  account: "09020103209991",
};

export default function Subscription() {
  const { tenantId, subscriptionStatus, subscriptionEndsAt, daysRemaining } = useTenant();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState("monthly");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (tenantId) loadSubmissions();
  }, [tenantId]);

  const loadSubmissions = async () => {
    const { data } = await supabase
      .from("payment_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSubmissions(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleSubmit = async () => {
    if (!file || !amount || !user || !tenantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-screenshots")
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("payment_submissions")
        .insert({
          tenant_id: tenantId,
          submitted_by: user.id,
          amount: parseFloat(amount),
          plan,
          screenshot_url: urlData.publicUrl || path,
        });
      if (insertError) throw insertError;

      toast.success("Payment submitted for review!");
      setFile(null);
      setAmount("");
      loadSubmissions();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const isExpired = subscriptionStatus === "expired";
  const isTrial = subscriptionStatus === "trial";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Status Banner */}
        <Card className={`border-l-4 ${isExpired ? "border-l-destructive" : isTrial ? "border-l-amber-500" : "border-l-emerald-500"}`}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isExpired ? "bg-destructive/10" : isTrial ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
              {isExpired ? <AlertTriangle className="h-6 w-6 text-destructive" /> :
                <Clock className={`h-6 w-6 ${isTrial ? "text-amber-500" : "text-emerald-500"}`} />}
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading">
                {isExpired ? "Subscription Expired" : isTrial ? "Free Trial" : "Active Subscription"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isExpired
                  ? "Your access has expired. Please make a payment to continue."
                  : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining — expires ${subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString() : ""}`}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" /> Bank Transfer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Transfer to the following account and upload the screenshot below:</p>
            {[
              { label: "Account Holder", value: BANK_DETAILS.name },
              { label: "Bank", value: BANK_DETAILS.bank },
              { label: "Account Number", value: BANK_DETAILS.account },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="font-mono font-semibold text-foreground">{item.value}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(item.value)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs font-medium text-primary">Pricing</p>
              <p className="text-sm text-foreground">Monthly: <strong>PKR 5,000/mo</strong> &nbsp;|&nbsp; Yearly: <strong>PKR 45,000/yr</strong></p>
            </div>
          </CardContent>
        </Card>

        {/* Upload Form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" /> Upload Payment Screenshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Amount (PKR)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly - PKR 5,000</SelectItem>
                  <SelectItem value="yearly">Yearly - PKR 45,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Screenshot</Label>
              <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleSubmit} disabled={uploading || !file || !amount} className="w-full">
              {uploading ? "Uploading..." : "Submit Payment"}
            </Button>
          </CardContent>
        </Card>

        {/* Submission History */}
        {submissions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div>
                    <p className="text-sm font-medium">PKR {Number(s.amount).toLocaleString()} — {s.plan}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                    {s.admin_notes && <p className="text-xs text-destructive mt-1">{s.admin_notes}</p>}
                  </div>
                  <Badge className={
                    s.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                    s.status === "rejected" ? "bg-destructive/10 text-destructive" :
                    "bg-amber-500/10 text-amber-600"
                  }>
                    {s.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                    {s.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                    {s.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                    {s.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
