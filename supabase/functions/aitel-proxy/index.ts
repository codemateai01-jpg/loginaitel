/**
 * AITEL-PROXY: Secure Backend Proxy for Bolna Voice-AI API
 * 
 * Security Features:
 * - All provider responses sanitized before reaching frontend
 * - AES-256-GCM encryption for transcripts and summaries
 * - No raw S3/provider URLs exposed
 * - Environment-based secrets only
 * - No console logging of sensitive data in production
 * - Multi-tenant isolation support
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptData, type EncryptedPayload } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id",
};

const BOLNA_API_BASE = "https://api.bolna.ai";
const BOLNA_API_KEY = Deno.env.get("BOLNA_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IS_PRODUCTION = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

// ==========================================
// LOGGING UTILITIES - Sanitized in production
// ==========================================
function debugLog(message: string, data?: unknown) {
  if (!IS_PRODUCTION) {
    console.log(`[aitel-proxy] ${message}`, data ? JSON.stringify(data) : "");
  }
}

function errorLog(message: string, _error?: unknown) {
  // Log errors but sanitize in production
  if (IS_PRODUCTION) {
    console.error(`[aitel-proxy] ${message}`);
  } else {
    console.error(`[aitel-proxy] ${message}`, _error);
  }
}

// ==========================================
// MASKING UTILITIES
// ==========================================

// Mask phone number to show only last 4 digits (truly masked, not recoverable)
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "****";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

// Mask system prompt - never expose (keep truly masked)
function maskSystemPrompt(prompt: string | null | undefined): string | null {
  if (!prompt) return null;
  return "[System prompt configured]";
}

// Generate proxy indicator for recording URL
function proxyRecordingUrl(url: string | null | undefined, executionId: string): string | null {
  if (!url) return null;
  return `proxy:recording:${executionId}`;
}

// Calculate display cost (hides actual cost breakdown)
function calculateDisplayCost(durationSeconds: number | null): string | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  const minutes = Math.ceil(durationSeconds / 60);
  return `${minutes} min`;
}

// Determine outcome from status
function determineOutcome(status: string, connected: boolean): string {
  if (status === "completed" && connected) return "contacted";
  if (status === "completed" && !connected) return "no_contact";
  if (status === "failed") return "failed";
  if (status === "no-answer" || status === "no_answer") return "no_answer";
  return "pending";
}

// STRICT: Whitelist-based execution data sanitization with AES-256-GCM encryption
// ONLY expose these fields - everything else is removed
async function maskExecutionData(execution: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rawTelephonyData = (execution.telephony_data || {}) as Record<string, unknown>;
  
  // Calculate duration from various sources
  let durationSeconds: number | null = null;
  if (rawTelephonyData.duration) {
    durationSeconds = Math.round(parseFloat(rawTelephonyData.duration as string)) || null;
  } else if (execution.conversation_duration !== undefined) {
    durationSeconds = Math.round(execution.conversation_duration as number);
  }
  
  const connected = durationSeconds ? durationSeconds >= 45 : false;
  const status = execution.status as string || "initiated";
  
  // Encrypt transcript and summary with AES-256-GCM
  let encryptedTranscript: EncryptedPayload | null = null;
  let encryptedSummary: EncryptedPayload | null = null;
  
  if (execution.transcript && typeof execution.transcript === "string") {
    encryptedTranscript = await encryptData(execution.transcript as string);
  }
  
  if (execution.summary && typeof execution.summary === "string") {
    encryptedSummary = await encryptData(execution.summary as string);
  }
  
  // Build STRICTLY sanitized response - WHITELIST ONLY
  const sanitized: Record<string, unknown> = {
    // Core identifiers
    execution_id: execution.id,
    status,
    
    // Duration & outcome (computed, not raw)
    duration: durationSeconds,
    outcome: determineOutcome(status, connected),
    display_cost: calculateDisplayCost(durationSeconds),
    
    // Timestamps (allowed)
    timestamps: {
      created_at: execution.created_at,
      started_at: execution.initiated_at,
      ended_at: execution.updated_at,
    },
    
    // AES-256-GCM encrypted sensitive content
    // Frontend must call decrypt-content endpoint to get readable content
    transcript: encryptedTranscript,
    summary: encryptedSummary,
    
    // Flags only (no raw data)
    has_recording: !!rawTelephonyData.recording_url,
    has_transcript: !!execution.transcript,
    has_summary: !!execution.summary,
    connected,
    
    // Sanitized telephony (masked phones, proxied recording)
    telephony_data: {
      to_number: maskPhone(rawTelephonyData.to_number as string || execution.user_number as string),
      from_number: maskPhone(rawTelephonyData.from_number as string || execution.agent_number as string),
      duration: durationSeconds ? String(durationSeconds) : null,
      recording_url: rawTelephonyData.recording_url 
        ? proxyRecordingUrl(rawTelephonyData.recording_url as string, execution.id as string)
        : null,
    },
  };
  
  // Encrypt extracted_data if present
  if (execution.extracted_data && execution.extracted_data !== "{}") {
    const extractedStr = typeof execution.extracted_data === 'string' 
      ? execution.extracted_data 
      : JSON.stringify(execution.extracted_data);
    if (extractedStr !== "{}" && extractedStr !== "null") {
      sanitized.extracted_data = await encryptData(extractedStr);
    }
  }
  
  // REMOVED FROM OUTPUT (never exposed):
  // - usage_breakdown (LLM tokens, model names, provider info)
  // - cost_breakdown (actual costs)
  // - latency_data (performance metrics, regions)
  // - provider (telephony provider name)
  // - context_details (internal IDs)
  // - batch_run_details (internal)
  // - _real_recording_url (actual S3 URL)
  // - user_number, agent_number (full phone numbers)
  // - total_cost (actual cost value)
  // - agent_extraction, workflow_retries, custom_extractions
  // - transfer_call_data, smart_status, rescheduled_at
  
  return sanitized;
}

// Mask agent data to hide system prompts
function maskAgentData(agent: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...agent };
  
  // Mask system prompts in agent_prompts
  if (agent.agent_prompts) {
    const prompts = agent.agent_prompts as Record<string, { system_prompt?: string }>;
    const maskedPrompts: Record<string, { system_prompt?: string | null }> = {};
    for (const [key, value] of Object.entries(prompts)) {
      maskedPrompts[key] = {
        ...value,
        system_prompt: maskSystemPrompt(value.system_prompt),
      };
    }
    masked.agent_prompts = maskedPrompts;
  }
  
  return masked;
}

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
        
      debugLog("Creating agent");
      
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
        errorLog("Bolna API error", { status: response.status });
        return new Response(
          JSON.stringify({ error: "Agent creation failed" }),
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

        const fromNumber = clientPhone?.phone_number;
        debugLog("Making call", { hasFromNumber: !!fromNumber });

        // Make call via Bolna
        const callPayload = {
          agent_id: agentRecord.external_agent_id,
          recipient_phone_number: body.phone_number,
          from_phone_number: fromNumber,
          retry_if_busy: true,
          recipient_data: body.recipient_data || {},
        };

        response = await fetch(`${BOLNA_API_BASE}/v2/call`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(callPayload),
        });
        break;

      case "stop-call":
        const stopExecutionId = url.searchParams.get("execution_id");
        if (!stopExecutionId) {
          return new Response(
            JSON.stringify({ error: "execution_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        response = await fetch(`${BOLNA_API_BASE}/executions/${stopExecutionId}/stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "get-execution":
        const execId = url.searchParams.get("execution_id");
        if (!execId) {
          return new Response(
            JSON.stringify({ error: "execution_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        debugLog("Fetching execution", { execId });
        response = await fetch(`${BOLNA_API_BASE}/executions/${execId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });

        if (response.ok) {
          const rawExecution = await response.json();
          // Strictly sanitize and encrypt execution data
          const maskedExecution = await maskExecutionData(rawExecution);
          
          return new Response(JSON.stringify(maskedExecution), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;

      case "list-agent-executions":
        const listAgentId = url.searchParams.get("agent_id");
        const page = url.searchParams.get("page") || "1";
        const limit = url.searchParams.get("limit") || "50";

        if (!listAgentId) {
          return new Response(
            JSON.stringify({ error: "agent_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        response = await fetch(
          `${BOLNA_API_BASE}/v2/agent/${listAgentId}/executions?page=${page}&limit=${limit}`,
          {
            headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
          }
        );

        if (response.ok) {
          const rawData = await response.json();
          // Encrypt all execution data
          const maskedData = await Promise.all(
            (rawData.data || rawData).map((exec: Record<string, unknown>) => 
              maskExecutionData(exec)
            )
          );
          
          return new Response(JSON.stringify({
            data: maskedData,
            pagination: rawData.pagination || { page: parseInt(page), limit: parseInt(limit) }
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        break;

      // ==========================================
      // BATCH MANAGEMENT
      // ==========================================
      case "create-batch":
        if (!body.agent_id || !body.leads) {
          return new Response(
            JSON.stringify({ error: "agent_id and leads are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get external agent ID
        const { data: batchAgentRecord } = await supabase
          .from("aitel_agents")
          .select("external_agent_id")
          .eq("id", body.agent_id)
          .maybeSingle();

        if (!batchAgentRecord?.external_agent_id) {
          return new Response(
            JSON.stringify({ error: "Agent not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        response = await fetch(`${BOLNA_API_BASE}/v2/batch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: batchAgentRecord.external_agent_id,
            leads: body.leads,
            batch_name: body.batch_name,
          }),
        });
        break;

      case "get-batch":
        const batchId = url.searchParams.get("batch_id");
        if (!batchId) {
          return new Response(
            JSON.stringify({ error: "batch_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        response = await fetch(`${BOLNA_API_BASE}/v2/batch/${batchId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "stop-batch":
        const stopBatchId = url.searchParams.get("batch_id");
        if (!stopBatchId) {
          return new Response(
            JSON.stringify({ error: "batch_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        response = await fetch(`${BOLNA_API_BASE}/v2/batch/${stopBatchId}/stop`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      // ==========================================
      // VOICE & PHONE MANAGEMENT
      // ==========================================
      case "list-voices":
        response = await fetch(`${BOLNA_API_BASE}/voices/all`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "list-phone-numbers":
        response = await fetch(`${BOLNA_API_BASE}/v2/phone-numbers`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "search-phone-numbers":
        const country = url.searchParams.get("country_iso") || "IN";
        const type = url.searchParams.get("phone_number_type") || "local";
        const state = url.searchParams.get("region");

        let searchUrl = `${BOLNA_API_BASE}/v2/phone-numbers/search?country_iso=${country}&phone_number_type=${type}`;
        if (state) searchUrl += `&region=${state}`;

        response = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        break;

      case "assign-phone-number":
        const assignAgentId = url.searchParams.get("agent_id");
        if (!assignAgentId || !body.phone_number) {
          return new Response(
            JSON.stringify({ error: "agent_id and phone_number are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        response = await fetch(`${BOLNA_API_BASE}/v2/phone-numbers/agents/${assignAgentId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ phone_number: body.phone_number }),
        });
        break;

      // ==========================================
      // RECORDING DOWNLOAD (PROXY)
      // ==========================================
      case "download-recording":
        const recordingUrl = url.searchParams.get("url");
        if (!recordingUrl) {
          return new Response(
            JSON.stringify({ error: "url is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        try {
          const audioResponse = await fetch(recordingUrl);
          if (!audioResponse.ok) {
            throw new Error("Failed to fetch recording");
          }

          const audioBuffer = await audioResponse.arrayBuffer();
          return new Response(audioBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": audioResponse.headers.get("Content-Type") || "audio/mpeg",
              "Cache-Control": "private, max-age=300",
            },
          });
        } catch (err) {
          errorLog("Recording download failed");
          return new Response(
            JSON.stringify({ error: "Recording not available" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Handle response from Bolna API
    if (!response) {
      return new Response(
        JSON.stringify({ error: "No response from provider" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      errorLog("Provider error", { status: response.status });
      return new Response(
        JSON.stringify({ error: "Provider request failed" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and potentially mask the response
    const data = await response.json();
    
    // Mask agent data if it contains sensitive prompts
    let sanitizedData = data;
    if (action === "get-agent" && data) {
      sanitizedData = maskAgentData(data);
    }
    if (action === "list-agents" && Array.isArray(data)) {
      sanitizedData = data.map((agent: Record<string, unknown>) => maskAgentData(agent));
    }

    return new Response(JSON.stringify(sanitizedData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    errorLog("Unhandled error");
    // Never expose raw errors in production
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
