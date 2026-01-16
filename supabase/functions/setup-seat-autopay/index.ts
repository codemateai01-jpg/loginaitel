import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEAT_PRICE = 300; // ₹300 per seat per month

interface SetupAutopayRequest {
  seats: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      throw new Error("Unauthorized");
    }
    const userId = userData.user.id;

    const { seats }: SetupAutopayRequest = await req.json();

    if (!seats || seats <= 0) {
      throw new Error("Invalid number of seats");
    }

    console.log(`Setting up autopay for client ${userId} with ${seats} seats`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("seat_subscriptions")
      .select("*")
      .eq("client_id", userId)
      .maybeSingle();

    if (subError) {
      throw new Error("Failed to fetch subscription");
    }

    // Calculate first payment - if on trial, charge when trial ends
    // If trial expired, charge immediately
    const now = new Date();
    let chargeNow = false;
    
    if (subscription?.is_trial && subscription?.trial_ends_at) {
      const trialEnds = new Date(subscription.trial_ends_at);
      chargeNow = now >= trialEnds;
    } else {
      chargeNow = true;
    }

    const amount = seats * SEAT_PRICE;

    // Create Razorpay order for the first payment
    const receiptId = `autopay_${Date.now().toString(36)}`;
    const orderData = {
      amount: amount * 100, // Convert to paise
      currency: "INR",
      receipt: receiptId,
      notes: {
        client_id: userId,
        seats: seats.toString(),
        type: "autopay_setup",
        is_first_payment: chargeNow.toString(),
      },
    };

    const authString = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify(orderData),
    });

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error("Razorpay error:", errorText);
      throw new Error("Failed to create Razorpay order");
    }

    const order = await razorpayResponse.json();
    console.log("Razorpay order created for autopay:", order.id);

    // Calculate billing period
    const billingStart = now;
    const billingEnd = new Date(now);
    billingEnd.setMonth(billingEnd.getMonth() + 1);

    // Create seat payment record for autopay setup
    const { error: insertError } = await supabaseAdmin
      .from("seat_payments")
      .insert({
        client_id: userId,
        seats_count: seats,
        amount: amount,
        razorpay_order_id: order.id,
        status: "pending",
        billing_period_start: billingStart.toISOString(),
        billing_period_end: billingEnd.toISOString(),
      });

    if (insertError) {
      console.error("Error creating seat payment record:", insertError);
      throw new Error("Failed to create payment record");
    }

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID,
        seats,
        seatPrice: SEAT_PRICE,
        chargeNow,
        isAutopaySetup: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error setting up autopay:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
