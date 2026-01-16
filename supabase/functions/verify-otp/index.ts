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

    // Check if this phone belongs to a sub-user
    const { data: subUserData, error: subUserError } = await supabaseAdmin
      .from("client_sub_users")
      .select("*, profiles:client_id(full_name, email)")
      .eq("phone", formattedPhone)
      .eq("status", "active")
      .maybeSingle();

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
    let isSubUser = false;
    let subUserRole: string | null = null;
    let clientId: string | null = null;

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

      // Update password for existing user so we can sign them in
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: phonePassword }
      );

      if (updateError) {
        console.error("Error updating user password:", updateError);
        throw new Error("Failed to authenticate");
      }

      // Check if this user is a sub-user
      if (subUserData) {
        isSubUser = true;
        subUserRole = subUserData.role;
        clientId = subUserData.client_id;

        // Update the sub-user record with the user_id if not set
        if (!subUserData.user_id) {
          await supabaseAdmin
            .from("client_sub_users")
            .update({ user_id: userId, activated_at: new Date().toISOString() })
            .eq("id", subUserData.id);
        }
      }
    } else {
      // Check if this is a sub-user's first login
      if (subUserData) {
        isSubUser = true;
        subUserRole = subUserData.role;
        clientId = subUserData.client_id;

        // Create new user with email/password for sub-user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: phoneEmail,
          password: phonePassword,
          email_confirm: true,
          user_metadata: {
            phone: formattedPhone,
            sub_user: true,
            client_id: clientId,
            sub_user_role: subUserRole,
            full_name: subUserData.full_name,
          },
        });

        if (createError || !newUser.user) {
          console.error("Error creating user:", createError);
          throw new Error("Failed to create account");
        }

        userId = newUser.user.id;
        isNewUser = true;

        // Create client role for sub-user
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role: "client",
        });

        // Create profile with phone
        await supabaseAdmin.from("profiles").insert({
          user_id: userId,
          email: phoneEmail,
          phone: formattedPhone,
          full_name: subUserData.full_name || "",
        });

        // Update sub-user record with user_id
        await supabaseAdmin
          .from("client_sub_users")
          .update({ 
            user_id: userId, 
            status: "active",
            activated_at: new Date().toISOString() 
          })
          .eq("id", subUserData.id);
      } else {
        // Regular client - create new user
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

    // Log sub-user login activity
    if (isSubUser && subUserData) {
      try {
        await supabaseAdmin.from("sub_user_activity_logs").insert({
          sub_user_id: subUserData.id,
          client_id: subUserData.client_id,
          action_type: isNewUser ? "first_login" : "login",
          description: isNewUser 
            ? `${subUserData.full_name || "Sub-user"} completed first login`
            : `${subUserData.full_name || "Sub-user"} logged in`,
          metadata: {
            phone: formattedPhone,
            role: subUserRole,
          },
        });
      } catch (logError) {
        console.error("Failed to log activity:", logError);
        // Don't fail login if logging fails
      }
    }

    const session = signInData.session;
    // Return a minimal session payload (avoid exposing user/email/phone in response)
    const safeSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      user: {
        id: userId,
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        isSubUser,
        subUserRole,
        clientId,
        session: safeSession,
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