import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Updated to accept seats count from request
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIAL_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    
    try {
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser();
      if (claimsError || !claimsData?.user) {
        throw new Error("Unauthorized");
      }
      userId = claimsData.user.id;
    } catch (e) {
      throw new Error("Unauthorized");
    }

    // Get seats count from request body
    let seatsCount = 1;
    try {
      const body = await req.json();
      seatsCount = Math.max(1, body.seats || 1);
    } catch {
      seatsCount = 1;
    }

    console.log(`Starting trial for client: ${userId} with ${seatsCount} seats`);

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if client already has a subscription
    const { data: existingSubscription, error: fetchError } = await supabaseAdmin
      .from("seat_subscriptions")
      .select("*")
      .eq("client_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching subscription:", fetchError);
      throw new Error("Failed to check subscription status");
    }

    // Check if already used trial
    if (existingSubscription) {
      if (existingSubscription.trial_started_at) {
        // Check if trial already used
        const trialEnds = new Date(existingSubscription.trial_ends_at);
        const now = new Date();
        
        if (existingSubscription.is_trial && now < trialEnds) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Trial already active",
              subscription: existingSubscription 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Trial expired
        if (now >= trialEnds && !existingSubscription.autopay_enabled) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "trial_expired",
              message: "Trial has expired. Please set up autopay to continue." 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      // Already has active paid subscription
      if (existingSubscription.status === "active" && !existingSubscription.is_trial) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Already has active subscription",
            subscription: existingSubscription 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Start new trial
    const now = new Date();
    const trialEnds = new Date(now);
    trialEnds.setDate(trialEnds.getDate() + TRIAL_DAYS);

    const subscriptionData = {
      client_id: userId,
      seats_count: seatsCount,
      status: "active",
      is_trial: true,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      autopay_enabled: false,
      updated_at: now.toISOString(),
    };

    let subscription;
    
    if (existingSubscription) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from("seat_subscriptions")
        .update(subscriptionData)
        .eq("id", existingSubscription.id)
        .select()
        .single();
      
      if (error) throw error;
      subscription = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from("seat_subscriptions")
        .insert(subscriptionData)
        .select()
        .single();
      
      if (error) throw error;
      subscription = data;
    }

    console.log(`Trial started for client ${userId}, expires: ${trialEnds.toISOString()}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `7-day free trial started! Expires on ${trialEnds.toLocaleDateString()}`,
        subscription,
        trialEndsAt: trialEnds.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error starting trial:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
