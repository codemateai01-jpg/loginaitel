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
  credits: number;
  amount: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_SECRET) {
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

    // Verify user using getClaims (works with signing-keys)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    let userId: string;
    if (claimsError || !claimsData?.claims) {
      // Fallback to getUser for backward compatibility
      const { data: { user: userData }, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData) {
        throw new Error("Unauthorized");
      }
      userId = userData.id;
    } else {
      userId = claimsData.claims.sub as string;
    }
    
    // Create user object for compatibility
    const user = { id: userId };

    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      credits,
      amount 
    }: VerifyRequest = await req.json();

    // Verify signature using Web Crypto API
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(RAZORPAY_KEY_SECRET);
    const messageData = encoder.encode(body);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      throw new Error("Invalid payment signature");
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if this payment was already processed via payments table
    const { data: existingPayment } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();

    if (existingPayment && existingPayment.status === "completed") {
      return new Response(
        JSON.stringify({ success: true, message: "Payment already processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update payment record with payment ID and completed status
    const { error: paymentUpdateError } = await supabaseAdmin
      .from("payments")
      .update({
        razorpay_payment_id: razorpay_payment_id,
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("razorpay_order_id", razorpay_order_id);

    // Get current credits
    const { data: currentCredits } = await supabaseAdmin
      .from("client_credits")
      .select("balance")
      .eq("client_id", user.id)
      .maybeSingle();

    const newBalance = (currentCredits?.balance || 0) + credits;

    // Update or insert credits
    const { error: creditError } = await supabaseAdmin
      .from("client_credits")
      .upsert({
        client_id: user.id,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id" });

    if (creditError) {
      console.error("Credit update error:", creditError);
      throw new Error("Failed to update credits");
    }

    // Record transaction
    const { error: txError } = await supabaseAdmin
      .from("credit_transactions")
      .insert({
        client_id: user.id,
        amount: credits,
        transaction_type: "credit_addition",
        description: `Razorpay: ${razorpay_payment_id}`,
      });

    if (txError) {
      console.error("Transaction record error:", txError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        newBalance,
        credits,
        paymentId: razorpay_payment_id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
