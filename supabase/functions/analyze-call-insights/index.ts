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

interface AnalysisRequest {
  clientId?: string;
  campaignId?: string;
  agentId?: string;
  analysisType: "comprehensive" | "conversation_intelligence" | "questions" | "objections";
  dateRange?: { start: string; end: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");

    // Verify user
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    let userId: string;
    if (claimsError || !claimsData?.claims) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }

    // Check user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const allowedRoles = ["admin", "client"];
    if (!roleData?.role || !allowedRoles.includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { clientId, campaignId, agentId, analysisType, dateRange }: AnalysisRequest = await req.json();

    // Determine which client to analyze
    let targetClientId = clientId;
    if (roleData.role === "client") {
      targetClientId = userId;
    }

    console.log(`Analyzing calls - client: ${targetClientId}, campaign: ${campaignId}, agent: ${agentId}, type: ${analysisType}`);

    // Fetch calls with transcripts
    let query = supabase
      .from("calls")
      .select(`
        id,
        transcript,
        summary,
        sentiment,
        duration_seconds,
        connected,
        status,
        created_at,
        lead_id,
        agent_id
      `)
      .not("transcript", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (targetClientId) {
      query = query.eq("client_id", targetClientId);
    }

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    if (dateRange?.start) {
      query = query.gte("created_at", dateRange.start);
    }
    if (dateRange?.end) {
      query = query.lte("created_at", dateRange.end);
    }

    const { data: calls, error: callsError } = await query;

    if (callsError) {
      console.error("Error fetching calls:", callsError);
      throw callsError;
    }

    if (!calls || calls.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No calls with transcripts found for analysis",
          insights: null 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agent info
    const agentIds = [...new Set(calls.map(c => c.agent_id).filter(Boolean))];
    let agentsData: { id: string; agent_name: string }[] = [];
    if (agentIds.length > 0) {
      const { data: agents } = await supabase
        .from("aitel_agents")
        .select("id, agent_name")
        .in("id", agentIds);
      agentsData = agents || [];
    }
    const agentNameMap = new Map(agentsData.map(a => [a.id, a.agent_name]));

    // Fetch lead info for context
    const leadIds = [...new Set(calls.map(c => c.lead_id).filter(Boolean))];
    let leadsData: { id: string; interest_level: string | null; stage: string; campaign_id: string }[] = [];
    
    if (leadIds.length > 0) {
      let leadsQuery = supabase
        .from("campaign_leads")
        .select("id, interest_level, stage, campaign_id")
        .in("id", leadIds);
      
      // Filter by campaign if specified
      if (campaignId) {
        leadsQuery = leadsQuery.eq("campaign_id", campaignId);
      }
      
      const { data: leads } = await leadsQuery;
      leadsData = leads || [];
    }

    // If campaign filter is set, only include calls for leads in that campaign
    let filteredCalls = calls;
    if (campaignId) {
      const campaignLeadIds = new Set(leadsData.map(l => l.id));
      filteredCalls = calls.filter(c => campaignLeadIds.has(c.lead_id));
    }

    if (filteredCalls.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No calls found for the selected filters",
          insights: null 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build lead interest map
    const leadInterestMap = new Map(leadsData.map(l => [l.id, { interest: l.interest_level, stage: l.stage }]));

    // Categorize calls
    const interestedCalls = filteredCalls.filter(c => {
      const leadInfo = leadInterestMap.get(c.lead_id);
      return leadInfo?.interest === "interested" || leadInfo?.stage === "interested";
    });

    const notInterestedCalls = filteredCalls.filter(c => {
      const leadInfo = leadInterestMap.get(c.lead_id);
      return leadInfo?.interest === "not_interested" || leadInfo?.stage === "lost" || c.sentiment === "negative";
    });

    const partialCalls = filteredCalls.filter(c => {
      const leadInfo = leadInterestMap.get(c.lead_id);
      return leadInfo?.interest === "partially_interested" || leadInfo?.stage === "callback";
    });

    // Calculate basic metrics for Conversation Intelligence
    const durations = filteredCalls.map(c => c.duration_seconds || 0).filter(d => d > 0);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Prepare transcript samples for AI analysis
    const transcriptSamples = filteredCalls
      .slice(0, 50)
      .map(c => {
        const agentName = agentNameMap.get(c.agent_id) || "Unknown Agent";
        return `[Call ID: ${c.id.slice(0, 8)}, Agent: ${agentName}, Sentiment: ${c.sentiment || "unknown"}, Duration: ${c.duration_seconds || 0}s]\n${c.transcript || c.summary}`;
      })
      .join("\n\n---\n\n");

    // Build the comprehensive analysis prompt for Conversation Intelligence
    const systemPrompt = `You are an expert call center analyst specializing in conversation intelligence and agent performance. Analyze call transcripts to extract actionable insights about conversation dynamics. Always respond with valid JSON only, no markdown.`;

    const userPrompt = `Analyze these sales call transcripts and provide comprehensive CONVERSATION INTELLIGENCE insights.

CALL STATISTICS:
- Total Calls Analyzed: ${filteredCalls.length}
- Interested Leads: ${interestedCalls.length}
- Not Interested: ${notInterestedCalls.length}
- Partial Interest: ${partialCalls.length}
- Avg Duration: ${avgDuration}s
- Min Duration: ${minDuration}s
- Max Duration: ${maxDuration}s

ALL CALL TRANSCRIPTS:
${transcriptSamples}

Return this exact JSON structure:
{
  "conversationIntelligence": {
    "agentPerformance": {
      "overallScore": 85,
      "scoreBreakdown": [
        {"metric": "Talk Time Balance", "score": 80, "description": "Agent talked 60% vs customer 40%"},
        {"metric": "Response Latency", "score": 90, "description": "Average response time under 2 seconds"},
        {"metric": "Active Listening", "score": 85, "description": "Agent acknowledged customer points effectively"},
        {"metric": "Conversation Flow", "score": 82, "description": "Natural transitions between topics"}
      ],
      "overTalkingFlags": ["Instances where agent spoke too much without pausing"],
      "underTalkingFlags": ["Instances where agent was too brief or missed opportunities"],
      "latencyIssues": ["Moments of awkward silence or delayed responses"]
    },
    "talkTimeAnalysis": {
      "avgAgentTalkPercent": 55,
      "avgCustomerTalkPercent": 45,
      "optimalRatio": "Agent 40-50%, Customer 50-60%",
      "talkTimeInsights": ["Key observations about talk time distribution"]
    },
    "silenceAnalysis": {
      "avgSilenceDuration": "2.3 seconds",
      "awkwardSilences": ["Moments where silence hurt the call"],
      "strategicPauses": ["Moments where silence worked well"],
      "recommendations": ["How to handle silence better"]
    },
    "interruptionPatterns": {
      "agentInterruptions": 3,
      "customerInterruptions": 5,
      "interruptionImpact": ["How interruptions affected call outcomes"],
      "recommendations": ["Tips to reduce negative interruptions"]
    },
    "responseLatency": {
      "avgLatencySeconds": 1.8,
      "fastResponses": ["Topics agent handled quickly"],
      "slowResponses": ["Topics that caused hesitation"],
      "latencyByCallPhase": [
        {"phase": "Opening", "avgLatency": "1.2s"},
        {"phase": "Discovery", "avgLatency": "1.5s"},
        {"phase": "Objection Handling", "avgLatency": "2.5s"},
        {"phase": "Closing", "avgLatency": "1.8s"}
      ]
    },
    "dailyPerformance": [
      {"date": "Recent trends", "callCount": 10, "avgScore": 82, "avgDuration": "${avgDuration}s"}
    ]
  },
  "customerQuestions": {
    "mostAsked": [
      {"question": "Question text", "frequency": 45, "category": "Pricing/Features/Process/Support"}
    ],
    "criticalQuestions": ["Questions that lead to conversion if handled well"],
    "questionPatterns": ["Pattern insights about when/how customers ask questions"],
    "questionsByPhase": [
      {"phase": "Opening", "questions": ["Typical early questions"]},
      {"phase": "Middle", "questions": ["Questions during discovery"]},
      {"phase": "Closing", "questions": ["Final decision questions"]}
    ]
  },
  "objectionHandling": {
    "topObjections": [
      {"objection": "Objection text", "frequency": 30, "category": "Price/Trust/Timing/Competition"}
    ],
    "objectionCategories": [
      {"category": "Price", "count": 25, "handlingStrategy": "Strategy without specific rebuttals"}
    ],
    "objectionTiming": ["When in the call objections typically arise"],
    "resolutionPatterns": ["Patterns in how objections were resolved or not"]
  },
  "transcriptInsights": {
    "keyPhrases": {
      "positiveIndicators": ["Phrases that signal positive outcomes"],
      "negativeIndicators": ["Phrases that signal negative outcomes"],
      "engagementPeaks": ["Moments of high customer engagement"]
    },
    "sentimentFlow": {
      "openingMood": "Typical sentiment at call start",
      "turningPoints": ["Key moments where sentiment shifted"],
      "closingMood": "Typical sentiment at call end"
    },
    "topicAnalysis": {
      "mostDiscussed": ["Top topics by frequency"],
      "successfulTopics": ["Topics correlated with conversions"],
      "problematicTopics": ["Topics correlated with drop-offs"]
    },
    "callStructure": {
      "optimalFlow": ["Recommended call structure based on successful calls"],
      "dropoffPoints": ["Where calls typically fail"],
      "recoveryOpportunities": ["Moments where failed calls could have been saved"]
    }
  },
  "competitorMentions": {
    "competitorsIdentified": [
      {"name": "Competitor Name", "mentionCount": 5, "context": "How/why they were mentioned", "sentiment": "positive/negative/neutral"}
    ],
    "mentionTiming": ["When in calls competitors are typically mentioned"],
    "customerComparisons": ["What customers compare between us and competitors"],
    "competitiveAdvantages": ["Areas where we win against competitors based on calls"],
    "competitiveWeaknesses": ["Areas where competitors are preferred"],
    "winStrategies": ["Successful approaches when competitor is mentioned"],
    "lossPatterns": ["What happens when we lose to competitor"],
    "pricingComparisons": ["How pricing compares based on customer feedback"],
    "featureComparisons": ["Feature-by-feature comparisons mentioned"]
  },
  "performanceInsights": {
    "conversionPatterns": ["Patterns in successful conversions"],
    "failurePatterns": ["Patterns in failed calls"],
    "improvementAreas": ["Specific areas to improve"],
    "trainingRecommendations": ["Training suggestions for team"],
    "agentStrengths": ["What agents do well"],
    "agentWeaknesses": ["Areas where agents struggle"]
  },
  "aiRecommendations": {
    "immediate": ["Actions to take immediately based on conversation intelligence"],
    "shortTerm": ["Improvements for next week"],
    "longTerm": ["Strategic recommendations for ongoing improvement"]
  }
}

Focus on CONVERSATION DYNAMICS: talk time, silences, interruptions, response speed, and agent performance metrics. IMPORTANT: Identify ALL competitor mentions - look for company names, product names, or phrases like "other company", "alternative", "competition", "currently using", "compared to". Quote actual phrases from transcripts where helpful. Be direct and practical.`;

    // Call Lovable AI
    const aiResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 6000,
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
          JSON.stringify({ error: "Service credits exhausted. Please contact support." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", errorText);
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let insights;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError);
      console.error("Raw response:", responseText);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI analysis", raw: responseText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add metadata
    const result = {
      insights,
      metadata: {
        analyzedAt: new Date().toISOString(),
        totalCalls: filteredCalls.length,
        interestedCalls: interestedCalls.length,
        notInterestedCalls: notInterestedCalls.length,
        partialCalls: partialCalls.length,
        avgDuration,
        minDuration,
        maxDuration,
        dateRange: dateRange || null,
        clientId: targetClientId,
        campaignId: campaignId || null,
        agentId: agentId || null,
      }
    };

    console.log("Analysis complete:", result.metadata);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
