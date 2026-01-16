import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEAT_PRICE = 300;
const RESEND_API_URL = "https://api.resend.com/emails";

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Aitel <noreply@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find subscriptions due for renewal in the next 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: dueSubs, error: subError } = await supabaseAdmin
      .from("seat_subscriptions")
      .select("*")
      .eq("status", "active")
      .lte("next_billing_date", threeDaysFromNow.toISOString())
      .gte("next_billing_date", today.toISOString());

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    console.log(`Found ${dueSubs?.length || 0} subscriptions due for renewal`);

    const results = [];

    for (const subscription of dueSubs || []) {
      try {
        // Get client profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", subscription.client_id)
          .single();

        if (profileError || !profile?.email) {
          console.log(`No profile found for client ${subscription.client_id}`);
          continue;
        }

        const daysUntilRenewal = Math.ceil(
          (new Date(subscription.next_billing_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const renewalAmount = subscription.seats_count * SEAT_PRICE;
        const renewalDate = new Date(subscription.next_billing_date).toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const siteUrl = Deno.env.get("SITE_URL") || "https://loginaitel.lovable.app";

        // Send reminder email
        await sendEmail(
          profile.email,
          `Seat Subscription Renewal Reminder - ${daysUntilRenewal} day(s) left`,
          `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #000; color: #fff; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .amount { font-size: 24px; font-weight: bold; color: #000; }
                .cta { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; margin-top: 20px; }
                .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Subscription Renewal Reminder</h1>
                </div>
                <div class="content">
                  <p>Hi ${profile.full_name || "there"},</p>
                  <p>Your team seat subscription is due for renewal in <strong>${daysUntilRenewal} day(s)</strong>.</p>
                  
                  <h3>Subscription Details:</h3>
                  <ul>
                    <li><strong>Team Seats:</strong> ${subscription.seats_count}</li>
                    <li><strong>Renewal Date:</strong> ${renewalDate}</li>
                    <li><strong>Amount Due:</strong> <span class="amount">₹${renewalAmount}</span></li>
                  </ul>
                  
                  <p>To ensure uninterrupted access for your team members, please renew your subscription before the due date.</p>
                  
                  <a href="${siteUrl}/client/team" class="cta">
                    Renew Now
                  </a>
                  
                  <p style="margin-top: 20px;">If you have any questions, please contact our support team.</p>
                </div>
                <div class="footer">
                  <p>This is an automated reminder from Aitel.</p>
                </div>
              </div>
            </body>
            </html>
          `
        );

        console.log(`Sent reminder to ${profile.email}`);

        results.push({
          client_id: subscription.client_id,
          email: profile.email,
          seats: subscription.seats_count,
          days_until_renewal: daysUntilRenewal,
          status: "sent",
        });
      } catch (emailError: any) {
        console.error(`Failed to send reminder for ${subscription.client_id}:`, emailError);
        results.push({
          client_id: subscription.client_id,
          status: "failed",
          error: emailError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: results.filter((r) => r.status === "sent").length,
        total_due: dueSubs?.length || 0,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Renewal reminder error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
