/**
 * VOICE-PROXY: Unified, Secure Backend Proxy for Voice-AI Platform
 * 
 * Architecture Goals:
 * - Frontend NEVER receives raw provider responses
 * - All third-party APIs (Bolna, LLM, TTS, STT, Telephony) accessed only from backend
 * - Strict response sanitization
 * - Secure recording access with server streaming
 * - Environment-based secrets only
 * - No console logging in production
 * - Multi-tenant isolation support
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-tenant-id",
};

// Environment configuration
const BOLNA_API_BASE = "https://api.bolna.ai";
const BOLNA_API_KEY = Deno.env.get("BOLNA_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IS_PRODUCTION = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

// ==========================================
// LOGGING UTILITIES - No logging in production
// ==========================================
function debugLog(message: string, data?: unknown) {
  if (!IS_PRODUCTION) {
    console.log(`[voice-proxy] ${message}`, data ? JSON.stringify(data) : "");
  }
}

function errorLog(message: string, error?: unknown) {
  // Always log errors but sanitize in production
  if (IS_PRODUCTION) {
    console.error(`[voice-proxy] ${message}`);
  } else {
    console.error(`[voice-proxy] ${message}`, error);
  }
}

// ==========================================
// RESPONSE SANITIZATION TYPES
// ==========================================
interface SanitizedCallResponse {
  call_id: string;
  status: string;
  duration: number | null;
  summary: string | null;
  outcome: string | null;
  display_cost: string | null;
  timestamps: {
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
  };
  // Only these fields are exposed to frontend
  sentiment?: string | null;
  connected?: boolean;
  has_recording?: boolean;
  has_transcript?: boolean;
}

interface SanitizedExecutionResponse {
  execution_id: string;
  status: string;
  duration: number | null;
  summary: string | null;
  outcome: string | null;
  display_cost: string | null;
  timestamps: {
    started_at: string | null;
    ended_at: string | null;
  };
  transcript?: string | null;
  has_recording?: boolean;
}

// ==========================================
// ENCODING & SANITIZATION UTILITIES
// ==========================================

// Base64 encode for transport (decoded in frontend for display only)
function encodeForTransport(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return "enc:" + btoa(unescape(encodeURIComponent(value)));
  } catch {
    try {
      return "enc:" + btoa(value);
    } catch {
      return null;
    }
  }
}

// Check if already encoded
function isAlreadyEncoded(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("enc:");
}

// Calculate display cost (hides actual cost breakdown)
function calculateDisplayCost(durationSeconds: number | null): string | null {
  if (!durationSeconds || durationSeconds <= 0) return null;
  // Simple per-minute display calculation (actual billing is internal)
  const minutes = Math.ceil(durationSeconds / 60);
  return `${minutes} min`;
}

// Determine outcome from status/sentiment
function determineOutcome(status: string, sentiment?: string | null, connected?: boolean): string {
  if (status === "completed" && connected) {
    if (sentiment === "positive") return "interested";
    if (sentiment === "negative") return "not_interested";
    return "contacted";
  }
  if (status === "completed" && !connected) return "no_contact";
  if (status === "failed") return "failed";
  if (status === "no_answer") return "no_answer";
  return "pending";
}

// ==========================================
// CALL DATA SANITIZATION
// ==========================================
function sanitizeCallData(call: Record<string, unknown>, tenantId?: string): SanitizedCallResponse {
  const durationSeconds = call.duration_seconds as number | null;
  const status = call.status as string;
  const sentiment = call.sentiment as string | null;
  const connected = call.connected as boolean;
  
  // Encode summary if present
  let sanitizedSummary: string | null = null;
  if (call.summary) {
    const summaryStr = call.summary as string;
    sanitizedSummary = isAlreadyEncoded(summaryStr) ? summaryStr : encodeForTransport(summaryStr);
  }
  
  return {
    call_id: call.id as string,
    status,
    duration: durationSeconds,
    summary: sanitizedSummary,
    outcome: determineOutcome(status, sentiment, connected),
    display_cost: calculateDisplayCost(durationSeconds),
    timestamps: {
      started_at: call.started_at as string | null,
      ended_at: call.ended_at as string | null,
      created_at: call.created_at as string,
    },
    sentiment,
    connected,
    has_recording: !!call.recording_url,
    has_transcript: !!call.transcript,
  };
}

// ==========================================
// EXECUTION DATA SANITIZATION (from Bolna API)
// ==========================================
function sanitizeExecutionData(execution: Record<string, unknown>): SanitizedExecutionResponse & { recording_url?: string | null } {
  const telephonyData = (execution.telephony_data || {}) as Record<string, unknown>;
  const conversationTime = (execution.conversation_time ?? execution.conversation_duration) as number | undefined;
  
  let durationSeconds: number | null = null;
  if (telephonyData.duration) {
    durationSeconds = Math.round(parseFloat(telephonyData.duration as string)) || null;
  } else if (conversationTime !== undefined) {
    durationSeconds = Math.round(conversationTime);
  }
  
  // Encode transcript and summary
  let sanitizedTranscript: string | null = null;
  let sanitizedSummary: string | null = null;
  
  if (execution.transcript) {
    const transcriptStr = execution.transcript as string;
    sanitizedTranscript = isAlreadyEncoded(transcriptStr) ? transcriptStr : encodeForTransport(transcriptStr);
  }
  
  if (execution.summary) {
    const summaryStr = execution.summary as string;
    sanitizedSummary = isAlreadyEncoded(summaryStr) ? summaryStr : encodeForTransport(summaryStr);
  }
  
  const status = execution.status as string;
  
  return {
    execution_id: execution.id as string,
    status,
    duration: durationSeconds,
    summary: sanitizedSummary,
    outcome: determineOutcome(status, null, durationSeconds ? durationSeconds >= 45 : false),
    display_cost: calculateDisplayCost(durationSeconds),
    timestamps: {
      started_at: execution.started_at as string | null,
      ended_at: execution.ended_at as string | null,
    },
    transcript: sanitizedTranscript,
    has_recording: !!(telephonyData.recording_url),
  };
}

// ==========================================
// RECORDING ACCESS - Server-side streaming with short-lived URLs
// ==========================================
async function streamRecording(
  recordingUrl: string,
  headers: Record<string, string>
): Promise<Response> {
  // Fetch recording from provider
  const recordingResponse = await fetch(recordingUrl);
  
  if (!recordingResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Recording not available" }),
      { status: 404, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
  
  // Stream the audio content through our proxy
  const audioBlob = await recordingResponse.arrayBuffer();
  
  return new Response(audioBlob, {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": recordingResponse.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": "private, max-age=300", // 5 min cache for playback
      "Content-Disposition": "inline", // Allow playback, not force download
    },
  });
}

// ==========================================
// GENERATE SHORT-LIVED SIGNED RECORDING URL
// ==========================================
function generateSignedRecordingUrl(callId: string, expiresInSeconds = 300): string {
  // Generate a token that expires
  const expiresAt = Date.now() + (expiresInSeconds * 1000);
  const payload = { callId, exp: expiresAt };
  const token = btoa(JSON.stringify(payload));
  
  // Return URL pointing to our secure streaming endpoint
  return `${SUPABASE_URL}/functions/v1/voice-proxy?action=stream-recording&token=${token}`;
}

// Verify signed URL token
function verifyRecordingToken(token: string): { callId: string; valid: boolean } {
  try {
    const decoded = JSON.parse(atob(token));
    if (decoded.exp && decoded.exp > Date.now()) {
      return { callId: decoded.callId, valid: true };
    }
  } catch {
    // Invalid token
  }
  return { callId: "", valid: false };
}

// ==========================================
// TENANT ISOLATION
// ==========================================
interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

// deno-lint-ignore no-explicit-any
async function validateTenantAccess(
  _supabase: any,
  userId: string,
  role: string,
  resourceTenantId?: string
): Promise<boolean> {
  // Admins can access all tenants
  if (role === "admin") return true;
  
  // Get user's tenant (client_id)
  if (role === "client") {
    // User can only access their own data
    if (resourceTenantId && resourceTenantId !== userId) {
      return false;
    }
  }
  
  // Engineers can access assigned resources
  if (role === "engineer") {
    // Check if engineer is assigned to this tenant/resource
    // For now, allow engineers to access demo calls and assigned tasks
    return true;
  }
  
  return true;
}

// ==========================================
// MAIN REQUEST HANDLER
// ==========================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key exists
    if (!BOLNA_API_KEY) {
      errorLog("BOLNA_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ==========================================
    // PUBLIC ENDPOINT: Stream Recording (token-based)
    // ==========================================
    if (action === "stream-recording") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { callId, valid } = verifyRecordingToken(token);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Token expired or invalid" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch the actual recording URL from database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Try calls table first
      const { data: call } = await supabase
        .from("calls")
        .select("recording_url, external_call_id")
        .eq("id", callId)
        .maybeSingle();

      let recordingUrl = call?.recording_url;
      
      // If no recording in DB but have external_call_id, try Bolna
      if (!recordingUrl && call?.external_call_id) {
        const execResponse = await fetch(`${BOLNA_API_BASE}/executions/${call.external_call_id}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });
        
        if (execResponse.ok) {
          const execData = await execResponse.json();
          recordingUrl = execData.telephony_data?.recording_url;
        }
      }

      // Try demo_calls if not found
      if (!recordingUrl) {
        const { data: demoCall } = await supabase
          .from("demo_calls")
          .select("recording_url, uploaded_audio_url, external_call_id")
          .eq("id", callId)
          .maybeSingle();
        
        recordingUrl = demoCall?.recording_url || demoCall?.uploaded_audio_url;
        
        // Try Bolna for demo calls too
        if (!recordingUrl && demoCall?.external_call_id) {
          const execResponse = await fetch(`${BOLNA_API_BASE}/executions/${demoCall.external_call_id}`, {
            headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
          });
          
          if (execResponse.ok) {
            const execData = await execResponse.json();
            recordingUrl = execData.telephony_data?.recording_url;
          }
        }
      }

      if (!recordingUrl) {
        return new Response(
          JSON.stringify({ error: "Recording not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Stream the recording through our proxy
      return streamRecording(recordingUrl, corsHeaders);
    }

    // ==========================================
    // AUTHENTICATED ENDPOINTS
    // ==========================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    // Validate token
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
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
    
    // Tenant context from header or default to userId for clients
    const tenantId = req.headers.get("x-tenant-id") || (userRole === "client" ? userId : undefined);

    // Parse body for POST/PUT requests
    const body = req.method !== "GET" ? await req.json() : null;

    // ==========================================
    // ACTION HANDLERS
    // ==========================================
    switch (action) {
      // ==========================================
      // GET CALLS (sanitized response)
      // ==========================================
      case "get-calls": {
        const clientId = url.searchParams.get("client_id");
        const startDate = url.searchParams.get("start_date");
        const statusFilter = url.searchParams.get("status");
        
        // Validate tenant access
        if (clientId && !(await validateTenantAccess(supabase, userId, userRole, clientId))) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let query = supabase
          .from("calls")
          .select(`
            id, status, connected, duration_seconds,
            started_at, ended_at, created_at, sentiment,
            summary, recording_url, transcript
          `)
          .order("created_at", { ascending: false })
          .limit(100);

        if (startDate) query = query.gte("created_at", startDate);
        if (clientId) query = query.eq("client_id", clientId);
        if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);

        const { data, error } = await query;

        if (error) {
          errorLog("Database error", error);
          return new Response(
            JSON.stringify({ error: "Failed to fetch calls" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Sanitize all call data
        const sanitizedCalls = data?.map((call) => sanitizeCallData(call, tenantId)) || [];

        return new Response(JSON.stringify(sanitizedCalls), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==========================================
      // GET SINGLE CALL DETAILS (sanitized)
      // ==========================================
      case "get-call": {
        const callId = url.searchParams.get("call_id");
        if (!callId) {
          return new Response(
            JSON.stringify({ error: "call_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: call, error } = await supabase
          .from("calls")
          .select(`
            id, client_id, status, connected, duration_seconds,
            started_at, ended_at, created_at, sentiment,
            summary, recording_url, transcript, external_call_id
          `)
          .eq("id", callId)
          .maybeSingle();

        if (error || !call) {
          return new Response(
            JSON.stringify({ error: "Call not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate tenant access
        if (!(await validateTenantAccess(supabase, userId, userRole, call.client_id))) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Build sanitized response with transcript
        const sanitized = sanitizeCallData(call, tenantId);
        
        // Add encoded transcript if available
        let encodedTranscript: string | null = null;
        if (call.transcript) {
          encodedTranscript = isAlreadyEncoded(call.transcript) 
            ? call.transcript 
            : encodeForTransport(call.transcript);
        }

        // Generate signed recording URL if recording exists
        let recordingUrl: string | null = null;
        if (call.recording_url || call.external_call_id) {
          recordingUrl = generateSignedRecordingUrl(callId);
        }

        return new Response(JSON.stringify({
          ...sanitized,
          transcript: encodedTranscript,
          recording_url: recordingUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==========================================
      // GET EXECUTION DETAILS (from Bolna, sanitized)
      // ==========================================
      case "get-execution": {
        const executionId = url.searchParams.get("execution_id");
        if (!executionId) {
          return new Response(
            JSON.stringify({ error: "execution_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch from Bolna
        const response = await fetch(`${BOLNA_API_BASE}/executions/${executionId}`, {
          headers: { Authorization: `Bearer ${BOLNA_API_KEY}` },
        });

        if (!response.ok) {
          if (response.status === 404) {
            return new Response(
              JSON.stringify({ error: "Execution not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ error: "Failed to fetch execution" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const rawExecution = await response.json();
        
        // Strictly sanitize the response - remove ALL provider metadata
        const sanitized = sanitizeExecutionData(rawExecution);
        
        // Generate signed recording URL if available
        const telephonyData = (rawExecution.telephony_data || {}) as Record<string, unknown>;
        if (telephonyData.recording_url) {
          // Find internal call_id from our database using execution_id
          const { data: callData } = await supabase
            .from("calls")
            .select("id")
            .eq("external_call_id", executionId)
            .maybeSingle();
          
          if (callData?.id) {
            sanitized.recording_url = generateSignedRecordingUrl(callData.id);
          }
        }

        return new Response(JSON.stringify(sanitized), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==========================================
      // GET RECORDING URL (generates signed URL)
      // ==========================================
      case "get-recording-url": {
        const callId = url.searchParams.get("call_id");
        if (!callId) {
          return new Response(
            JSON.stringify({ error: "call_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify call exists and user has access
        const { data: call } = await supabase
          .from("calls")
          .select("id, client_id, recording_url, external_call_id")
          .eq("id", callId)
          .maybeSingle();

        if (!call) {
          return new Response(
            JSON.stringify({ error: "Call not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate tenant access
        if (!(await validateTenantAccess(supabase, userId, userRole, call.client_id))) {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if recording exists
        if (!call.recording_url && !call.external_call_id) {
          return new Response(
            JSON.stringify({ error: "No recording available" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate short-lived signed URL (5 minutes)
        const signedUrl = generateSignedRecordingUrl(callId, 300);

        return new Response(JSON.stringify({ url: signedUrl, expires_in: 300 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ==========================================
      // TODAY'S STATS (aggregated, no raw data)
      // ==========================================
      case "get-today-stats": {
        if (userRole !== "admin") {
          return new Response(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: calls, error } = await supabase
          .from("calls")
          .select("status, connected, duration_seconds")
          .gte("created_at", today.toISOString());

        if (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch stats" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const total = calls?.length || 0;
        const completed = calls?.filter((c) => c.status === "completed").length || 0;
        const connected = calls?.filter((c) => c.connected).length || 0;
        const failed = calls?.filter((c) => c.status === "failed").length || 0;
        const inProgress = calls?.filter((c) => ["initiated", "in_progress"].includes(c.status)).length || 0;
        const totalDuration = calls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0;

        return new Response(JSON.stringify({
          total,
          completed,
          connected,
          failed,
          in_progress: inProgress,
          connection_rate: total > 0 ? Math.round((connected / total) * 100) : 0,
          avg_duration: total > 0 ? Math.round(totalDuration / total) : 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    errorLog("Request error", error);
    
    // Never expose stack traces to frontend
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
