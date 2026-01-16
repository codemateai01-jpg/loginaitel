import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SyncRequest {
  campaign_id: string;
  sheet_url?: string;
}

interface ParsedLead {
  name: string;
  phone_number: string;
  email?: string;
  custom_fields?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token and validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    // Verify user using getClaims (works with signing-keys)
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    let userId: string;
    if (claimsError || !claimsData?.claims) {
      // Fallback to getUser for backward compatibility
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (authError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = userData.user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }
    const body: SyncRequest = await req.json();
    const { campaign_id, sheet_url } = body;

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get campaign and verify ownership
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("client_id", userId)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaign not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use provided URL or stored google_sheet_id
    let fetchUrl = sheet_url;
    
    if (!fetchUrl && campaign.google_sheet_id) {
      // Build URL from stored sheet ID
      const sheetId = campaign.google_sheet_id;
      const range = campaign.google_sheet_range || "Sheet1";
      fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(range)}`;
    }

    if (!fetchUrl) {
      return new Response(
        JSON.stringify({ error: "No Google Sheet URL configured for this campaign" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert share URL to export URL if needed
    if (fetchUrl.includes("/edit") || fetchUrl.includes("/view")) {
      // Extract sheet ID and convert to CSV export URL
      const match = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const sheetId = match[1];
        fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      }
    }

    // If it's already an export URL, use it directly
    if (!fetchUrl.includes("tqx=out:csv") && !fetchUrl.includes("export?format=csv")) {
      // Try to convert to export format
      const match = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const sheetId = match[1];
        fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
      }
    }

    console.log("Fetching Google Sheet from:", fetchUrl);

    // Fetch the CSV data
    const response = await fetch(fetchUrl);
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to fetch Google Sheet. Make sure the sheet is published to the web or shared with 'Anyone with the link'.",
          status: response.status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const csvText = await response.text();
    console.log("CSV preview:", csvText.substring(0, 500));

    // Parse CSV
    const lines = csvText.split("\n").filter(line => line.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "Sheet appears empty or has no data rows" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse headers - handle quoted values
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ""));
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    console.log("Headers found:", headers);

    // Find column indices
    const nameIdx = headers.findIndex(h => 
      h.includes("name") || h === "full_name" || h === "fullname" || h === "contact"
    );
    const phoneIdx = headers.findIndex(h => 
      h.includes("phone") || h.includes("mobile") || h.includes("number") || h === "tel"
    );
    const emailIdx = headers.findIndex(h => 
      h.includes("email") || h.includes("mail")
    );

    if (phoneIdx === -1) {
      return new Response(
        JSON.stringify({ 
          error: "Could not find a phone number column. Please include a column named 'phone', 'phone_number', or 'mobile'.",
          headers_found: headers
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing leads to avoid duplicates
    const { data: existingLeads } = await supabase
      .from("campaign_leads")
      .select("phone_number")
      .eq("campaign_id", campaign_id);

    const existingPhones = new Set(
      existingLeads?.map(l => normalizePhone(l.phone_number)) || []
    );

    // Parse leads
    const newLeads: ParsedLead[] = [];
    const skippedDuplicates: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const phone = values[phoneIdx]?.trim();
      
      if (!phone) continue;

      const normalizedPhone = normalizePhone(phone);
      
      // Skip duplicates
      if (existingPhones.has(normalizedPhone)) {
        skippedDuplicates.push(phone);
        continue;
      }

      // Add to existing set to prevent duplicates within same import
      existingPhones.add(normalizedPhone);

      const lead: ParsedLead = {
        name: nameIdx >= 0 ? values[nameIdx]?.trim() || "Unknown" : "Unknown",
        phone_number: phone,
        email: emailIdx >= 0 ? values[emailIdx]?.trim() || undefined : undefined,
      };

      // Collect additional fields
      const customFields: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (idx !== nameIdx && idx !== phoneIdx && idx !== emailIdx && values[idx]?.trim()) {
          customFields[header] = values[idx].trim();
        }
      });
      
      if (Object.keys(customFields).length > 0) {
        lead.custom_fields = customFields;
      }

      newLeads.push(lead);
    }

    if (newLeads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "No new leads to import",
          imported: 0,
          skipped_duplicates: skippedDuplicates.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert new leads
    const leadsToInsert = newLeads.map(lead => ({
      campaign_id,
      client_id: userId,
      name: lead.name,
      phone_number: lead.phone_number,
      email: lead.email || null,
      custom_fields: lead.custom_fields || null,
      stage: "new",
    }));

    const { error: insertError } = await supabase
      .from("campaign_leads")
      .insert(leadsToInsert);

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: `Failed to insert leads: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update campaign total_leads count
    await supabase
      .from("campaigns")
      .update({ 
        total_leads: (campaign.total_leads || 0) + newLeads.length,
        updated_at: new Date().toISOString()
      })
      .eq("id", campaign_id);

    // Store the sheet URL if provided for future syncs
    if (sheet_url && !campaign.google_sheet_id) {
      const match = sheet_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        await supabase
          .from("campaigns")
          .update({ google_sheet_id: match[1] })
          .eq("id", campaign_id);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        imported: newLeads.length,
        skipped_duplicates: skippedDuplicates.length,
        sample_leads: newLeads.slice(0, 3).map(l => ({ name: l.name, phone: l.phone_number }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Normalize phone numbers for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "").slice(-10);
}
