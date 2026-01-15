import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvoiceRequest {
  paymentId: string;
}

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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { paymentId }: InvoiceRequest = await req.json();

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch payment details
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("client_id", user.id)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "completed") {
      throw new Error("Invoice can only be generated for completed payments");
    }

    // Fetch client profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .single();

    const invoiceDate = new Date(payment.created_at);
    const invoiceNumber = `INV-${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}${String(invoiceDate.getDate()).padStart(2, '0')}-${payment.id.slice(0, 8).toUpperCase()}`;

    // Calculate discount if any
    const basePrice = 3.00; // Default price per credit
    const actualPrice = payment.amount / 100 / payment.credits;
    const discountPercent = actualPrice < basePrice ? Math.round((1 - actualPrice / basePrice) * 100) : 0;
    const discountAmount = discountPercent > 0 ? (basePrice * payment.credits - payment.amount / 100) : 0;

    // Generate HTML invoice
    const invoiceHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #000; padding: 40px; }
    .invoice { max-width: 800px; margin: 0 auto; border: 2px solid #000; }
    .header { background: #000; color: #fff; padding: 30px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 32px; font-weight: 700; }
    .header .invoice-info { text-align: right; }
    .header .invoice-number { font-size: 14px; opacity: 0.8; }
    .header .invoice-date { font-size: 12px; opacity: 0.6; }
    .content { padding: 30px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 10px; }
    .client-info { font-size: 16px; }
    .client-info strong { display: block; font-size: 18px; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 15px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
    .text-right { text-align: right; }
    .totals { border-top: 2px solid #000; margin-top: 20px; padding-top: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 0; font-size: 16px; }
    .totals-row.discount { color: #22c55e; }
    .totals-row.grand-total { border-top: 2px solid #000; padding-top: 15px; margin-top: 10px; font-size: 24px; font-weight: 700; }
    .footer { background: #f5f5f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #666; }
    .badge { display: inline-block; background: #22c55e; color: #fff; padding: 4px 12px; font-size: 12px; font-weight: 600; }
    .payment-id { font-family: monospace; font-size: 12px; color: #666; }
    @media print {
      body { padding: 0; }
      .invoice { border: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div>
        <h1>AITEL</h1>
        <p style="font-size: 12px; opacity: 0.7; margin-top: 5px;">AI Telephony Credits</p>
      </div>
      <div class="invoice-info">
        <div class="invoice-number">${invoiceNumber}</div>
        <div class="invoice-date">${invoiceDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        <div class="badge" style="margin-top: 10px;">PAID</div>
      </div>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">Bill To</div>
        <div class="client-info">
          <strong>${profile?.full_name || 'Customer'}</strong>
          ${profile?.email || user.email || ''}
          ${profile?.phone ? `<br>${profile.phone}` : ''}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Payment Details</div>
        <p class="payment-id">Razorpay ID: ${payment.razorpay_payment_id || 'N/A'}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Aitel Credits</strong>
              <br><span style="font-size: 12px; color: #666;">Voice AI calling credits</span>
            </td>
            <td class="text-right">${payment.credits.toLocaleString()}</td>
            <td class="text-right">₹${basePrice.toFixed(2)}</td>
            <td class="text-right">₹${(basePrice * payment.credits).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>₹${(basePrice * payment.credits).toLocaleString()}</span>
        </div>
        ${discountPercent > 0 ? `
        <div class="totals-row discount">
          <span>Bulk Discount (${discountPercent}%)</span>
          <span>-₹${discountAmount.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="totals-row grand-total">
          <span>Total Paid</span>
          <span>₹${(payment.amount / 100).toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Thank you for your business!</p>
      <p style="margin-top: 5px;">This is a computer-generated invoice. No signature required.</p>
    </div>
  </div>
</body>
</html>`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoiceHtml,
        invoiceNumber,
        fileName: `${invoiceNumber}.html`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error generating invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
