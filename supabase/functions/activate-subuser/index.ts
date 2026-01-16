import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivateRequest {
  inviteToken: string;
  password: string;
  fullName?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { inviteToken, password, fullName }: ActivateRequest = await req.json();

    if (!inviteToken || !password) {
      return new Response(
        JSON.stringify({ error: "Invite token and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the sub-user by invite token
    const { data: subUser, error: subUserError } = await supabaseAdmin
      .from("client_sub_users")
      .select("*")
      .eq("invite_token", inviteToken)
      .single();

    if (subUserError || !subUser) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invite token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invite has expired
    if (new Date(subUser.invite_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invitation has expired. Please contact your administrator." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already activated
    if (subUser.status === "active" && subUser.user_id) {
      return new Response(
        JSON.stringify({ error: "This invitation has already been used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: subUser.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || subUser.full_name,
        sub_user: true,
        client_id: subUser.client_id,
        sub_user_role: subUser.role,
      },
    });

    if (authError) {
      // Check if user already exists
      if (authError.message.includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists. Please use a different email." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw authError;
    }

    // Create profile for the sub-user
    await supabaseAdmin.from("profiles").insert({
      user_id: authUser.user.id,
      email: subUser.email,
      full_name: fullName || subUser.full_name,
    });

    // Assign client role (sub-users use client role but with limited RLS access)
    await supabaseAdmin.from("user_roles").insert({
      user_id: authUser.user.id,
      role: "client",
    });

    // Update sub-user record
    await supabaseAdmin
      .from("client_sub_users")
      .update({
        user_id: authUser.user.id,
        full_name: fullName || subUser.full_name,
        status: "active",
        activated_at: new Date().toISOString(),
        invite_token: null, // Clear the token
      })
      .eq("id", subUser.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account activated successfully",
        email: subUser.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error activating sub-user:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
