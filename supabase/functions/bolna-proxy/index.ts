import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOLNA_API_BASE = "https://api.bolna.ai";
const BOLNA_API_KEY = Deno.env.get("BOLNA_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BolnaAgentConfig {
  agent_name: string;
  agent_type: string;
  agent_welcome_message?: string;
  tasks?: Array<{
    task_type: string;
    toolchain: {
      execution: string;
      pipelines: string[][];
    };
    tools_config: Record<string, unknown>;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Bolna API key exists
    if (!BOLNA_API_KEY) {
      throw new Error("BOLNA_API_KEY not configured");
    }

    // Get auth token and validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRole = roleData?.role || "client";

    // Parse request
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const body = req.method !== "GET" ? await req.json() : null;

    let response: Response;

    switch (action) {
      // ==========================================
      // AGENT MANAGEMENT
      // ==========================================
      case "list-agents":
        // Only admin and engineers can list all Bolna agents
        if (userRole !== "admin" && userRole !== "engineer") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        response = await fetch(`${BOLNA_API_BASE}/v2/agent/all`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "get-agent":
        const agentId = url.searchParams.get("agent_id");
        if (!agentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        response = await fetch(`${BOLNA_API_BASE}/v2/agent/${agentId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "create-agent":
        // Only engineers can create agents
        if (userRole !== "admin" && userRole !== "engineer") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/v2/agent`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        break;

      case "update-agent":
        // Only engineers can update agents
        if (userRole !== "admin" && userRole !== "engineer") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateAgentId = url.searchParams.get("agent_id");
        if (!updateAgentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/v2/agent/${updateAgentId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        break;

      case "delete-agent":
        // Only admin can delete agents
        if (userRole !== "admin") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const deleteAgentId = url.searchParams.get("agent_id");
        if (!deleteAgentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/v2/agent/${deleteAgentId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      // ==========================================
      // CALL MANAGEMENT
      // ==========================================
      case "make-call":
        // Validate client has credits
        const { data: credits } = await supabase
          .from("client_credits")
          .select("balance")
          .eq("client_id", body.client_id)
          .maybeSingle();

        if (!credits || credits.balance < 1) {
          return new Response(
            JSON.stringify({ error: "Insufficient credits" }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get lead phone number (only client or admin with client_id can access)
        const { data: lead } = await supabase
          .from("leads")
          .select("phone_number, client_id")
          .eq("id", body.lead_id)
          .maybeSingle();

        if (!lead) {
          return new Response(
            JSON.stringify({ error: "Lead not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify user can access this lead
        if (userRole === "client" && lead.client_id !== user.id) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Make outbound call via Bolna
        response = await fetch(`${BOLNA_API_BASE}/call/make`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: body.agent_id,
            recipient_phone_number: lead.phone_number,
            ...body.call_options,
          }),
        });

        if (response.ok) {
          const callResult = await response.json();
          
          // Create call record in database
          await supabase.from("calls").insert({
            lead_id: body.lead_id,
            agent_id: body.agent_id,
            client_id: body.client_id,
            external_call_id: callResult.call_id || callResult.id,
            status: "initiated",
            started_at: new Date().toISOString(),
          });

          // Update lead status
          await supabase
            .from("leads")
            .update({ status: "calling" })
            .eq("id", body.lead_id);

          return new Response(
            JSON.stringify({ success: true, call_id: callResult.call_id || callResult.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;

      case "get-call-status":
        const callId = url.searchParams.get("call_id");
        if (!callId) {
          return new Response(
            JSON.stringify({ error: "call_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/call/${callId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "end-call":
        const endCallId = url.searchParams.get("call_id");
        if (!endCallId) {
          return new Response(
            JSON.stringify({ error: "call_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/call/${endCallId}/end`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      // ==========================================
      // EXECUTION / CALL HISTORY
      // ==========================================
      case "get-execution":
        const executionId = url.searchParams.get("execution_id");
        if (!executionId) {
          return new Response(
            JSON.stringify({ error: "execution_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/execution/${executionId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "list-executions":
        const execAgentId = url.searchParams.get("agent_id");
        const queryParams = new URLSearchParams();
        if (execAgentId) queryParams.set("agent_id", execAgentId);
        
        response = await fetch(`${BOLNA_API_BASE}/execution/all?${queryParams}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      // ==========================================
      // VOICES
      // ==========================================
      case "list-voices":
        response = await fetch(`${BOLNA_API_BASE}/voice/all`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Forward Bolna response
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Bolna proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
