import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BolnaWebhookPayload {
  event: string;
  call_id: string;
  agent_id: string;
  duration?: number;
  status?: string;
  recording_url?: string;
  transcript?: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: BolnaWebhookPayload = await req.json();

    console.log("Bolna webhook received:", payload);

    // Find the call by external_call_id
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("*")
      .eq("external_call_id", payload.call_id)
      .maybeSingle();

    if (callError || !call) {
      console.error("Call not found for external_call_id:", payload.call_id);
      return new Response(
        JSON.stringify({ success: false, error: "Call not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different webhook events
    switch (payload.event) {
      case "call.ringing":
        await supabase
          .from("calls")
          .update({ status: "ringing" })
          .eq("id", call.id);
        break;

      case "call.answered":
      case "call.connected":
        await supabase
          .from("calls")
          .update({ status: "in_progress" })
          .eq("id", call.id);
        
        // Update lead status
        await supabase
          .from("leads")
          .update({ status: "connected" })
          .eq("id", call.lead_id);
        break;

      case "call.ended":
      case "call.completed":
        const durationSeconds = payload.duration || 0;
        const isConnected = durationSeconds >= 45;

        // Update call record - the trigger will handle credit deduction
        await supabase
          .from("calls")
          .update({
            status: "completed",
            duration_seconds: durationSeconds,
            connected: isConnected,
            ended_at: new Date().toISOString(),
            metadata: {
              ...call.metadata,
              recording_url: payload.recording_url,
              transcript: payload.transcript,
            },
          })
          .eq("id", call.id);

        // Update lead status
        await supabase
          .from("leads")
          .update({ status: isConnected ? "connected" : "completed" })
          .eq("id", call.lead_id);
        break;

      case "call.failed":
      case "call.no_answer":
        await supabase
          .from("calls")
          .update({
            status: payload.event === "call.no_answer" ? "no_answer" : "failed",
            ended_at: new Date().toISOString(),
          })
          .eq("id", call.id);

        // Update lead status
        await supabase
          .from("leads")
          .update({ status: "failed" })
          .eq("id", call.lead_id);
        break;

      default:
        console.log("Unhandled webhook event:", payload.event);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Webhook processing error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
