import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefundRequest {
  paymentId: string;
  reason: string;
  amount?: number; // Optional - for partial refunds in paise
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      throw new Error("Only admins can process refunds");
    }

    const { paymentId, reason, amount }: RefundRequest = await req.json();

    if (!paymentId || !reason) {
      throw new Error("Payment ID and reason are required");
    }

    // Get payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    if (payment.status === "refunded") {
      throw new Error("Payment has already been refunded");
    }

    if (!payment.razorpay_payment_id) {
      throw new Error("Payment was not completed - cannot refund");
    }

    // Process refund via Razorpay
    const refundAmount = amount || payment.amount;
    const authString = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    const razorpayResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${authString}`,
        },
        body: JSON.stringify({
          amount: refundAmount,
          notes: {
            reason: reason,
            refunded_by: user.id,
          },
        }),
      }
    );

    if (!razorpayResponse.ok) {
      const errorText = await razorpayResponse.text();
      console.error("Razorpay refund error:", errorText);
      throw new Error("Failed to process refund with Razorpay");
    }

    const refundData = await razorpayResponse.json();

    // Update payment record
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "refunded",
        refund_id: refundData.id,
        refund_amount: refundAmount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
        refunded_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("Failed to update payment record:", updateError);
    }

    // Deduct credits from client
    const creditsToDeduct = payment.credits;
    const { data: currentCredits } = await supabaseAdmin
      .from("client_credits")
      .select("balance")
      .eq("client_id", payment.client_id)
      .single();

    if (currentCredits) {
      const newBalance = Math.max(0, currentCredits.balance - creditsToDeduct);
      await supabaseAdmin
        .from("client_credits")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("client_id", payment.client_id);

      // Log the transaction
      await supabaseAdmin
        .from("credit_transactions")
        .insert({
          client_id: payment.client_id,
          amount: -creditsToDeduct,
          transaction_type: "refund",
          description: `Refund: ${reason}`,
          created_by: user.id,
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        refundId: refundData.id,
        amount: refundAmount,
        credits: creditsToDeduct,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing refund:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
