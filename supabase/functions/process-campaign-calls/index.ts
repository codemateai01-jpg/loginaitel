import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOLNA_API_KEY = Deno.env.get("BOLNA_API_KEY")!;
const BOLNA_API_BASE = "https://api.bolna.ai";

interface QueueItem {
  id: string;
  campaign_id: string;
  lead_id: string;
  client_id: string;
  agent_id: string;
  status: string;
  priority: number;
  lead: {
    id: string;
    phone_number: string;
    name: string;
  };
  agent: {
    id: string;
    external_agent_id: string;
    agent_name: string;
  };
  campaign: {
    id: string;
    concurrency_level: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse request body for campaign_id filter (optional)
    let campaignId: string | null = null;
    if (req.method === "POST") {
      const body = await req.json();
      campaignId = body.campaign_id || null;
    }

    // Get count of currently active calls for this campaign or globally
    let activeQuery = supabase
      .from("campaign_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress");
    
    if (campaignId) {
      activeQuery = activeQuery.eq("campaign_id", campaignId);
    }

    const { count: activeCallsCount, error: countError } = await activeQuery;

    if (countError) {
      throw new Error(`Failed to count active calls: ${countError.message}`);
    }

    // Get campaign concurrency level (use default of 10 if not specified)
    let maxConcurrency = 10;
    if (campaignId) {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("concurrency_level")
        .eq("id", campaignId)
        .single();
      
      if (campaign) {
        maxConcurrency = campaign.concurrency_level || 10;
      }
    }

    const availableSlots = maxConcurrency - (activeCallsCount || 0);

    if (availableSlots <= 0) {
      console.log("No available slots for new calls");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Queue is at capacity", 
          active_calls: activeCallsCount,
          max_concurrency: maxConcurrency,
          processed: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending queue items ordered by priority and queue time
    let pendingQuery = supabase
      .from("campaign_call_queue")
      .select(`
        id,
        campaign_id,
        lead_id,
        client_id,
        agent_id,
        status,
        priority,
        lead:campaign_leads!campaign_call_queue_lead_id_fkey(id, phone_number, name),
        agent:aitel_agents!campaign_call_queue_agent_id_fkey(id, external_agent_id, agent_name),
        campaign:campaigns!campaign_call_queue_campaign_id_fkey(id, concurrency_level)
      `)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("queued_at", { ascending: true })
      .limit(availableSlots);

    if (campaignId) {
      pendingQuery = pendingQuery.eq("campaign_id", campaignId);
      
      // Check if campaign is paused
      const { data: campaignStatus } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();
      
      if (campaignStatus?.status === "paused") {
        console.log(`Campaign ${campaignId} is paused, skipping processing`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Campaign is paused", 
            paused: true,
            processed: 0 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: pendingItems, error: queueError } = await pendingQuery;

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

    console.log(`Processing ${pendingItems.length} calls from campaign queue`);

    // Get client phone number for outbound calls
    const clientIds = [...new Set(pendingItems.map(item => item.client_id))];
    const { data: clientPhones } = await supabase
      .from("client_phone_numbers")
      .select("client_id, phone_number")
      .in("client_id", clientIds)
      .eq("is_active", true);

    const clientPhoneMap = new Map(clientPhones?.map(p => [p.client_id, p.phone_number]) || []);

    const results = [];

    for (const item of pendingItems) {
      try {
        // Handle nested objects from join
        const leadData = item.lead as unknown;
        const agentData = item.agent as unknown;
        const lead = Array.isArray(leadData) ? leadData[0] : leadData;
        const agent = Array.isArray(agentData) ? agentData[0] : agentData;

        if (!lead || !agent) {
          console.error(`Missing lead or agent for queue item ${item.id}`);
          await supabase
            .from("campaign_call_queue")
            .update({ 
              status: "failed", 
              error_message: "Missing lead or agent data",
              completed_at: new Date().toISOString()
            })
            .eq("id", item.id);
          continue;
        }

        const fromPhoneNumber = clientPhoneMap.get(item.client_id);
        if (!fromPhoneNumber) {
          console.error(`No phone number for client ${item.client_id}`);
          await supabase
            .from("campaign_call_queue")
            .update({ 
              status: "failed", 
              error_message: "No caller ID phone number allocated",
              completed_at: new Date().toISOString()
            })
            .eq("id", item.id);
          continue;
        }

        // Mark as in_progress
        await supabase
          .from("campaign_call_queue")
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
              source: "campaign_bulk",
              campaign_id: item.campaign_id,
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
        const bolnaResponse = await fetch(`${BOLNA_API_BASE}/call`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${BOLNA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: agent.external_agent_id,
            recipient_phone_number: lead.phone_number,
            from_phone_number: fromPhoneNumber,
            user_data: {
              lead_id: lead.id,
              lead_name: lead.name || "Customer",
              call_id: callRecord.id,
              queue_item_id: item.id,
              campaign_id: item.campaign_id
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
          .from("campaign_call_queue")
          .update({ call_id: callRecord.id })
          .eq("id", item.id);

        // Update lead stage to contacted
        await supabase
          .from("campaign_leads")
          .update({ 
            stage: "contacted",
            call_id: callRecord.id,
            call_status: "in_progress"
          })
          .eq("id", lead.id);

        // Update campaign contacted_leads count
        await supabase
          .from("campaigns")
          .update({ 
            contacted_leads: supabase.rpc('increment_contacted', { row_id: item.campaign_id })
          })
          .eq("id", item.campaign_id);

        results.push({
          queue_item_id: item.id,
          call_id: callRecord.id,
          execution_id: executionId,
          lead_name: lead.name,
          success: true
        });

        console.log(`Call initiated for lead ${lead.id}, execution ID: ${executionId}`);

      } catch (itemError) {
        console.error(`Error processing queue item ${item.id}:`, itemError);
        
        await supabase
          .from("campaign_call_queue")
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
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
        active_calls: (activeCallsCount || 0) + results.filter(r => r.success).length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Campaign queue processing error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
