import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  seats: number;
  isAutopaySetup?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_SECRET) {
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

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    let userId: string;
    if (claimsError || !claimsData?.claims) {
      const { data: { user: userData }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData) {
        throw new Error("Unauthorized");
      }
      userId = userData.id;
    } else {
      userId = claimsData.claims.sub as string;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, seats, isAutopaySetup }: VerifyRequest = await req.json();

    console.log("Verifying seat payment:", { razorpay_order_id, razorpay_payment_id, seats, isAutopaySetup });

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const encoder = new TextEncoder();
    const key = encoder.encode(RAZORPAY_KEY_SECRET);
    const message = encoder.encode(body);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, message);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      console.error("Signature mismatch");
      throw new Error("Invalid payment signature");
    }

    console.log("Payment signature verified successfully");

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the seat payment record
    const { data: seatPayment, error: paymentError } = await supabaseAdmin
      .from("seat_payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .single();

    if (paymentError || !seatPayment) {
      console.error("Seat payment not found:", paymentError);
      throw new Error("Payment record not found");
    }

    // Update seat payment status
    const { error: updatePaymentError } = await supabaseAdmin
      .from("seat_payments")
      .update({
        status: "completed",
        razorpay_payment_id,
      })
      .eq("id", seatPayment.id);

    if (updatePaymentError) {
      console.error("Error updating seat payment:", updatePaymentError);
      throw new Error("Failed to update payment record");
    }

    // Calculate next billing date (1 month from now)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // Upsert seat subscription
    const { data: existingSub } = await supabaseAdmin
      .from("seat_subscriptions")
      .select("*")
      .eq("client_id", userId)
      .single();

    const now = new Date();
    
    if (existingSub) {
      // Update existing subscription
      const updateData: any = {
        status: "active",
        last_payment_date: now.toISOString(),
        next_billing_date: nextBillingDate.toISOString(),
        is_trial: false, // No longer on trial after payment
        updated_at: now.toISOString(),
      };
      
      if (isAutopaySetup) {
        // Autopay setup - set autopay flag and use the seats count from payment
        updateData.autopay_enabled = true;
        updateData.autopay_setup_at = now.toISOString();
        updateData.seats_count = seats;
      } else {
        // Regular seat purchase - add to existing seats
        updateData.seats_count = existingSub.seats_count + seats;
      }
      
      const { error: updateError } = await supabaseAdmin
        .from("seat_subscriptions")
        .update(updateData)
        .eq("client_id", userId);

      if (updateError) {
        console.error("Error updating subscription:", updateError);
        throw new Error("Failed to update subscription");
      }

      console.log(`Updated subscription: ${updateData.seats_count} total seats, autopay: ${isAutopaySetup}`);
    } else {
      // Create new subscription
      const insertData: any = {
        client_id: userId,
        seats_count: seats,
        status: "active",
        last_payment_date: now.toISOString(),
        next_billing_date: nextBillingDate.toISOString(),
        is_trial: false,
      };
      
      if (isAutopaySetup) {
        insertData.autopay_enabled = true;
        insertData.autopay_setup_at = now.toISOString();
      }
      
      const { error: insertError } = await supabaseAdmin
        .from("seat_subscriptions")
        .insert(insertData);

      if (insertError) {
        console.error("Error creating subscription:", insertError);
        throw new Error("Failed to create subscription");
      }

      console.log(`Created new subscription: ${seats} seats`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully purchased ${seats} seat(s)`,
        seats,
        nextBillingDate: nextBillingDate.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error verifying seat payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
