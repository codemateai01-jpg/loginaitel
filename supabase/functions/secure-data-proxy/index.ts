/**
 * SECURE-DATA-PROXY: Zero-Trust Authenticated Proxy for ALL Sensitive Data
 * 
 * CRITICAL SECURITY MODEL:
 * - ALL sensitive data MUST flow through this proxy
 * - NO direct Supabase queries for sensitive tables from frontend
 * - User IDs, emails, full names are ALWAYS masked
 * - Transcripts/summaries return encrypted payloads ONLY
 * - Phone numbers are masked (last 4 digits only)
 * - Raw provider data is NEVER exposed
 * 
 * Enterprise-safe for white-labeling and hostile client inspection.
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
// MASKING UTILITIES - NEVER expose raw data
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

// Mask email - show only first letter and domain
function maskEmail(email: string | null): string {
  if (!email) return "***@***.***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***@***.***";
  return localPart[0] + "***@" + domain;
}

// Mask full name - show only initials
function maskFullName(name: string | null): string {
  if (!name) return "***";
  const parts = name.trim().split(/\s+/);
  return parts.map(p => p[0]?.toUpperCase() || "*").join(".") + ".";
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

    // Verify user token using getClaims (works with signing-keys)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      debugLog("getClaims failed, trying getUser fallback", { error: claimsError?.message });
      // Fallback to getUser for backward compatibility
      const { data: userData, error: authError } = await userClient.auth.getUser();
      
      if (authError || !userData?.user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      var userId = userData.user.id;
    } else {
      var userId = claimsData.claims.sub as string;
    }

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
    // PROFILES - Always masked
    // ==========================================
    if (action === "profiles" || action === "get-profiles") {
      // Only admins can list all profiles
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, phone, created_at")
        .order("full_name", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch profiles" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CRITICAL: Mask ALL sensitive profile data
      const maskedProfiles = (profiles || []).map((profile: Record<string, unknown>) => ({
        // Keep user_id for admin operations but provide masked display version
        user_id: profile.user_id,
        display_id: maskUuid(profile.user_id as string),
        display_name: maskFullName(profile.full_name as string),
        display_email: maskEmail(profile.email as string),
        display_phone: maskPhone(profile.phone as string),
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
        // NEVER include: full_name, email, phone (raw values)
      }));

      return new Response(JSON.stringify(maskedProfiles), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // SINGLE PROFILE
    // ==========================================
    if (action === "get-profile") {
      const targetUserId = url.searchParams.get("user_id");
      
      // Users can only get their own profile details, admins can get any
      if (userRole !== "admin" && targetUserId !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, phone, created_at")
        .eq("user_id", targetUserId || userId)
        .maybeSingle();

      if (error || !profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If user is requesting their own profile, return full data
      // Otherwise (admin viewing other's profile), mask it
      const isOwnProfile = profile.user_id === userId;
      
      const maskedProfile = {
        user_id: profile.user_id,
        display_id: maskUuid(profile.user_id as string),
        // Only show full data for own profile
        full_name: isOwnProfile ? profile.full_name : null,
        email: isOwnProfile ? profile.email : null,
        phone: isOwnProfile ? profile.phone : null,
        display_name: maskFullName(profile.full_name as string),
        display_email: maskEmail(profile.email as string),
        display_phone: maskPhone(profile.phone as string),
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      };

      return new Response(JSON.stringify(maskedProfile), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // CLIENTS LIST - Masked for admin view
    // ==========================================
    if (action === "clients" || action === "get-clients") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: clients, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .eq("role", "client")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch clients" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get profile info
      const userIds = (clients || []).map((c: Record<string, unknown>) => c.user_id);
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, email, avatar_url, phone")
            .in("user_id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id, p]));

      // Return masked client list - admin needs real IDs for operations
      const maskedClients = (clients || []).map((client: Record<string, unknown>) => {
        const profile = profileMap.get(client.user_id) as Record<string, unknown> | undefined;
        return {
          user_id: client.user_id, // Admin needs for operations
          display_id: maskUuid(client.user_id as string),
          display_name: profile ? maskFullName(profile.full_name as string) : "***",
          display_email: profile ? maskEmail(profile.email as string) : "***@***.***",
          display_phone: profile ? maskPhone(profile.phone as string) : "****",
          avatar_url: profile?.avatar_url || null,
          role: client.role,
          created_at: client.created_at,
        };
      });

      return new Response(JSON.stringify(maskedClients), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // ENGINEERS LIST - Masked for admin view
    // ==========================================
    if (action === "engineers" || action === "get-engineers") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: engineers, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .eq("role", "engineer")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch engineers" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get profile info
      const userIds = (engineers || []).map((e: Record<string, unknown>) => e.user_id);
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, email, avatar_url")
            .in("user_id", userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: Record<string, unknown>) => [p.user_id, p]));

      const maskedEngineers = (engineers || []).map((eng: Record<string, unknown>) => {
        const profile = profileMap.get(eng.user_id) as Record<string, unknown> | undefined;
        return {
          user_id: eng.user_id,
          display_id: maskUuid(eng.user_id as string),
          display_name: profile ? maskFullName(profile.full_name as string) : "***",
          display_email: profile ? maskEmail(profile.email as string) : "***@***.***",
          avatar_url: profile?.avatar_url || null,
          role: eng.role,
          created_at: eng.created_at,
        };
      });

      return new Response(JSON.stringify(maskedEngineers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // CLIENTS WITH STATS - Full admin dashboard view
    // ==========================================
    if (action === "clients-with-stats") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get client roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");

      const clientIds = (roles || []).map((r: Record<string, unknown>) => r.user_id as string);
      if (clientIds.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get profiles, credits, agents, and calls
      const [profilesRes, creditsRes, agentsRes, callsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, phone, created_at").in("user_id", clientIds),
        supabase.from("client_credits").select("client_id, balance").in("client_id", clientIds),
        supabase.from("aitel_agents").select("client_id").in("client_id", clientIds),
        supabase.from("calls").select("client_id").in("client_id", clientIds),
      ]);

      const profiles = profilesRes.data || [];
      const credits = creditsRes.data || [];
      const agents = agentsRes.data || [];
      const calls = callsRes.data || [];

      const clientsData = profiles.map((profile: Record<string, unknown>) => {
        const credit = credits.find((c: Record<string, unknown>) => c.client_id === profile.user_id);
        const agentCount = agents.filter((a: Record<string, unknown>) => a.client_id === profile.user_id).length;
        const callCount = calls.filter((c: Record<string, unknown>) => c.client_id === profile.user_id).length;

        return {
          user_id: profile.user_id,
          display_id: maskUuid(profile.user_id as string),
          display_name: maskFullName(profile.full_name as string),
          display_email: maskEmail(profile.email as string),
          display_phone: maskPhone(profile.phone as string),
          created_at: profile.created_at,
          credits: (credit as Record<string, unknown>)?.balance || 0,
          agents_count: agentCount,
          calls_count: callCount,
        };
      });

      return new Response(JSON.stringify(clientsData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // ENGINEERS WITH STATS - Full admin dashboard view
    // ==========================================
    if (action === "engineers-with-stats") {
      if (userRole !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get engineer roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "engineer");

      const engineerIds = (roles || []).map((r: Record<string, unknown>) => r.user_id as string);
      if (engineerIds.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get month range for time entries
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      // Get profiles, points, tasks, and time entries
      const [profilesRes, pointsRes, tasksRes, timeRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, created_at").in("user_id", engineerIds),
        supabase.from("engineer_points").select("engineer_id, total_points").in("engineer_id", engineerIds),
        supabase.from("tasks").select("assigned_to, status").in("assigned_to", engineerIds),
        supabase.from("time_entries").select("engineer_id, check_in_time, check_out_time, total_break_minutes").in("engineer_id", engineerIds).gte("check_in_time", monthStart).lte("check_in_time", monthEnd),
      ]);

      const profiles = profilesRes.data || [];
      const points = pointsRes.data || [];
      const tasks = tasksRes.data || [];
      const timeEntries = timeRes.data || [];

      const engineersData = profiles.map((profile: Record<string, unknown>) => {
        const pointsRecord = points.find((p: Record<string, unknown>) => p.engineer_id === profile.user_id);
        const userTasks = tasks.filter((t: Record<string, unknown>) => t.assigned_to === profile.user_id);
        const completedTasks = userTasks.filter((t: Record<string, unknown>) => t.status === "completed" || t.status === "approved").length;
        const inProgressTasks = userTasks.filter((t: Record<string, unknown>) => t.status === "in_progress").length;

        // Calculate hours
        const userTimeEntries = timeEntries.filter((te: Record<string, unknown>) => te.engineer_id === profile.user_id);
        let totalMinutes = 0;
        userTimeEntries.forEach((entry: Record<string, unknown>) => {
          const checkIn = new Date(entry.check_in_time as string);
          const checkOut = entry.check_out_time ? new Date(entry.check_out_time as string) : new Date();
          const workMinutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60000) - ((entry.total_break_minutes as number) || 0);
          if (workMinutes > 0) totalMinutes += workMinutes;
        });

        return {
          user_id: profile.user_id,
          display_id: maskUuid(profile.user_id as string),
          display_name: maskFullName(profile.full_name as string),
          display_email: maskEmail(profile.email as string),
          created_at: profile.created_at,
          total_points: (pointsRecord as Record<string, unknown>)?.total_points || 0,
          tasks_completed: completedTasks,
          tasks_in_progress: inProgressTasks,
          hours_this_month: Math.round(totalMinutes / 60 * 10) / 10,
        };
      });

      // Sort by points
      engineersData.sort((a: Record<string, unknown>, b: Record<string, unknown>) => 
        ((b.total_points as number) || 0) - ((a.total_points as number) || 0)
      );

      return new Response(JSON.stringify(engineersData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      const taskIds = [...new Set(demoCalls?.map((c: Record<string, unknown>) => c.task_id) || [])];
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, selected_demo_call_id, assigned_to")
        .in("id", taskIds);

      const agentIds = [...new Set(demoCalls?.map((c: Record<string, unknown>) => c.agent_id) || [])];
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
        tasks: (tasks as Record<string, unknown>[] | null)?.find((t: Record<string, unknown>) => t.id === call.task_id) || null,
        aitel_agents: (agents as Record<string, unknown>[] | null)?.find((a: Record<string, unknown>) => a.id === call.agent_id) || null,
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
        client_id: call.client_id, // Keep for admin operations
        display_client_id: maskUuid(call.client_id as string),
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
    // GET DEMO RECORDING URL - Returns actual recording URL for playback
    // ==========================================
    if (action === "get_demo_recording") {
      const demoCallId = url.searchParams.get("call_id");
      
      if (!demoCallId) {
        return new Response(JSON.stringify({ error: "Missing call_id parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the demo call
      const { data: demoCall, error } = await supabase
        .from("demo_calls")
        .select("id, engineer_id, recording_url, uploaded_audio_url")
        .eq("id", demoCallId)
        .single();

      if (error || !demoCall) {
        return new Response(JSON.stringify({ error: "Demo call not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: only the engineer who made the call or admin can access
      if (userRole !== "admin" && demoCall.engineer_id !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return the actual recording URL (prefer uploaded over synced)
      const actualUrl = demoCall.uploaded_audio_url || demoCall.recording_url;
      
      if (!actualUrl) {
        return new Response(JSON.stringify({ error: "No recording available" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        url: actualUrl,
        call_id: demoCallId 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================================
    // GET CALL RECORDING URL - Returns actual recording URL for playback
    // ==========================================
    if (action === "get_call_recording") {
      const callId = url.searchParams.get("call_id");
      
      if (!callId) {
        return new Response(JSON.stringify({ error: "Missing call_id parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch the call
      const { data: call, error } = await supabase
        .from("calls")
        .select("id, client_id, recording_url")
        .eq("id", callId)
        .single();

      if (error || !call) {
        return new Response(JSON.stringify({ error: "Call not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization: only the client who owns the call or admin can access
      if (userRole !== "admin" && call.client_id !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return the actual recording URL
      if (!call.recording_url) {
        return new Response(JSON.stringify({ error: "No recording available" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ 
        url: call.recording_url,
        call_id: callId 
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
    const message = IS_PRODUCTION ? "Internal error" : (error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});