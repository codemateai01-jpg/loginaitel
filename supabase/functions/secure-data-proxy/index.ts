import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==========================================
// ENCODING UTILITIES - encode sensitive data so it's not readable in DevTools
// but can be decoded in frontend for display
// ==========================================

// Base64 encode a string (for network obfuscation)
function encodeForTransport(value: string | null): string | null {
  if (!value) return null;
  try {
    return "enc:" + btoa(unescape(encodeURIComponent(value)));
  } catch {
    return "enc:" + btoa(value);
  }
}

// Mask phone number - keep last 4 visible, encode the rest
function maskPhone(phone: string | null): string {
  if (!phone) return "****";
  if (phone.length <= 4) return "****";
  // Show last 4 digits only (truly masked, not encoded)
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

// Mask UUID to show only first 8 chars
function maskUuid(uuid: string | null): string {
  if (!uuid) return "********";
  return uuid.slice(0, 8) + "...";
}

// Encode transcript for transport - will be decoded in frontend
function encodeTranscript(transcript: string | null): string | null {
  if (!transcript) return null;
  return encodeForTransport(transcript);
}

// Encode summary for transport
function encodeSummary(summary: string | null): string | null {
  if (!summary) return null;
  return encodeForTransport(summary);
}

// Mask system prompt - never expose in logs (keep this truly masked)
function maskSystemPrompt(prompt: string | null): string | null {
  if (!prompt) return null;
  return "[System prompt configured]";
}

// Generate proxied recording URL instead of direct storage URL
function proxyRecordingUrl(url: string | null, callId: string): string | null {
  if (!url) return null;
  // Return a proxy indicator - actual playback should go through aitel-proxy
  return `proxy:recording:${callId}`;
}

// Sanitize metadata to remove sensitive provider/usage details
function sanitizeMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata) return null;
  
  // Only keep essential non-sensitive fields for UI
  const sanitized: Record<string, unknown> = {};
  
  // Keep basic info needed for UI
  if (metadata.source) sanitized.source = metadata.source;
  if (metadata.is_retry !== undefined) sanitized.is_retry = metadata.is_retry;
  if (metadata.lead_name) sanitized.lead_name = metadata.lead_name;
  if (metadata.campaign_id) sanitized.campaign_id = metadata.campaign_id;
  if (metadata.aitel_status) sanitized.aitel_status = metadata.aitel_status;
  if (metadata.error_message) sanitized.error_message = metadata.error_message;
  if (metadata.retry_attempt !== undefined) sanitized.retry_attempt = metadata.retry_attempt;
  if (metadata.answered_by_voicemail !== undefined) sanitized.answered_by_voicemail = metadata.answered_by_voicemail;
  
  // Encode extracted_data if present (may contain lead info, form responses, etc.)
  if (metadata.extracted_data) {
    const extractedStr = typeof metadata.extracted_data === 'string' 
      ? metadata.extracted_data 
      : JSON.stringify(metadata.extracted_data);
    sanitized.extracted_data = encodeForTransport(extractedStr);
  }
  
  // Completely remove sensitive fields:
  // - usage_breakdown (LLM tokens, models, provider info)
  // - telephony_provider (infrastructure info)
  // - queue_item_id, last_webhook_at (internal system data)
  
  return sanitized;
}

// Encode notes field for transport
function encodeNotes(notes: string | null): string | null {
  if (!notes) return null;
  return encodeForTransport(notes);
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

    // Verify user token using getUser
    const { data: userData, error: authError } = await userClient.auth.getUser();
    
    if (authError || !userData?.user) {
      console.error("Auth error:", authError);
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

    // Demo calls for engineers
    if (action === "demo_calls") {
      const engineerId = url.searchParams.get("engineer_id");
      
      let query = supabase
        .from("demo_calls")
        .select(`
          id,
          task_id,
          agent_id,
          engineer_id,
          phone_number,
          status,
          duration_seconds,
          started_at,
          ended_at,
          created_at,
          updated_at,
          external_call_id,
          recording_url,
          uploaded_audio_url,
          transcript
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

      // Get tasks separately for proper joining
      const taskIds = [...new Set(demoCalls?.map(c => c.task_id) || [])];
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, selected_demo_call_id, assigned_to")
        .in("id", taskIds);

      // Get agents separately
      const agentIds = [...new Set(demoCalls?.map(c => c.agent_id) || [])];
      const { data: agents } = await supabase
        .from("aitel_agents")
        .select("id, agent_name")
        .in("id", agentIds);

      // Map and encode data (encoded for network, decoded in frontend)
      const maskedData = demoCalls?.map((call: any) => ({
        ...call,
        phone_number: maskPhone(call.phone_number),
        external_call_id: maskUuid(call.external_call_id),
        transcript: encodeTranscript(call.transcript),
        recording_url: proxyRecordingUrl(call.recording_url, call.id),
        uploaded_audio_url: proxyRecordingUrl(call.uploaded_audio_url, call.id),
        tasks: tasks?.find(t => t.id === call.task_id) || null,
        aitel_agents: agents?.find(a => a.id === call.agent_id) || null,
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin demo calls (for AdminDemoLogs)
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

      // Encode sensitive data (for network obfuscation, decoded in frontend)
      const maskedData = data?.map((call: any) => ({
        ...call,
        phone_number: maskPhone(call.phone_number),
        external_call_id: maskUuid(call.external_call_id),
        transcript: encodeTranscript(call.transcript),
        recording_url: proxyRecordingUrl(call.recording_url, call.id),
        uploaded_audio_url: proxyRecordingUrl(call.uploaded_audio_url, call.id),
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calls (admin view)
    if (action === "calls") {
      const clientId = url.searchParams.get("client_id");
      const startDate = url.searchParams.get("start_date");
      const statusFilter = url.searchParams.get("status");
      
      let query = supabase
        .from("calls")
        .select(`
          id,
          agent_id,
          client_id,
          lead_id,
          status,
          connected,
          duration_seconds,
          started_at,
          ended_at,
          created_at,
          sentiment,
          summary,
          transcript,
          recording_url,
          external_call_id,
          metadata
        `)
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      if (clientId) {
        query = query.eq("client_id", clientId);
      }
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Encode sensitive data - for admin (encoded in network, decoded in frontend)
      // Keep external_call_id intact for admin so they can fetch execution details
      const maskedData = data?.map((call: any) => ({
        ...call,
        // Keep external_call_id full - needed for getExecution calls
        lead_id: maskUuid(call.lead_id),
        transcript: encodeTranscript(call.transcript),
        summary: encodeSummary(call.summary),
        recording_url: proxyRecordingUrl(call.recording_url, call.id),
        metadata: sanitizeMetadata(call.metadata),
        agent: { name: 'Agent' },
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Active calls (for real-time monitor)
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

      // Encode sensitive data (for network obfuscation)
      // Keep external_call_id full for admin - needed for getExecution calls
      const maskedData = data?.map((call: any) => ({
        ...call,
        // Keep external_call_id full - needed for getExecution calls
        lead_id: maskUuid(call.lead_id),
        transcript: encodeTranscript(call.transcript),
        summary: encodeSummary(call.summary),
        recording_url: proxyRecordingUrl(call.recording_url, call.id),
        metadata: sanitizeMetadata(call.metadata),
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Today's stats for real-time monitor
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
      const completed = todayCalls?.filter((c: any) => c.status === "completed").length || 0;
      const connected = todayCalls?.filter((c: any) => c.connected).length || 0;
      const failed = todayCalls?.filter((c: any) => c.status === "failed").length || 0;
      const inProgress = todayCalls?.filter((c: any) => ["initiated", "in_progress"].includes(c.status)).length || 0;
      const totalDuration = todayCalls?.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0);

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

    // Tasks
    if (action === "tasks") {
      const assignedTo = url.searchParams.get("assigned_to");
      const status = url.searchParams.get("status");
      
      let query = supabase
        .from("tasks")
        .select(`
          *,
          aitel_agents(agent_name, external_agent_id)
        `)
        .order("created_at", { ascending: false });

      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }
      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mask external agent IDs and system prompts
      const maskedData = data?.map((task: any) => ({
        ...task,
        aitel_agents: task.aitel_agents ? {
          ...task.aitel_agents,
          external_agent_id: maskUuid(task.aitel_agents.external_agent_id),
          current_system_prompt: maskSystemPrompt(task.aitel_agents.current_system_prompt),
          original_system_prompt: maskSystemPrompt(task.aitel_agents.original_system_prompt),
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
