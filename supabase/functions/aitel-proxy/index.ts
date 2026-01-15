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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    // Use getClaims for more reliable JWT validation
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = claimsData.claims.sub as string;

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
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
        
      console.log("Creating agent with config:", JSON.stringify(body, null, 2));
      
      response = await fetch(`${BOLNA_API_BASE}/v2/agent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BOLNA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Bolna API error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Bolna API error: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

      case "stop-agent":
        // Stop all queued calls for an agent - admin or engineer only
        if (userRole !== "admin" && userRole !== "engineer") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const stopAgentId = url.searchParams.get("agent_id");
        if (!stopAgentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/v2/agent/${stopAgentId}/stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      // ==========================================
      // CALL MANAGEMENT
      // ==========================================
      case "make-call":
        // Validate required fields
        if (!body.phone_number) {
          return new Response(
            JSON.stringify({ error: "phone_number is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

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

        // Get the external agent ID from our database (body.agent_id is our internal UUID)
        const { data: agentRecord } = await supabase
          .from("aitel_agents")
          .select("external_agent_id")
          .eq("id", body.agent_id)
          .maybeSingle();

        if (!agentRecord?.external_agent_id) {
          return new Response(
            JSON.stringify({ error: "Agent not found in database" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get the client's allocated phone number (caller ID)
        const { data: clientPhone } = await supabase
          .from("client_phone_numbers")
          .select("phone_number")
          .eq("client_id", body.client_id)
          .eq("is_active", true)
          .maybeSingle();

        if (!clientPhone?.phone_number) {
          return new Response(
            JSON.stringify({ error: "No phone number allocated. Please contact admin to allocate a phone number." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Make outbound call via Bolna - POST /call using the actual Bolna agent ID
        response = await fetch(`${BOLNA_API_BASE}/call`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agentRecord.external_agent_id,
            recipient_phone_number: body.phone_number,
            from_phone_number: clientPhone.phone_number,
            user_data: body.user_data,
          }),
        });

        if (response.ok) {
          const callResult = await response.json();
          
          // Create call record in database - execution_id is the call identifier
          await supabase.from("calls").insert({
            lead_id: body.phone_number, // Store phone number as lead_id for reference
            agent_id: body.agent_id,
            client_id: body.client_id,
            external_call_id: callResult.execution_id,
            status: "initiated",
            started_at: new Date().toISOString(),
          });

          return new Response(
            JSON.stringify({ 
              success: true, 
              execution_id: callResult.execution_id,
              status: callResult.status,
              message: callResult.message 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;

      case "make-demo-call":
        // Demo calls for engineers - no credit check, phone number passed directly
        if (userRole !== "admin" && userRole !== "engineer") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const demoAgentId = body.agent_id; // This is the external Bolna agent ID
        const recipientPhone = body.recipient_phone_number;

        if (!demoAgentId || !recipientPhone) {
          return new Response(
            JSON.stringify({ error: "agent_id and recipient_phone_number are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Make outbound demo call via Bolna
        console.log("Making demo call to:", recipientPhone, "with agent:", demoAgentId);
        
        const demoCallResponse = await fetch(`${BOLNA_API_BASE}/call`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: demoAgentId,
            recipient_phone_number: recipientPhone,
            from_phone_number: body.from_phone_number,
            user_data: body.user_data,
          }),
        });

        if (demoCallResponse.ok) {
          const demoCallResult = await demoCallResponse.json();
          console.log("Demo call initiated successfully:", demoCallResult);
          return new Response(
            JSON.stringify({ 
              success: true, 
              execution_id: demoCallResult.execution_id,
              status: demoCallResult.status,
              message: demoCallResult.message 
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await demoCallResponse.text();
          console.error("Demo call failed - Bolna API error:", demoCallResponse.status, errorText);
          return new Response(
            JSON.stringify({ error: `Call failed: ${errorText || 'Unknown error from provider'}` }),
            { status: demoCallResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

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

      case "stop-call":
        // Stop a queued or scheduled call - POST /call/{execution_id}/stop
        const stopCallId = url.searchParams.get("execution_id");
        if (!stopCallId) {
          return new Response(
            JSON.stringify({ error: "execution_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/call/${stopCallId}/stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });

        if (response.ok) {
          // Update call record status
          await supabase
            .from("calls")
            .update({ status: "stopped" })
            .eq("external_call_id", stopCallId);
        }
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
        
        // GET /executions/{execution_id}
        response = await fetch(`${BOLNA_API_BASE}/executions/${executionId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "sync-call-status": {
        // Sync call status from Bolna to our database
        const syncExecutionId = url.searchParams.get("execution_id");
        const internalCallId = url.searchParams.get("call_id");
        
        if (!syncExecutionId || !internalCallId) {
          return new Response(
            JSON.stringify({ error: "execution_id and call_id are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch execution data from Bolna
        const execResponse = await fetch(`${BOLNA_API_BASE}/executions/${syncExecutionId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });

        if (!execResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch execution from Bolna" }),
            { status: execResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const executionData = await execResponse.json();
        console.log("Execution data from Bolna:", JSON.stringify(executionData));

        // Map Bolna status to our DB status (Bolna uses hyphens, we use underscores)
        const bolnaStatus = executionData.status || "initiated";
        const telephonyData = executionData.telephony_data || {};
        const conversationTime = executionData.conversation_time || executionData.conversation_duration;
        
        // Duration in seconds from telephony_data.duration (string) or conversation_time (number)
        let durationSeconds = 0;
        if (telephonyData.duration) {
          durationSeconds = Math.round(parseFloat(telephonyData.duration)) || 0;
        } else if (conversationTime !== undefined) {
          durationSeconds = Math.round(conversationTime);
        }
        
        // Terminal statuses - these indicate the call has ended
        const terminalBolnaStatuses = ["completed", "call-disconnected", "no-answer", "busy", "failed", "canceled", "stopped"];
        const isTerminal = terminalBolnaStatuses.includes(bolnaStatus);
        
        // Determine if connected (45+ seconds) - only for terminal calls
        const isConnected = isTerminal && durationSeconds >= 45;
        
        // Map Bolna statuses to our DB constraint-valid statuses
        const statusMap: Record<string, string> = {
          "initiated": "initiated",
          "queued": "initiated",
          "ringing": "ringing",
          "in-progress": "in_progress",
          "in_progress": "in_progress",
          "completed": "completed",
          "call-disconnected": "completed",
          "no-answer": "no_answer",
          "no_answer": "no_answer",
          "busy": "failed",
          "failed": "failed",
          "canceled": "failed",
          "stopped": "failed",
          "balance-low": "failed",
        };
        
        const finalStatus = statusMap[bolnaStatus] || "initiated";
        
        // Build update object - always update status
        const updateData: Record<string, unknown> = {
          status: finalStatus,
        };
        
        // For terminal statuses, update all completion data
        if (isTerminal) {
          updateData.duration_seconds = durationSeconds;
          updateData.connected = isConnected;
          updateData.ended_at = new Date().toISOString();
          
          // Get recording URL and transcript if available
          if (telephonyData.recording_url) {
            updateData.recording_url = telephonyData.recording_url;
          }
          if (executionData.transcript) {
            updateData.transcript = executionData.transcript;
          }
        }

        console.log("Updating call with data:", JSON.stringify(updateData));

        // Update call in database
        const { error: updateError } = await supabase
          .from("calls")
          .update(updateData)
          .eq("id", internalCallId);

        if (updateError) {
          console.error("Failed to update call:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update call record" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update lead status for terminal statuses
        if (isTerminal) {
          const { data: callData } = await supabase
            .from("calls")
            .select("lead_id")
            .eq("id", internalCallId)
            .single();
            
          if (callData?.lead_id) {
            await supabase
              .from("leads")
              .update({ status: isConnected ? "connected" : "completed" })
              .eq("id", callData.lead_id);
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: finalStatus,
            duration_seconds: durationSeconds,
            connected: isConnected,
            aitel_status: bolnaStatus,
            is_terminal: isTerminal
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-execution-logs":
        const logsExecutionId = url.searchParams.get("execution_id");
        if (!logsExecutionId) {
          return new Response(
            JSON.stringify({ error: "execution_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // GET /executions/{execution_id}/log
        response = await fetch(`${BOLNA_API_BASE}/executions/${logsExecutionId}/log`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "list-agent-executions":
        // GET /v2/agent/{agent_id}/executions with pagination and filters
        const listExecAgentId = url.searchParams.get("agent_id");
        if (!listExecAgentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const execQueryParams = new URLSearchParams();
        
        // Pagination
        const pageNumber = url.searchParams.get("page_number");
        const pageSize = url.searchParams.get("page_size");
        if (pageNumber) execQueryParams.set("page_number", pageNumber);
        if (pageSize) execQueryParams.set("page_size", pageSize);
        
        // Filters
        const status = url.searchParams.get("status");
        const callType = url.searchParams.get("call_type");
        const provider = url.searchParams.get("provider");
        const answeredByVoicemail = url.searchParams.get("answered_by_voice_mail");
        const batchId = url.searchParams.get("batch_id");
        const fromDate = url.searchParams.get("from");
        const toDate = url.searchParams.get("to");
        
        if (status) execQueryParams.set("status", status);
        if (callType) execQueryParams.set("call_type", callType);
        if (provider) execQueryParams.set("provider", provider);
        if (answeredByVoicemail) execQueryParams.set("answered_by_voice_mail", answeredByVoicemail);
        if (batchId) execQueryParams.set("batch_id", batchId);
        if (fromDate) execQueryParams.set("from", fromDate);
        if (toDate) execQueryParams.set("to", toDate);
        
        response = await fetch(
          `${BOLNA_API_BASE}/v2/agent/${listExecAgentId}/executions?${execQueryParams}`,
          { headers: { Authorization: `Bearer ${BOLNA_API_KEY}` } }
        );
        break;

      // ==========================================
      // VOICES
      // ==========================================
      case "list-voices":
        response = await fetch(`${BOLNA_API_BASE}/voice/all`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      // ==========================================
      // BATCH MANAGEMENT
      // ==========================================
      case "create-batch": {
        // Create batch for agent - requires multipart/form-data with CSV
        if (userRole !== "admin" && userRole !== "client") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const createBatchAgentId = body?.agent_id;
        const csvContent = body?.csv_content;
        const fromPhoneNumber = body?.from_phone_number;

        if (!createBatchAgentId || !csvContent) {
          return new Response(
            JSON.stringify({ error: "agent_id and csv_content are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append("agent_id", createBatchAgentId);
        formData.append("file", new Blob([csvContent], { type: "text/csv" }), "batch.csv");
        if (fromPhoneNumber) {
          formData.append("from_phone_number", fromPhoneNumber);
        }

        response = await fetch(`${BOLNA_API_BASE}/batches`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
          },
          body: formData,
        });
        break;
      }

      case "get-batch": {
        const getBatchId = url.searchParams.get("batch_id");
        if (!getBatchId) {
          return new Response(
            JSON.stringify({ error: "batch_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/batches/${getBatchId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      case "list-batches": {
        const listBatchesAgentId = url.searchParams.get("agent_id");
        if (!listBatchesAgentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/batches/${listBatchesAgentId}/all`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      case "schedule-batch": {
        if (userRole !== "admin" && userRole !== "client") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const scheduleBatchId = url.searchParams.get("batch_id");
        const scheduledAt = body?.scheduled_at;

        if (!scheduleBatchId || !scheduledAt) {
          return new Response(
            JSON.stringify({ error: "batch_id and scheduled_at are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Schedule batch - uses multipart/form-data
        const scheduleFormData = new FormData();
        scheduleFormData.append("scheduled_at", scheduledAt);

        response = await fetch(`${BOLNA_API_BASE}/batches/${scheduleBatchId}/schedule`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
          },
          body: scheduleFormData,
        });
        break;
      }

      case "stop-batch": {
        if (userRole !== "admin" && userRole !== "client") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const stopBatchId = url.searchParams.get("batch_id");
        if (!stopBatchId) {
          return new Response(
            JSON.stringify({ error: "batch_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/batches/${stopBatchId}/stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      case "list-batch-executions": {
        const batchExecId = url.searchParams.get("batch_id");
        if (!batchExecId) {
          return new Response(
            JSON.stringify({ error: "batch_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/batches/${batchExecId}/executions`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      case "delete-batch": {
        if (userRole !== "admin") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const deleteBatchId = url.searchParams.get("batch_id");
        if (!deleteBatchId) {
          return new Response(
            JSON.stringify({ error: "batch_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        response = await fetch(`${BOLNA_API_BASE}/batches/${deleteBatchId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      // ==========================================
      // PHONE NUMBERS
      // ==========================================
      case "search-phone-numbers": {
        const country = url.searchParams.get("country");
        if (!country) {
          return new Response(
            JSON.stringify({ error: "country is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const phoneSearchParams = new URLSearchParams();
        phoneSearchParams.set("country", country);
        
        const pattern = url.searchParams.get("pattern");
        if (pattern) {
          phoneSearchParams.set("pattern", pattern);
        }
        
        response = await fetch(`${BOLNA_API_BASE}/phone-numbers/search?${phoneSearchParams}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      case "list-phone-numbers": {
        response = await fetch(`${BOLNA_API_BASE}/phone-numbers/all`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;
      }

      case "assign-phone-number": {
        // Admin only - assign phone number to an agent
        if (userRole !== "admin") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const phoneNumberId = body?.phone_number_id;
        const assignAgentId = body?.agent_id; // null to unassign

        if (!phoneNumberId) {
          return new Response(
            JSON.stringify({ error: "phone_number_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Use PATCH /phone-numbers/{phone_number_id} to assign/unassign
        response = await fetch(`${BOLNA_API_BASE}/phone-numbers/${phoneNumberId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: assignAgentId,
          }),
        });

        if (response.ok) {
          return new Response(
            JSON.stringify({ message: assignAgentId ? "Phone number assigned successfully" : "Phone number unassigned successfully" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      case "download-recording": {
        // Proxy recording download to hide Bolna URL from clients
        const recordingUrl = url.searchParams.get("url");
        if (!recordingUrl) {
          return new Response(
            JSON.stringify({ error: "Recording URL is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch the recording from the external URL
        const recordingResponse = await fetch(recordingUrl);
        if (!recordingResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch recording" }),
            { status: recordingResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get the audio content
        const audioBlob = await recordingResponse.arrayBuffer();
        
        // Return the audio with proper headers for download
        return new Response(audioBlob, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Content-Disposition": `attachment; filename="call-recording.mp3"`,
          },
        });
      }

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
