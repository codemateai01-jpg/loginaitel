import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EvaluationResult {
  overall_score: number;
  greeting_score: number;
  clarity_score: number;
  engagement_score: number;
  objection_handling: number;
  closing_score: number;
  goal_achieved: boolean;
  notes: string;
  key_moments: string[];
  improvement_suggestions: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    const allowedRoles = ["admin", "engineer", "client"];
    if (!roleData?.role || !allowedRoles.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { callId, transcript, agentName, leadName, callDuration } = await req.json();

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: "Transcript is required for evaluation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert call quality analyst. Analyze the following call transcript and provide a detailed evaluation.

Evaluate the call on these criteria (score 1-10 for each):
1. **Greeting/Opening (greeting_score)**: How well did the agent introduce themselves? Was the tone professional and friendly?
2. **Clarity & Communication (clarity_score)**: Was the agent clear, articulate, and easy to understand?
3. **Engagement (engagement_score)**: Did the agent maintain the lead's interest? Were questions asked to understand needs?
4. **Objection Handling (objection_handling)**: How well were concerns, objections, or hesitations addressed?
5. **Closing (closing_score)**: Was there a clear call-to-action? Was the next step communicated effectively?

Also determine:
- **goal_achieved**: Based on the conversation, did the call achieve its apparent goal? (true/false)
- **key_moments**: List 2-4 important moments from the call
- **improvement_suggestions**: Provide 2-4 specific, actionable suggestions for improvement

Calculate overall_score as a percentage (0-100) based on the weighted average of individual scores.`;

    const userPrompt = `Analyze this call transcript:

Agent: ${agentName || "AI Agent"}
Lead: ${leadName || "Unknown"}
Duration: ${callDuration ? `${Math.round(callDuration / 60)} minutes` : "Unknown"}

TRANSCRIPT:
${transcript}

Respond with a JSON object containing your evaluation. Use this exact structure:
{
  "overall_score": <number 0-100>,
  "greeting_score": <number 1-10>,
  "clarity_score": <number 1-10>,
  "engagement_score": <number 1-10>,
  "objection_handling": <number 1-10>,
  "closing_score": <number 1-10>,
  "goal_achieved": <boolean>,
  "notes": "<2-3 sentence summary of call quality>",
  "key_moments": ["<moment 1>", "<moment 2>", ...],
  "improvement_suggestions": ["<suggestion 1>", "<suggestion 2>", ...]
}`;

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_call_evaluation",
              description: "Submit the call evaluation results",
              parameters: {
                type: "object",
                properties: {
                  overall_score: { type: "number", description: "Overall score 0-100" },
                  greeting_score: { type: "number", description: "Greeting quality 1-10" },
                  clarity_score: { type: "number", description: "Clarity and communication 1-10" },
                  engagement_score: { type: "number", description: "Engagement level 1-10" },
                  objection_handling: { type: "number", description: "Objection handling 1-10" },
                  closing_score: { type: "number", description: "Closing effectiveness 1-10" },
                  goal_achieved: { type: "boolean", description: "Whether call goal was achieved" },
                  notes: { type: "string", description: "Summary of call quality" },
                  key_moments: { type: "array", items: { type: "string" }, description: "Key moments from the call" },
                  improvement_suggestions: { type: "array", items: { type: "string" }, description: "Improvement suggestions" },
                },
                required: ["overall_score", "greeting_score", "clarity_score", "engagement_score", "objection_handling", "closing_score", "goal_achieved", "notes", "key_moments", "improvement_suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_call_evaluation" } },
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("Lovable AI error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    
    // Extract evaluation from tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", aiData);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI evaluation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evaluation: EvaluationResult = JSON.parse(toolCall.function.arguments);

    // Validate and clamp scores
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    evaluation.overall_score = clamp(Math.round(evaluation.overall_score), 0, 100);
    evaluation.greeting_score = clamp(Math.round(evaluation.greeting_score), 1, 10);
    evaluation.clarity_score = clamp(Math.round(evaluation.clarity_score), 1, 10);
    evaluation.engagement_score = clamp(Math.round(evaluation.engagement_score), 1, 10);
    evaluation.objection_handling = clamp(Math.round(evaluation.objection_handling), 1, 10);
    evaluation.closing_score = clamp(Math.round(evaluation.closing_score), 1, 10);

    // Update call with AI evaluation if callId provided
    if (callId) {
      const { data: existingCall } = await supabase
        .from("calls")
        .select("metadata")
        .eq("id", callId)
        .single();

      const currentMetadata = (existingCall?.metadata as Record<string, unknown>) || {};
      
      await supabase
        .from("calls")
        .update({
          metadata: {
            ...currentMetadata,
            evaluation: {
              ...evaluation,
              ai_generated: true,
              evaluated_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", callId);
    }

    return new Response(
      JSON.stringify({ evaluation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Evaluate call error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
