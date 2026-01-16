import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOtpAdminRequest {
  phone: string;
  otp: string;
  full_name?: string;
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

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !callerUser) {
      throw new Error("Invalid authorization");
    }

    // Check if caller is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Only admins can create client accounts");
    }

    const { phone, otp, full_name }: VerifyOtpAdminRequest = await req.json();

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
    // Use a consistent password based on phone number
    const phonePassword = `phone_auth_${formattedPhone}_secret_key_2024`;

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === phoneEmail.toLowerCase()
    );

    if (existingUser) {
      // Check if they're already a client
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingRole?.role === "client") {
        throw new Error("A client account with this phone number already exists");
      }
      
      throw new Error("This phone number is already associated with another account type");
    }

    // Create new user with email/password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: phoneEmail,
      password: phonePassword,
      email_confirm: true,
      user_metadata: {
        phone: formattedPhone,
        full_name: full_name || "",
        created_by_admin: true,
      },
    });

    if (createError || !newUser.user) {
      console.error("Error creating user:", createError);
      throw new Error("Failed to create client account");
    }

    const userId = newUser.user.id;

    // Create client role
    const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "client",
    });

    if (roleInsertError) {
      console.error("Error creating role:", roleInsertError);
      // Cleanup: delete the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Failed to assign client role");
    }

    // Create profile with phone
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      email: phoneEmail,
      phone: formattedPhone,
      full_name: full_name || "",
    });

    if (profileError) {
      console.error("Error creating profile:", profileError);
    }

    // Create initial credits record
    const { error: creditsError } = await supabaseAdmin.from("client_credits").insert({
      client_id: userId,
      balance: 0,
      price_per_credit: 5,
    });

    if (creditsError) {
      console.error("Error creating credits:", creditsError);
    }

    // Clean up used OTP
    await supabaseAdmin
      .from("phone_otps")
      .delete()
      .eq("phone", formattedPhone);

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: "Client account created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-otp-admin:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
