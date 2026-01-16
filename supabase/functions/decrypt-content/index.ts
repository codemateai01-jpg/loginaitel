/**
 * Secure decryption endpoint for encrypted transcripts and summaries.
 * This endpoint performs authentication and authorization checks before decrypting.
 * Frontend MUST call this endpoint to get readable content - no client-side decryption.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptData, type EncryptedPayload } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Production-safe logging
const IS_PRODUCTION = Deno.env.get("ENVIRONMENT") === "production";

function debugLog(message: string, data?: unknown) {
  if (!IS_PRODUCTION) {
    console.log(`[decrypt-content] ${message}`, data ? JSON.stringify(data, null, 2) : "");
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user role for authorization
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = roleData?.role || "client";
    debugLog("User authenticated", { userId: user.id, role: userRole });

    // Parse request
    const body = await req.json();
    const { type, resource_id, encrypted_payload } = body as {
      type: "transcript" | "summary" | "notes";
      resource_id: string;
      encrypted_payload: EncryptedPayload;
    };

    if (!type || !encrypted_payload) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate encrypted payload structure
    if (!encrypted_payload.encrypted || !encrypted_payload.ciphertext || !encrypted_payload.iv) {
      return new Response(
        JSON.stringify({ error: "Invalid encrypted payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization check - verify user has access to this resource
    if (resource_id) {
      // For calls, check if user owns the call or is admin
      if (userRole === "client") {
        const { data: callData } = await supabase
          .from("calls")
          .select("client_id")
          .eq("id", resource_id)
          .single();

        if (callData && callData.client_id !== user.id) {
          return new Response(
            JSON.stringify({ error: "Access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      // Engineers can only access their demo calls
      if (userRole === "engineer") {
        const { data: demoData } = await supabase
          .from("demo_calls")
          .select("engineer_id")
          .eq("id", resource_id)
          .single();

        if (demoData && demoData.engineer_id !== user.id) {
          // Check if it's a regular call they have access to through tasks
          const { data: taskAccess } = await supabase
            .from("tasks")
            .select("id")
            .eq("assigned_to", user.id)
            .limit(1);
          
          if (!taskAccess?.length) {
            return new Response(
              JSON.stringify({ error: "Access denied" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
      // Admins have full access
    }

    // Decrypt the content
    const decryptedContent = await decryptData(encrypted_payload);

    debugLog("Content decrypted successfully", { type, resource_id });

    return new Response(
      JSON.stringify({ 
        content: decryptedContent,
        type,
        resource_id,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Never expose detailed errors in production
    const safeError = IS_PRODUCTION ? "Decryption failed" : errorMessage;
    
    if (!IS_PRODUCTION) {
      console.error("[decrypt-content] Error:", errorMessage);
    }

    return new Response(
      JSON.stringify({ error: safeError }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
