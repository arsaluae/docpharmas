const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, company_name, trial_ends_at } = await req.json();

    if (!email || !company_name) {
      return new Response(JSON.stringify({ error: "Missing email or company_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trialEndDate = trial_ends_at
      ? new Date(trial_ends_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "7 days from now";

    const loginUrl = "https://docpharmas.lovable.app/auth";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Approved</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9, #0284c7);padding:32px 40px;text-align:center;">
              <img src="https://docpharmas.lovable.app/images/docpharmas-logo.jpg" alt="DocPharmas" width="60" height="60" style="border-radius:12px;margin-bottom:12px;" />
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;letter-spacing:-0.5px;">DocPharmas ERP</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;font-weight:600;">Welcome aboard, ${company_name}! 🎉</h2>
              <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
                Great news — your account has been <strong style="color:#0ea5e9;">approved</strong> and is ready to use. You now have full access to DocPharmas ERP to manage your pharmaceutical distribution business.
              </p>

              <!-- Trial Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-radius:10px;border:1px solid #bae6fd;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="color:#0284c7;font-size:13px;font-weight:600;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">Free Trial Period</p>
                    <p style="color:#1e293b;font-size:16px;font-weight:700;margin:0;">Active until ${trialEndDate}</p>
                    <p style="color:#64748b;font-size:13px;margin:6px 0 0;">Enjoy all features during your 7-day trial. No payment required.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
                      Log In to Your Account →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                <tr>
                  <td style="padding:12px 0;border-top:1px solid #e2e8f0;">
                    <p style="color:#1e293b;font-size:14px;font-weight:600;margin:0 0 12px;">What you can do:</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr><td style="color:#64748b;font-size:13px;padding:3px 0;">✅ Manage customers, suppliers & products</td></tr>
                      <tr><td style="color:#64748b;font-size:13px;padding:3px 0;">✅ Create invoices, proformas & delivery notes</td></tr>
                      <tr><td style="color:#64748b;font-size:13px;padding:3px 0;">✅ Track payments, expenses & bank accounts</td></tr>
                      <tr><td style="color:#64748b;font-size:13px;padding:3px 0;">✅ Generate reports & AI-powered insights</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                Need help? Reach out to us on WhatsApp.<br/>
                © ${new Date().getFullYear()} DocPharmas ERP. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Supabase Auth admin or a simple email API
    // Use the Lovable API to send transactional email
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailResponse = await fetch("https://api.lovable.dev/api/v1/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        to: email,
        subject: `Welcome to DocPharmas ERP — Your Account is Approved!`,
        html: htmlBody,
        purpose: "transactional",
      }),
    });

    const emailResult = await emailResponse.text();
    console.log("Email send result:", emailResponse.status, emailResult);

    if (!emailResponse.ok) {
      console.error("Failed to send email:", emailResult);
      // Don't fail the whole flow if email fails
      return new Response(JSON.stringify({ success: true, email_sent: false, reason: emailResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, email_sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
