import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOLNA_API_KEY = Deno.env.get("BOLNA_API_KEY")!;

const MAX_CONCURRENT_CALLS = 10;
const BOLNA_API_URL = "https://api.bolna.dev/v2";

interface QueueItem {
  id: string;
  client_id: string;
  lead_id: string;
  agent_id: string;
  status: string;
  priority: number;
  lead: {
    id: string;
    phone_number: string;
    name: string | null;
  };
  agent: {
    id: string;
    external_agent_id: string;
    agent_name: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get count of currently active calls
    const { count: activeCallsCount, error: countError } = await supabase
      .from("call_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress");

    if (countError) {
      throw new Error(`Failed to count active calls: ${countError.message}`);
    }

    const availableSlots = MAX_CONCURRENT_CALLS - (activeCallsCount || 0);

    if (availableSlots <= 0) {
      console.log("No available slots for new calls");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Queue is at capacity", 
          active_calls: activeCallsCount,
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending queue items ordered by priority and queue time
    const { data: pendingItems, error: queueError } = await supabase
      .from("call_queue")
      .select(`
        id,
        client_id,
        lead_id,
        agent_id,
        status,
        priority,
        lead:real_estate_leads!call_queue_lead_id_fkey(id, phone_number, name),
        agent:aitel_agents!call_queue_agent_id_fkey(id, external_agent_id, agent_name)
      `)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("queued_at", { ascending: true })
      .limit(availableSlots);

    if (queueError) {
      throw new Error(`Failed to fetch queue: ${queueError.message}`);
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log("No pending items in queue");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending calls", 
          active_calls: activeCallsCount,
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${pendingItems.length} calls from queue`);

    const results = [];

    for (const item of pendingItems) {
      try {
        // Type guard for nested objects
        const lead = Array.isArray(item.lead) ? item.lead[0] : item.lead;
        const agent = Array.isArray(item.agent) ? item.agent[0] : item.agent;

        if (!lead || !agent) {
          console.error(`Missing lead or agent for queue item ${item.id}`);
          await supabase
            .from("call_queue")
            .update({ 
              status: "failed", 
              error_message: "Missing lead or agent data",
              completed_at: new Date().toISOString()
            })
            .eq("id", item.id);
          continue;
        }

        // Mark as in_progress
        await supabase
          .from("call_queue")
          .update({ 
            status: "in_progress", 
            started_at: new Date().toISOString() 
          })
          .eq("id", item.id);

        // Create call record first
        const { data: callRecord, error: callError } = await supabase
          .from("calls")
          .insert({
            agent_id: item.agent_id,
            client_id: item.client_id,
            lead_id: item.lead_id,
            status: "initiating",
            metadata: {
              source: "bulk_queue",
              queue_item_id: item.id,
              lead_name: lead.name
            }
          })
          .select()
          .single();

        if (callError) {
          throw new Error(`Failed to create call record: ${callError.message}`);
        }

        // Make API call to Bolna
        const bolnaResponse = await fetch(`${BOLNA_API_URL}/agent/${agent.external_agent_id}/make_call`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient_phone_number: lead.phone_number,
            user_data: {
              lead_id: lead.id,
              lead_name: lead.name || "Customer",
              call_id: callRecord.id,
              queue_item_id: item.id
            }
          }),
        });

        if (!bolnaResponse.ok) {
          const errorText = await bolnaResponse.text();
          throw new Error(`Bolna API error: ${bolnaResponse.status} - ${errorText}`);
        }

        const bolnaData = await bolnaResponse.json();
        const executionId = bolnaData.execution_id || bolnaData.id;

        // Update call with execution ID
        await supabase
          .from("calls")
          .update({
            external_call_id: String(executionId),
            status: "queued",
            started_at: new Date().toISOString()
          })
          .eq("id", callRecord.id);

        // Update queue item with call reference
        await supabase
          .from("call_queue")
          .update({ call_id: callRecord.id })
          .eq("id", item.id);

        // Update lead last_call_at
        await supabase
          .from("real_estate_leads")
          .update({ 
            last_call_at: new Date().toISOString(),
            stage: "contacted"
          })
          .eq("id", lead.id)
          .eq("stage", "new"); // Only update if still 'new'

        results.push({
          queue_item_id: item.id,
          call_id: callRecord.id,
          execution_id: executionId,
          success: true
        });

        console.log(`Call initiated for lead ${lead.id}, execution ID: ${executionId}`);

      } catch (itemError) {
        console.error(`Error processing queue item ${item.id}:`, itemError);
        
        await supabase
          .from("call_queue")
          .update({ 
            status: "failed", 
            error_message: itemError instanceof Error ? itemError.message : "Unknown error",
            completed_at: new Date().toISOString()
          })
          .eq("id", item.id);

        results.push({
          queue_item_id: item.id,
          success: false,
          error: itemError instanceof Error ? itemError.message : "Unknown error"
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results,
        active_calls: (activeCallsCount || 0) + results.filter(r => r.success).length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Queue processing error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
