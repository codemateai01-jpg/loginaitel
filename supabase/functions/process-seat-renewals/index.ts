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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const siteUrl = Deno.env.get("SITE_URL") || "https://loginaitel.lovable.app";

    // Find subscriptions that are overdue (past their billing date)
    const { data: overdueSubs, error: subError } = await supabaseAdmin
      .from("seat_subscriptions")
      .select("*")
      .eq("status", "active")
      .lt("next_billing_date", today.toISOString());

    if (subError) {
      throw new Error(`Failed to fetch overdue subscriptions: ${subError.message}`);
    }

    console.log(`Found ${overdueSubs?.length || 0} overdue subscriptions`);

    const results = [];
    const expiredClients = [];

    for (const subscription of overdueSubs || []) {
      try {
        // Get client profile
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", subscription.client_id)
          .single();

        const daysOverdue = Math.floor(
          (today.getTime() - new Date(subscription.next_billing_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Grace period: 7 days
        if (daysOverdue > 7) {
          // Expire the subscription
          const { error: updateError } = await supabaseAdmin
            .from("seat_subscriptions")
            .update({
              status: "expired",
              updated_at: new Date().toISOString(),
            })
            .eq("id", subscription.id);

          if (updateError) {
            console.error(`Failed to expire subscription ${subscription.id}:`, updateError);
          } else {
            expiredClients.push(subscription.client_id);

            // Send expiration notice
            if (profile?.email) {
              await sendEmail(
                profile.email,
                "Seat Subscription Expired",
                `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: #dc2626; color: #fff; padding: 20px; text-align: center; }
                      .content { padding: 20px; background: #f9f9f9; }
                      .cta { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; margin-top: 20px; }
                      .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>Subscription Expired</h1>
                      </div>
                      <div class="content">
                        <p>Hi ${profile.full_name || "there"},</p>
                        <p>Your team seat subscription has <strong>expired</strong> due to non-payment.</p>
                        
                        <h3>Impact:</h3>
                        <ul>
                          <li>Your team members (${subscription.seats_count} seats) can no longer access their accounts</li>
                          <li>All lead assignments are paused</li>
                          <li>Telecaller and monitoring features are disabled</li>
                        </ul>
                        
                        <p>To restore access for your team, please renew your subscription immediately.</p>
                        
                        <a href="${siteUrl}/client/team" class="cta">
                          Renew Subscription
                        </a>
                      </div>
                      <div class="footer">
                        <p>This is an automated notice from Aitel.</p>
                      </div>
                    </div>
                  </body>
                  </html>
                `
              );
            }

            results.push({
              client_id: subscription.client_id,
              action: "expired",
              days_overdue: daysOverdue,
            });
          }
        } else {
          // Send overdue payment reminder
          if (profile?.email) {
            const renewalAmount = subscription.seats_count * SEAT_PRICE;
            const graceDaysLeft = 7 - daysOverdue;

            await sendEmail(
              profile.email,
              `URGENT: Payment Overdue - ${graceDaysLeft} days left before suspension`,
              `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #f59e0b; color: #fff; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .amount { font-size: 24px; font-weight: bold; color: #dc2626; }
                    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
                    .cta { display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; margin-top: 20px; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>Payment Overdue</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${profile.full_name || "there"},</p>
                      
                      <div class="warning">
                        <strong>⚠️ Your payment is ${daysOverdue} day(s) overdue.</strong><br>
                        You have <strong>${graceDaysLeft} days</strong> left before your subscription is suspended.
                      </div>
                      
                      <h3>Amount Due:</h3>
                      <p class="amount">₹${renewalAmount}</p>
                      <p>${subscription.seats_count} team seat(s) × ₹${SEAT_PRICE}/month</p>
                      
                      <p>Please complete your payment immediately to avoid service interruption for your team members.</p>
                      
                      <a href="${siteUrl}/client/team" class="cta">
                        Pay Now
                      </a>
                    </div>
                    <div class="footer">
                      <p>This is an automated notice from Aitel.</p>
                    </div>
                  </div>
                </body>
                </html>
              `
            );
          }

          results.push({
            client_id: subscription.client_id,
            action: "reminder_sent",
            days_overdue: daysOverdue,
            grace_days_left: 7 - daysOverdue,
          });
        }
      } catch (processError: any) {
        console.error(`Error processing subscription ${subscription.id}:`, processError);
        results.push({
          client_id: subscription.client_id,
          action: "error",
          error: processError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_overdue: overdueSubs?.length || 0,
        expired_count: expiredClients.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Process renewals error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
