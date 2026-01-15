import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  email: string;
  otp: string;
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

    const { email, otp }: VerifyOtpRequest = await req.json();

    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find valid OTP
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("email_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("otp_code", otp)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching OTP:", fetchError);
      throw new Error("Failed to verify OTP");
    }

    if (!otpRecord) {
      throw new Error("Invalid or expired OTP");
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from("email_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
      
      // Check if they have client role
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleData && roleData.role !== "client") {
        throw new Error("You don't have client access. Please use the correct login portal.");
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        throw new Error("Failed to create account");
      }

      userId = newUser.user.id;
      isNewUser = true;

      // Create client role
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "client",
      });

      // Create profile
      await supabaseAdmin.from("profiles").insert({
        user_id: userId,
        email: normalizedEmail,
        full_name: "",
      });

      // Create initial credits record
      await supabaseAdmin.from("client_credits").insert({
        client_id: userId,
        balance: 0,
        price_per_credit: 5,
      });
    }

    // Generate a magic link for seamless login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

    if (linkError || !linkData) {
      console.error("Error generating link:", linkError);
      throw new Error("Failed to complete authentication");
    }

    // Extract the token from the link
    const tokenHash = linkData.properties?.hashed_token;

    // Clean up used OTP
    await supabaseAdmin
      .from("email_otps")
      .delete()
      .eq("email", normalizedEmail);

    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        userId,
        tokenHash,
        email: normalizedEmail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
