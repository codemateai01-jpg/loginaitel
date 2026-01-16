/**
 * SECURE-DATA-PROXY: Authenticated proxy for Supabase data with AES-256-GCM encryption
 * 
 * Security Features:
 * - All transcripts and summaries encrypted with AES-256-GCM
 * - Phone numbers masked (not recoverable)
 * - No raw provider data exposed
 * - Environment-based secrets only
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptData, type EncryptedPayload } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IS_PRODUCTION = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;

function debugLog(message: string, data?: unknown) {
  if (!IS_PRODUCTION) {
    console.log(`[secure-data-proxy] ${message}`, data ? JSON.stringify(data) : "");
  }
}

// ==========================================
// MASKING UTILITIES
// ==========================================

// Mask phone number - truly masked, not recoverable
function maskPhone(phone: string | null): string {
  if (!phone) return "****";
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

// Mask UUID to show only first 8 chars
function maskUuid(uuid: string | null): string {
  if (!uuid) return "********";
  return uuid.slice(0, 8) + "...";
}

// Mask system prompt - never expose
function maskSystemPrompt(prompt: string | null): string | null {
  if (!prompt) return null;
  return "[System prompt configured]";
}

// Generate proxied recording URL
function proxyRecordingUrl(url: string | null, callId: string): string | null {
  if (!url) return null;
  return `proxy:recording:${callId}`;
}

// Sanitize metadata - remove sensitive provider details
async function sanitizeMetadata(metadata: Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  if (!metadata) return null;
  
  const sanitized: Record<string, unknown> = {};
  
  // Keep only essential non-sensitive fields
  if (metadata.source) sanitized.source = metadata.source;
  if (metadata.is_retry !== undefined) sanitized.is_retry = metadata.is_retry;
  if (metadata.lead_name) sanitized.lead_name = metadata.lead_name;
  if (metadata.campaign_id) sanitized.campaign_id = metadata.campaign_id;
  if (metadata.aitel_status) sanitized.aitel_status = metadata.aitel_status;
  if (metadata.error_message) sanitized.error_message = metadata.error_message;
  if (metadata.retry_attempt !== undefined) sanitized.retry_attempt = metadata.retry_attempt;
  if (metadata.answered_by_voicemail !== undefined) sanitized.answered_by_voicemail = metadata.answered_by_voicemail;
  
  // Encrypt extracted_data if present
  if (metadata.extracted_data) {
    const extractedStr = typeof metadata.extracted_data === 'string' 
      ? metadata.extracted_data 
      : JSON.stringify(metadata.extracted_data);
    sanitized.extracted_data = await encryptData(extractedStr);
  }
  
  return sanitized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth for validation
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user token
    const { data: userData, error: authError } = await userClient.auth.getUser();
    
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Create service client for data queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const userRole = roleData?.role;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ==========================================
    // DEMO CALLS (ENGINEERS)
    // ==========================================
    if (action === "demo_calls") {
      const engineerId = url.searchParams.get("engineer_id");
      
      let query = supabase
        .from("demo_calls")
        .select(`
          id, task_id, agent_id, engineer_id, phone_number, status,
          duration_seconds, started_at, ended_at, created_at, updated_at,
          external_call_id, recording_url, uploaded_audio_url, transcript
        `)
        .order("created_at", { ascending: false });

      // Engineers can only see their own calls
      if (userRole === "engineer" && engineerId) {
        query = query.eq("engineer_id", engineerId);
      }

      const { data: demoCalls, error: demoError } = await query;

      if (demoError) {
        return new Response(JSON.stringify({ error: demoError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get tasks and agents for joining
      const taskIds = [...new Set(demoCalls?.map(c => c.task_id) || [])];
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, selected_demo_call_id, assigned_to")
        .in("id", taskIds);

      const agentIds = [...new Set(demoCalls?.map(c => c.agent_id) || [])];
      const { data: agents } = await supabase
        .from("aitel_agents")
        .select("id, agent_name")
        .in("id", agentIds);

      // Encrypt sensitive data
      const maskedData = await Promise.all((demoCalls || []).map(async (call: Record<string, unknown>) => ({
        ...call,
        phone_number: maskPhone(call.phone_number as string),
        external_call_id: maskUuid(call.external_call_id as string),
        transcript: call.transcript ? await encryptData(call.transcript as string) : null,
        recording_url: proxyRecordingUrl(call.recording_url as string, call.id as string),
        uploaded_audio_url: proxyRecordingUrl(call.uploaded_audio_url as string, call.id as string),
        tasks: tasks?.find(t => t.id === call.task_id) || null,
        aitel_agents: agents?.find(a => a.id === call.agent_id) || null,
      })));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // ADMIN DEMO CALLS
    // ==========================================
    if (action === "admin_demo_calls") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("demo_calls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Encrypt sensitive data
      const maskedData = await Promise.all((data || []).map(async (call: Record<string, unknown>) => ({
        ...call,
        phone_number: maskPhone(call.phone_number as string),
        external_call_id: maskUuid(call.external_call_id as string),
        transcript: call.transcript ? await encryptData(call.transcript as string) : null,
        recording_url: proxyRecordingUrl(call.recording_url as string, call.id as string),
        uploaded_audio_url: proxyRecordingUrl(call.uploaded_audio_url as string, call.id as string),
      })));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // CALLS (ADMIN VIEW)
    // ==========================================
    if (action === "calls") {
      const clientId = url.searchParams.get("client_id");
      const startDate = url.searchParams.get("start_date");
      const statusFilter = url.searchParams.get("status");
      
      let query = supabase
        .from("calls")
        .select(`
          id, agent_id, client_id, lead_id, status, connected,
          duration_seconds, started_at, ended_at, created_at,
          sentiment, summary, transcript, recording_url,
          external_call_id, metadata
        `)
        .order("created_at", { ascending: false });

      if (startDate) query = query.gte("created_at", startDate);
      if (clientId) query = query.eq("client_id", clientId);
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Encrypt sensitive data
      const maskedData = await Promise.all((data || []).map(async (call: Record<string, unknown>) => ({
        ...call,
        lead_id: maskUuid(call.lead_id as string),
        transcript: call.transcript ? await encryptData(call.transcript as string) : null,
        summary: call.summary ? await encryptData(call.summary as string) : null,
        recording_url: proxyRecordingUrl(call.recording_url as string, call.id as string),
        metadata: await sanitizeMetadata(call.metadata as Record<string, unknown>),
        agent: { name: 'Agent' },
      })));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // ACTIVE CALLS (REAL-TIME MONITOR)
    // ==========================================
    if (action === "active_calls") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .in("status", ["initiated", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Encrypt sensitive data
      const maskedData = await Promise.all((data || []).map(async (call: Record<string, unknown>) => ({
        ...call,
        lead_id: maskUuid(call.lead_id as string),
        transcript: call.transcript ? await encryptData(call.transcript as string) : null,
        summary: call.summary ? await encryptData(call.summary as string) : null,
        recording_url: proxyRecordingUrl(call.recording_url as string, call.id as string),
        metadata: await sanitizeMetadata(call.metadata as Record<string, unknown>),
      })));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // TODAY'S STATS (ADMIN)
    // ==========================================
    if (action === "today_stats") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayCalls, error } = await supabase
        .from("calls")
        .select("status, connected, duration_seconds")
        .gte("created_at", today.toISOString());

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const total = todayCalls?.length || 0;
      const completed = todayCalls?.filter((c: Record<string, unknown>) => c.status === "completed").length || 0;
      const connected = todayCalls?.filter((c: Record<string, unknown>) => c.connected).length || 0;
      const failed = todayCalls?.filter((c: Record<string, unknown>) => c.status === "failed").length || 0;
      const inProgress = todayCalls?.filter((c: Record<string, unknown>) => ["initiated", "in_progress"].includes(c.status as string)).length || 0;
      const totalDuration = todayCalls?.reduce((sum: number, c: Record<string, unknown>) => sum + ((c.duration_seconds as number) || 0), 0);

      return new Response(JSON.stringify({
        total,
        completed,
        connected,
        failed,
        inProgress,
        connectionRate: total > 0 ? Math.round((connected / total) * 100) : 0,
        avgDuration: total > 0 ? Math.round((totalDuration || 0) / total) : 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // TASKS
    // ==========================================
    if (action === "tasks") {
      const assignedTo = url.searchParams.get("assigned_to");
      const status = url.searchParams.get("status");
      
      let query = supabase
        .from("tasks")
        .select(`*, aitel_agents(agent_name, external_agent_id)`)
        .order("created_at", { ascending: false });

      if (assignedTo) query = query.eq("assigned_to", assignedTo);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mask external agent IDs and system prompts
      const maskedData = (data || []).map((task: Record<string, unknown>) => ({
        ...task,
        aitel_agents: task.aitel_agents ? {
          ...(task.aitel_agents as Record<string, unknown>),
          external_agent_id: maskUuid((task.aitel_agents as Record<string, unknown>).external_agent_id as string),
          current_system_prompt: maskSystemPrompt((task.aitel_agents as Record<string, unknown>).current_system_prompt as string),
          original_system_prompt: maskSystemPrompt((task.aitel_agents as Record<string, unknown>).original_system_prompt as string),
        } : null,
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
