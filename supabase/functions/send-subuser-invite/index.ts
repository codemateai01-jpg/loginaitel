import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  subUserId: string;
  email: string;
  fullName: string;
  role: string;
  clientName: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller is a client
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "client") {
      return new Response(JSON.stringify({ error: "Only clients can send invites" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subUserId, email, fullName, role, clientName }: InviteRequest = await req.json();

    // Generate invite token
    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Update sub-user with invite token
    const { error: updateError } = await supabaseClient
      .from("client_sub_users")
      .update({
        invite_token: inviteToken,
        invite_expires_at: expiresAt.toISOString(),
      })
      .eq("id", subUserId)
      .eq("client_id", user.id);

    if (updateError) {
      throw updateError;
    }

    // Get the app URL from environment or use default
    const appUrl = Deno.env.get("APP_URL") || "https://loginaitel.lovable.app";
    const inviteLink = `${appUrl}/invite/${inviteToken}`;

    const roleLabels: Record<string, string> = {
      monitoring: "Call Monitoring Team",
      telecaller: "Telecaller Team",
      lead_manager: "Lead Manager",
    };

    // Send invite email if Resend is configured
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      await resend.emails.send({
        from: "Aitel <noreply@resend.dev>",
        to: [email],
        subject: `You're invited to join ${clientName}'s team on Aitel`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
              .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
              .role-badge { display: inline-block; background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>You're Invited!</h1>
              </div>
              <div class="content">
                <p>Hi ${fullName || "there"},</p>
                <p><strong>${clientName}</strong> has invited you to join their team on Aitel as a <span class="role-badge">${roleLabels[role] || role}</span>.</p>
                <p>As a ${roleLabels[role] || role}, you'll be able to:</p>
                <ul>
                  ${role === "monitoring" ? `
                    <li>View call recordings and transcripts</li>
                    <li>Monitor call analytics and performance</li>
                    <li>Access real-time call data</li>
                  ` : ""}
                  ${role === "telecaller" ? `
                    <li>View and follow up on interested leads</li>
                    <li>Make calls to assigned leads</li>
                    <li>Update lead status and notes</li>
                  ` : ""}
                  ${role === "lead_manager" ? `
                    <li>Manage all leads and assignments</li>
                    <li>Assign leads to telecallers</li>
                    <li>View campaign analytics</li>
                  ` : ""}
                </ul>
                <p style="text-align: center;">
                  <a href="${inviteLink}" class="button">Accept Invitation</a>
                </p>
                <p style="font-size: 12px; color: #6b7280;">This invitation expires in 7 days.</p>
              </div>
              <div class="footer">
                <p>Powered by Aitel AI Voice Platform</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        inviteLink,
        message: resendApiKey ? "Invite email sent" : "Invite created (email not configured)"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
