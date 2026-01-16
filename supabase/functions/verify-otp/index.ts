import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (!cleaned.startsWith("91") && cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return "+" + cleaned;
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

    const { phone, otp }: VerifyOtpRequest = await req.json();

    if (!phone || !otp) {
      throw new Error("Phone number and OTP are required");
    }

    const formattedPhone = formatPhoneNumber(phone);

    // Find valid OTP
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("phone_otps")
      .select("*")
      .eq("phone", formattedPhone)
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
      .from("phone_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Generate a unique email for this phone user (for Supabase auth)
    const phoneEmail = `${formattedPhone.replace("+", "")}@phone.aitel.local`;
    // Use a consistent password based on phone number (hashed internally by Supabase)
    const phonePassword = `phone_auth_${formattedPhone}_secret_key_2024`;

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === phoneEmail.toLowerCase()
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
      // Create new user with email/password
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: phoneEmail,
        password: phonePassword,
        email_confirm: true,
        user_metadata: {
          phone: formattedPhone,
        },
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

      // Create profile with phone
      await supabaseAdmin.from("profiles").insert({
        user_id: userId,
        email: phoneEmail,
        phone: formattedPhone,
        full_name: "",
      });

      // Create initial credits record
      await supabaseAdmin.from("client_credits").insert({
        client_id: userId,
        balance: 0,
        price_per_credit: 5,
      });
    }

    // Sign in the user and get session
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: phoneEmail,
      password: phonePassword,
    });

    if (signInError || !signInData.session) {
      console.error("Error signing in:", signInError);
      throw new Error("Failed to create session");
    }

    // Clean up used OTP
    await supabaseAdmin
      .from("phone_otps")
      .delete()
      .eq("phone", formattedPhone);

    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        userId,
        session: signInData.session,
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
