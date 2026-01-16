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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = roleData?.role;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "demo_calls") {
      const assignedTo = url.searchParams.get("assigned_to");
      const status = url.searchParams.get("status");
      
      let query = supabase
        .from("demo_calls")
        .select(`
          id,
          task_id,
          agent_id,
          phone_number,
          status,
          duration_seconds,
          started_at,
          ended_at,
          created_at,
          external_call_id,
          recording_url,
          uploaded_audio_url,
          transcript,
          tasks!inner(title, selected_demo_call_id),
          aitel_agents(agent_name)
        `)
        .order("created_at", { ascending: false });

      if (assignedTo) {
        query = query.eq("tasks.assigned_to", assignedTo);
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

      // Mask sensitive data
      const maskedData = data?.map((call: any) => ({
        ...call,
        phone_number: maskPhone(call.phone_number),
        external_call_id: maskUuid(call.external_call_id),
        // Keep recording URLs for playback but mask in response for logging
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "calls") {
      const clientId = url.searchParams.get("client_id");
      const limit = parseInt(url.searchParams.get("limit") || "100");
      
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
          aitel_agents(agent_name)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For calls, we need to get lead phone numbers separately and mask them
      const maskedData = data?.map((call: any) => ({
        ...call,
        external_call_id: maskUuid(call.external_call_id),
        // Mask IDs that could be sensitive
        lead_id: maskUuid(call.lead_id),
      }));

      return new Response(JSON.stringify(maskedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
