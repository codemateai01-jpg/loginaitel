import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Aitel/Bolna webhook payload follows the Agent Execution response structure
interface AitelWebhookPayload {
  id: number | string;
  agent_id: string;
  batch_id?: string;
  conversation_time?: number;
  total_cost?: number;
  status: string;
  error_message?: string | null;
  answered_by_voice_mail?: boolean;
  transcript?: string;
  created_at?: string;
  updated_at?: string;
  usage_breakdown?: {
    synthesizer_characters?: number;
    transcriber_duration?: number;
    llm_tokens?: number;
  };
  telephony_data?: {
    duration?: number;
    to_number?: string;
    from_number?: string;
    recording_url?: string;
    provider_call_id?: string;
    call_type?: string;
    provider?: string;
  };
  extracted_data?: Record<string, unknown>;
  context_details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: AitelWebhookPayload = await req.json();

    console.log("Aitel webhook received:", JSON.stringify(payload, null, 2));

    // Extract execution ID
    const executionId = String(payload.id);
    const status = payload.status?.toLowerCase().replace(/-/g, "_");
    
    // Try to find the call by external_call_id (execution ID)
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("*")
      .eq("external_call_id", executionId)
      .maybeSingle();

    if (callError) {
      console.error("Error finding call:", callError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!call) {
      // If no call found, try finding by provider_call_id from telephony_data
      if (payload.telephony_data?.provider_call_id) {
        const { data: callByProvider } = await supabase
          .from("calls")
          .select("*")
          .eq("external_call_id", payload.telephony_data.provider_call_id)
          .maybeSingle();
        
        if (callByProvider) {
          return await processCallUpdate(supabase, callByProvider, payload, status);
        }
      }
      
      console.log("Call not found for execution ID:", executionId);
      return new Response(
        JSON.stringify({ success: true, message: "Call not found, webhook acknowledged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return await processCallUpdate(supabase, call, payload, status);

  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processCallUpdate(
  supabase: any,
  call: any,
  payload: AitelWebhookPayload,
  status: string
) {
  console.log(`Processing call ${call.id} with status: ${status}`);

  // Get duration from telephony_data or conversation_time
  const durationSeconds = payload.telephony_data?.duration || payload.conversation_time || 0;
  const recordingUrl = payload.telephony_data?.recording_url || null;
  const transcript = payload.transcript || null;

  // Map statuses to our internal statuses
  let mappedStatus = call.status;
  let isCompleted = false;
  
  switch (status) {
    case "queued":
      mappedStatus = "queued";
      break;
    case "initiated":
      mappedStatus = "initiated";
      break;
    case "ringing":
      mappedStatus = "ringing";
      break;
    case "in_progress":
      mappedStatus = "in_progress";
      break;
    case "call_disconnected":
      mappedStatus = "disconnected";
      break;
    case "completed":
      mappedStatus = "completed";
      isCompleted = true;
      break;
    case "busy":
      mappedStatus = "busy";
      isCompleted = true;
      break;
    case "no_answer":
      mappedStatus = "no_answer";
      isCompleted = true;
      break;
    case "canceled":
    case "stopped":
      mappedStatus = "canceled";
      isCompleted = true;
      break;
    case "failed":
    case "error":
    case "balance_low":
      mappedStatus = "failed";
      isCompleted = true;
      break;
    default:
      console.log("Unknown status:", status);
      mappedStatus = status;
  }

  // Calculate if call had any conversation (for lead status updates and real estate processing)
  // Note: The database trigger process_call_completion determines 'connected' based on duration >= 45 seconds
  // and handles credit deduction. We don't set 'connected' here to let the trigger manage it properly.
  const isConnected = durationSeconds >= 45 && (status === "completed" || status === "call_disconnected");

  // Build update object
  const updateData: Record<string, unknown> = {
    status: mappedStatus,
    metadata: {
      ...((call.metadata as Record<string, unknown>) || {}),
      aitel_status: payload.status,
      error_message: payload.error_message,
      answered_by_voicemail: payload.answered_by_voice_mail,
      usage_breakdown: payload.usage_breakdown,
      telephony_provider: payload.telephony_data?.provider,
      extracted_data: payload.extracted_data,
      last_webhook_at: new Date().toISOString(),
    },
  };

  // Add completion data if call is finished
  // The trigger will set 'connected' based on duration_seconds >= 45 and handle credit deduction
  if (isCompleted) {
    updateData.duration_seconds = durationSeconds;
    updateData.ended_at = new Date().toISOString();
    
    if (recordingUrl) {
      updateData.recording_url = recordingUrl;
    }
    
    if (transcript) {
      updateData.transcript = transcript;
    }
  }

  // Update in_progress status with started_at
  if (status === "in_progress" && !call.started_at) {
    updateData.started_at = new Date().toISOString();
  }

  // Update the call record
  const { error: updateError } = await supabase
    .from("calls")
    .update(updateData)
    .eq("id", call.id);

  if (updateError) {
    console.error("Failed to update call:", updateError);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to update call" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update lead status based on call outcome
  if (call.lead_id && isCompleted) {
    let leadStatus = "completed";
    if (isConnected) {
      leadStatus = "connected";
    } else if (status === "no_answer") {
      leadStatus = "no_answer";
    } else if (status === "busy") {
      leadStatus = "busy";
    } else if (status === "failed" || status === "error") {
      leadStatus = "failed";
    }

    await supabase
      .from("leads")
      .update({ status: leadStatus })
      .eq("id", call.lead_id);
  }

  // Check if this is a real estate call and process AI analysis
  const metadata = call.metadata as Record<string, unknown> || {};
  if (metadata.source === "bulk_queue" && metadata.queue_item_id && isCompleted) {
    await processRealEstateCall(supabase, call, payload, isConnected);
  }

  console.log(`Call ${call.id} updated successfully with status: ${mappedStatus}`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      call_id: call.id,
      status: mappedStatus,
      connected: isConnected,
      duration: durationSeconds
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Process real estate calls with AI analysis
async function processRealEstateCall(
  supabase: any,
  call: any,
  payload: AitelWebhookPayload,
  isConnected: boolean
) {
  const metadata = call.metadata as Record<string, unknown>;
  const queueItemId = metadata.queue_item_id as string;

  try {
    // Update queue item as completed
    await supabase
      .from("call_queue")
      .update({ 
        status: "completed", 
        completed_at: new Date().toISOString() 
      })
      .eq("id", queueItemId);

    // Get the real estate lead
    const { data: reLead } = await supabase
      .from("real_estate_leads")
      .select("*")
      .eq("id", call.lead_id)
      .single();

    if (!reLead) return;

    // Determine disposition
    let disposition: string = "not_answered";
    if (isConnected) {
      disposition = "answered";
    } else if (payload.status === "busy") {
      disposition = "busy";
    } else if (payload.answered_by_voice_mail) {
      disposition = "voicemail";
    }

    // Analyze transcript for interest and objections
    const transcript = payload.transcript || "";
    const extractedData = payload.extracted_data || {};
    
    // Simple interest detection from transcript/extracted data
    let interestScore = 50; // Default neutral
    let autoStageUpdate: string | null = null;
    const objections: string[] = [];

    // Check for interest indicators
    const interestedKeywords = ["interested", "yes", "sure", "tell me more", "want to visit", "schedule", "book"];
    const notInterestedKeywords = ["not interested", "no thanks", "don't call", "remove", "stop calling"];
    const objectionKeywords = ["expensive", "budget", "location", "too far", "not now", "later", "busy"];

    const lowerTranscript = transcript.toLowerCase();
    
    if (interestedKeywords.some(k => lowerTranscript.includes(k))) {
      interestScore = 80;
      autoStageUpdate = "interested";
    }
    
    if (notInterestedKeywords.some(k => lowerTranscript.includes(k))) {
      interestScore = 20;
      autoStageUpdate = "lost";
    }

    // Detect objections
    for (const keyword of objectionKeywords) {
      if (lowerTranscript.includes(keyword)) {
        objections.push(keyword);
      }
    }

    // Use extracted data if available
    if (extractedData.interest_level) {
      const level = String(extractedData.interest_level).toLowerCase();
      if (level === "high" || level === "interested") {
        interestScore = 85;
        autoStageUpdate = "interested";
      } else if (level === "low" || level === "not interested") {
        interestScore = 25;
      }
    }

    // Create real estate call record
    await supabase
      .from("real_estate_calls")
      .insert({
        call_id: call.id,
        lead_id: call.lead_id,
        client_id: call.client_id,
        disposition,
        ai_summary: transcript.substring(0, 500) || "No transcript available",
        objections_detected: objections.length > 0 ? objections : null,
        interest_score: interestScore,
        auto_stage_update: autoStageUpdate
      });

    // Update lead with call analysis
    const leadUpdate: Record<string, unknown> = {
      last_call_at: new Date().toISOString(),
      last_call_summary: transcript.substring(0, 500) || "Call completed",
      interest_score: interestScore,
    };

    if (objections.length > 0) {
      leadUpdate.objections = [...(reLead.objections || []), ...objections].slice(-10);
    }

    // Auto-update stage to "interested" if detected
    if (autoStageUpdate === "interested" && reLead.stage === "contacted") {
      leadUpdate.stage = "interested";
    } else if (autoStageUpdate === "lost") {
      leadUpdate.stage = "lost";
    }

    await supabase
      .from("real_estate_leads")
      .update(leadUpdate)
      .eq("id", call.lead_id);

    console.log(`Real estate call processed for lead ${call.lead_id}, interest: ${interestScore}`);

  } catch (error) {
    console.error("Error processing real estate call:", error);
  }
}
