import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEAT_PRICE = 300; // ₹300 per seat per month

interface UpgradeRequest {
  additionalSeats: number;
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

    const { additionalSeats }: UpgradeRequest = await req.json();

    if (!additionalSeats || additionalSeats <= 0) {
      throw new Error("Invalid number of additional seats");
    }

    console.log(`Upgrading seats for client ${userId}: +${additionalSeats} seats`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current subscription
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("seat_subscriptions")
      .select("*")
      .eq("client_id", userId)
      .single();

    if (subError || !subscription) {
      throw new Error("No active subscription found. Please set up your subscription first.");
    }

    // Check if subscription is active
    if (subscription.status !== "active") {
      throw new Error("Subscription is not active. Please activate your subscription first.");
    }

    const now = new Date();
    let proratedAmount: number;
    let daysRemaining: number;
    let totalDays: number;

    // Calculate prorated amount based on subscription type
    if (subscription.is_trial && subscription.trial_ends_at) {
      // If on trial, no proration - charge for next full month starting from trial end
      const trialEnds = new Date(subscription.trial_ends_at);
      
      if (now >= trialEnds) {
        // Trial expired - charge full month
        proratedAmount = additionalSeats * SEAT_PRICE;
        daysRemaining = 30;
        totalDays = 30;
      } else {
        // Still on trial - charge full month (will start after trial ends)
        proratedAmount = additionalSeats * SEAT_PRICE;
        daysRemaining = 30;
        totalDays = 30;
      }
    } else if (subscription.next_billing_date) {
      // Active paid subscription - calculate proration
      const nextBilling = new Date(subscription.next_billing_date);
      const lastPayment = subscription.last_payment_date 
        ? new Date(subscription.last_payment_date) 
        : new Date(nextBilling.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate total billing period in days
      totalDays = Math.ceil((nextBilling.getTime() - lastPayment.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate remaining days
      daysRemaining = Math.max(1, Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      // Calculate prorated amount
      const dailyRate = SEAT_PRICE / totalDays;
      proratedAmount = Math.ceil(additionalSeats * dailyRate * daysRemaining);

      console.log(`Proration calculation: ${daysRemaining}/${totalDays} days, ₹${proratedAmount} for ${additionalSeats} seats`);
    } else {
      // No next billing date - charge full month
      proratedAmount = additionalSeats * SEAT_PRICE;
      daysRemaining = 30;
      totalDays = 30;
    }

    // Minimum amount check (Razorpay requires minimum ₹1)
    if (proratedAmount < 1) {
      proratedAmount = 1;
    }

    // Create Razorpay order
    const receiptId = `upgrade_${Date.now().toString(36)}`;
    const orderData = {
      amount: proratedAmount * 100, // Convert to paise
      currency: "INR",
      receipt: receiptId,
      notes: {
        client_id: userId,
        additional_seats: additionalSeats.toString(),
        type: "seat_upgrade",
        prorated: "true",
        days_remaining: daysRemaining.toString(),
        total_days: totalDays.toString(),
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
    console.log("Razorpay order created for upgrade:", order.id);

    // Calculate billing period for this upgrade
    const billingStart = now;
    const billingEnd = subscription.next_billing_date 
      ? new Date(subscription.next_billing_date)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Create seat payment record for upgrade
    const { error: insertError } = await supabaseAdmin
      .from("seat_payments")
      .insert({
        client_id: userId,
        seats_count: additionalSeats,
        amount: proratedAmount,
        razorpay_order_id: order.id,
        status: "pending",
        billing_period_start: billingStart.toISOString(),
        billing_period_end: billingEnd.toISOString(),
      });

    if (insertError) {
      console.error("Error creating seat payment record:", insertError);
      throw new Error("Failed to create payment record");
    }

    const newTotalSeats = subscription.seats_count + additionalSeats;
    const fullMonthlyPrice = additionalSeats * SEAT_PRICE;
    const savingsAmount = fullMonthlyPrice - proratedAmount;

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID,
        additionalSeats,
        currentSeats: subscription.seats_count,
        newTotalSeats,
        proratedAmount,
        fullMonthlyPrice,
        savingsAmount,
        daysRemaining,
        totalDays,
        nextBillingDate: subscription.next_billing_date,
        isUpgrade: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error upgrading seats:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
