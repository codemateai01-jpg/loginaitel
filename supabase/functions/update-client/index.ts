import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdateClientRequest {
  client_id: string;
  full_name?: string;
  phone?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for updates
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requesting user is an admin
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    let requestingUserId: string;
    if (claimsError || !claimsData?.claims) {
      const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !requestingUser) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      requestingUserId = requestingUser.id;
    } else {
      requestingUserId = claimsData.claims.sub as string;
    }

    // Check if requesting user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUserId)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can update client details" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: UpdateClientRequest = await req.json();
    const { client_id, full_name, phone } = body;

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "Client ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate inputs
    if (full_name !== undefined && full_name.length > 100) {
      return new Response(
        JSON.stringify({ error: "Name must be less than 100 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (phone !== undefined) {
      const cleanedPhone = phone.replace(/\D/g, "");
      if (cleanedPhone.length > 0 && cleanedPhone.length !== 10 && cleanedPhone.length !== 12) {
        return new Response(
          JSON.stringify({ error: "Phone must be a valid 10-digit number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verify the target is actually a client
    const { data: clientRole, error: clientRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", client_id)
      .single();

    if (clientRoleError || clientRole?.role !== "client") {
      return new Response(
        JSON.stringify({ error: "Target user is not a client" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) {
      updateData.full_name = full_name.trim() || null;
    }

    if (phone !== undefined) {
      // Format phone number
      let formattedPhone = phone.replace(/\D/g, "");
      if (formattedPhone.length === 10) {
        formattedPhone = "+91" + formattedPhone;
      } else if (formattedPhone.length === 12 && formattedPhone.startsWith("91")) {
        formattedPhone = "+" + formattedPhone;
      } else if (formattedPhone.length === 0) {
        formattedPhone = "";
      }
      updateData.phone = formattedPhone || null;
    }

    // Update profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("user_id", client_id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update client profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also update auth user metadata if full_name changed
    if (full_name !== undefined) {
      await supabaseAdmin.auth.admin.updateUserById(client_id, {
        user_metadata: { full_name: full_name.trim() || null },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Client updated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
