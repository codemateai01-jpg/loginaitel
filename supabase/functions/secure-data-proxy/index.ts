import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mask phone number to show only last 4 digits
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

    // Verify user token using getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await userClient.auth.getClaims(token);
    
    if (authError || !claimsData?.claims) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

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

      // Map and mask data
      const maskedData = demoCalls?.map((call: any) => ({
        ...call,
        phone_number: maskPhone(call.phone_number),
        external_call_id: call.external_call_id, // Keep for syncing but it won't show in console logs from query
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

      // Mask sensitive data
      const maskedData = data?.map((call: any) => ({
        ...call,
        phone_number: maskPhone(call.phone_number),
        external_call_id: maskUuid(call.external_call_id),
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

      // Mask sensitive data - for admin, mask lead IDs and external call IDs
      const maskedData = data?.map((call: any) => ({
        ...call,
        external_call_id: maskUuid(call.external_call_id),
        lead_id: maskUuid(call.lead_id),
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

      // Mask sensitive data
      const maskedData = data?.map((call: any) => ({
        ...call,
        external_call_id: maskUuid(call.external_call_id),
        lead_id: maskUuid(call.lead_id),
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

      // Mask external agent IDs
      const maskedData = data?.map((task: any) => ({
        ...task,
        aitel_agents: task.aitel_agents ? {
          ...task.aitel_agents,
          external_agent_id: maskUuid(task.aitel_agents.external_agent_id),
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
