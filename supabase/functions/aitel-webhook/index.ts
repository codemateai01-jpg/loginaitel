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
    
    // First, check if we have the internal call_id in context_details
    const contextDetails = payload.context_details as Record<string, unknown> || {};
    const recipientData = contextDetails.recipient_data as Record<string, unknown> || {};
    const internalCallId = recipientData.call_id as string | undefined;
    
    let call = null;
    
    // Try to find by internal call_id first (most reliable)
    if (internalCallId) {
      const { data: callByInternalId, error } = await supabase
        .from("calls")
        .select("*")
        .eq("id", internalCallId)
        .maybeSingle();
      
      if (!error && callByInternalId) {
        call = callByInternalId;
        console.log(`Found call by internal ID: ${internalCallId}`);
        
        // Update the external_call_id if not set
        if (!callByInternalId.external_call_id || callByInternalId.external_call_id !== executionId) {
          await supabase
            .from("calls")
            .update({ external_call_id: executionId })
            .eq("id", internalCallId);
        }
      }
    }
    
    // Fallback: Try to find by external_call_id (execution ID)
    if (!call) {
      const { data: callByExternal, error: callError } = await supabase
        .from("calls")
        .select("*")
        .eq("external_call_id", executionId)
        .maybeSingle();

      if (!callError && callByExternal) {
        call = callByExternal;
        console.log(`Found call by external ID: ${executionId}`);
      }
    }

    // Fallback: Try finding by provider_call_id from telephony_data
    if (!call && payload.telephony_data?.provider_call_id) {
      const { data: callByProvider } = await supabase
        .from("calls")
        .select("*")
        .eq("external_call_id", payload.telephony_data.provider_call_id)
        .maybeSingle();
      
      if (callByProvider) {
        call = callByProvider;
        console.log(`Found call by provider call ID: ${payload.telephony_data.provider_call_id}`);
      }
    }

    if (!call) {
      console.log("Call not found for execution ID:", executionId, "or internal ID:", internalCallId);
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

  // Check if this is a campaign bulk call and update campaign leads
  if (metadata.source === "campaign_bulk" && metadata.campaign_id && isCompleted) {
    await processCampaignCall(supabase, call, payload, isConnected);
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

// Process campaign bulk calls - update campaign_leads with call results
async function processCampaignCall(
  supabase: any,
  call: any,
  payload: AitelWebhookPayload,
  isConnected: boolean
) {
  const metadata = call.metadata as Record<string, unknown>;
  const campaignId = metadata.campaign_id as string;
  const queueItemId = metadata.queue_item_id as string;

  try {
    // Get campaign retry settings
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("retry_delay_minutes, max_daily_retries")
      .eq("id", campaignId)
      .single();

    const retryDelayMinutes = campaign?.retry_delay_minutes || 3;
    const maxDailyRetries = campaign?.max_daily_retries || 5;

    // Check if this was a no_answer/busy call and should be retried
    const shouldRetry = !isConnected && 
      (payload.status === "no_answer" || payload.status === "no-answer" || 
       payload.status === "busy" || !payload.answered_by_voice_mail);

    // Get current queue item to check retry count
    const { data: queueItem } = await supabase
      .from("campaign_call_queue")
      .select("retry_count, daily_retry_date")
      .eq("id", queueItemId)
      .single();

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let currentRetryCount = queueItem?.retry_count || 0;
    
    // Reset retry count if it's a new day
    if (queueItem?.daily_retry_date !== today) {
      currentRetryCount = 0;
    }

    const canRetry = shouldRetry && currentRetryCount < maxDailyRetries;

    // Update campaign queue item
    if (queueItemId) {
      if (canRetry) {
        // Schedule a retry
        const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
        await supabase
          .from("campaign_call_queue")
          .update({ 
            status: "retry_pending",
            last_attempt_at: new Date().toISOString(),
            next_retry_at: nextRetryAt.toISOString(),
            retry_count: currentRetryCount + 1,
            daily_retry_date: today,
            error_message: `No answer - retry ${currentRetryCount + 1}/${maxDailyRetries} scheduled for ${nextRetryAt.toLocaleTimeString()}`
          })
          .eq("id", queueItemId);
        
        console.log(`Scheduled retry ${currentRetryCount + 1}/${maxDailyRetries} for queue item ${queueItemId} at ${nextRetryAt.toISOString()}`);
      } else {
        // Mark as completed (or failed if max retries reached)
        const finalStatus = shouldRetry && currentRetryCount >= maxDailyRetries ? "max_retries_reached" : "completed";
        await supabase
          .from("campaign_call_queue")
          .update({ 
            status: finalStatus, 
            completed_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            error_message: finalStatus === "max_retries_reached" 
              ? `Max daily retries (${maxDailyRetries}) reached without connection` 
              : null
          })
          .eq("id", queueItemId);
      }
    }

    // Get the campaign lead
    const { data: campaignLead } = await supabase
      .from("campaign_leads")
      .select("*")
      .eq("id", call.lead_id)
      .single();

    if (!campaignLead) {
      console.log("Campaign lead not found for call", call.id);
      return;
    }

    // Analyze transcript for interest level
    const transcript = payload.transcript || "";
    const extractedData = payload.extracted_data || {};
    const durationSeconds = payload.telephony_data?.duration || payload.conversation_time || 0;
    
    // Determine sentiment from call
    let sentiment: string = "neutral";
    let interestLevel: string = "unknown";
    let newStage: string = campaignLead.stage;

    // Interest detection keywords
    const highInterestKeywords = [
      "interested", "yes please", "tell me more", "want to", "schedule", 
      "book", "sign up", "buy", "purchase", "great", "sounds good", "perfect"
    ];
    const lowInterestKeywords = [
      "not interested", "no thanks", "don't call", "remove me", "stop calling",
      "already have", "not looking", "no need", "don't want"
    ];
    const partialInterestKeywords = [
      "maybe", "not sure", "think about", "call back", "later", "send info",
      "email me", "need to discuss", "check with", "let me think"
    ];

    const lowerTranscript = transcript.toLowerCase();

    // Check for interest indicators
    if (highInterestKeywords.some(k => lowerTranscript.includes(k))) {
      interestLevel = "interested";
      sentiment = "positive";
      newStage = "interested";
    } else if (lowInterestKeywords.some(k => lowerTranscript.includes(k))) {
      interestLevel = "not_interested";
      sentiment = "negative";
      newStage = "not_interested";
    } else if (partialInterestKeywords.some(k => lowerTranscript.includes(k))) {
      interestLevel = "partially_interested";
      sentiment = "neutral";
      newStage = "partially_interested";
    } else if (isConnected && durationSeconds >= 60) {
      // Decent conversation happened, assume some interest
      interestLevel = "partially_interested";
      sentiment = "neutral";
      newStage = "contacted";
    } else if (!isConnected) {
      // Not connected - keep as contacted
      newStage = "contacted";
    }

    // Use extracted data if available from Bolna
    if (extractedData.interest_level) {
      const level = String(extractedData.interest_level).toLowerCase();
      if (level === "high" || level === "interested" || level === "very interested") {
        interestLevel = "interested";
        sentiment = "positive";
        newStage = "interested";
      } else if (level === "low" || level === "not interested" || level === "none") {
        interestLevel = "not_interested";
        sentiment = "negative";
        newStage = "not_interested";
      } else if (level === "medium" || level === "partial" || level === "maybe") {
        interestLevel = "partially_interested";
        sentiment = "neutral";
        newStage = "partially_interested";
      }
    }

    if (extractedData.sentiment) {
      const extractedSentiment = String(extractedData.sentiment).toLowerCase();
      if (["positive", "happy", "satisfied", "excited"].includes(extractedSentiment)) {
        sentiment = "positive";
      } else if (["negative", "angry", "frustrated", "annoyed"].includes(extractedSentiment)) {
        sentiment = "negative";
      }
    }

    // Generate call summary
    let callSummary = "";
    if (extractedData.summary) {
      callSummary = String(extractedData.summary);
    } else if (transcript) {
      // Simple summary from transcript (first 300 chars of meaningful content)
      callSummary = transcript.substring(0, 300);
      if (transcript.length > 300) callSummary += "...";
    } else if (!isConnected) {
      if (payload.status === "no_answer" || payload.status === "no-answer") {
        callSummary = "No answer - call was not picked up";
      } else if (payload.status === "busy") {
        callSummary = "Line busy - could not connect";
      } else if (payload.answered_by_voice_mail) {
        callSummary = "Reached voicemail";
      } else {
        callSummary = `Call ended - ${payload.status || "disconnected"}`;
      }
    }

    // Update campaign lead with call results
    const leadUpdate: Record<string, unknown> = {
      call_id: call.id,
      call_status: isConnected ? "connected" : "not_connected",
      call_duration: durationSeconds,
      call_summary: callSummary,
      call_sentiment: sentiment,
      interest_level: interestLevel,
      stage: newStage,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("campaign_leads")
      .update(leadUpdate)
      .eq("id", call.lead_id);

    // Update campaign statistics
    const campaignUpdate: Record<string, unknown> = {};
    
    // Always increment contacted_leads when a call completes (first time for this lead)
    if (campaignLead.call_status === null) {
      // This is the first call to this lead, increment contacted_leads
      const { data: campaignStats } = await supabase
        .from("campaigns")
        .select("contacted_leads")
        .eq("id", campaignId)
        .single();
      
      if (campaignStats) {
        campaignUpdate.contacted_leads = (campaignStats.contacted_leads || 0) + 1;
      }
    }
    
    if (interestLevel === "interested") {
      // Increment interested_leads count
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("interested_leads")
        .eq("id", campaignId)
        .single();
      
      if (campaign) {
        campaignUpdate.interested_leads = (campaign.interested_leads || 0) + 1;
      }
    } else if (interestLevel === "not_interested") {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("not_interested_leads")
        .eq("id", campaignId)
        .single();
      
      if (campaign) {
        campaignUpdate.not_interested_leads = (campaign.not_interested_leads || 0) + 1;
      }
    } else if (interestLevel === "partially_interested") {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("partially_interested_leads")
        .eq("id", campaignId)
        .single();
      
      if (campaign) {
        campaignUpdate.partially_interested_leads = (campaign.partially_interested_leads || 0) + 1;
      }
    }

    if (Object.keys(campaignUpdate).length > 0) {
      await supabase
        .from("campaigns")
        .update(campaignUpdate)
        .eq("id", campaignId);
    }

    console.log(`Campaign call processed for lead ${call.lead_id}: interest=${interestLevel}, sentiment=${sentiment}, stage=${newStage}`);

  } catch (error) {
    console.error("Error processing campaign call:", error);
  }
}
