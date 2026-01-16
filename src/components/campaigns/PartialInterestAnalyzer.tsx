import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, HelpCircle, Clock, Phone, MessageSquare, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PartialInterestAnalyzerProps {
  campaignId: string;
  campaignName?: string;
  leads: Array<{
    id: string;
    name: string;
    call_id: string | null;
    call_summary: string | null;
  }>;
}

interface AnalysisResult {
  hesitationReasons: Array<{ reason: string; count: number; percentage: number }>;
  followUpOpportunities: Array<{ opportunity: string; priority: "high" | "medium" | "low"; leadCount: number }>;
  bestTimeToCall: Array<{ timeSlot: string; successRate: number }>;
  engagementTriggers: Array<{ trigger: string; effectiveness: number }>;
  conversionPotential: { high: number; medium: number; low: number };
  personalizedApproaches: Array<{ segment: string; approach: string; expectedConversion: number }>;
  urgentFollowUps: string[];
}

export function PartialInterestAnalyzer({ campaignId, campaignName, leads }: PartialInterestAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ["partial-interest-transcripts", campaignId],
    enabled: leads.length > 0,
    queryFn: async () => {
      const callIds = leads.filter((l) => l.call_id).map((l) => l.call_id!);
      if (callIds.length === 0) return [];

      const { data, error } = await supabase
        .from("calls")
        .select("id, transcript, summary")
        .in("id", callIds);

      if (error) throw error;
      return data || [];
    },
  });

  const exportToPDF = () => {
    if (!analysis) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.setTextColor(234, 179, 8);
    doc.text("Partial Interest Analysis Report", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Campaign: ${campaignName || campaignId}`, pageWidth / 2, 30, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 36, { align: "center" });
    
    let yPos = 50;
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Hesitation Reasons", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Reason", "Count", "Percentage"]],
      body: analysis.hesitationReasons.map(h => [h.reason, h.count.toString(), `${h.percentage}%`]),
      theme: "striped",
      headStyles: { fillColor: [234, 179, 8] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    doc.text("Follow-Up Opportunities", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Opportunity", "Priority", "Lead Count"]],
      body: analysis.followUpOpportunities.map(f => [f.opportunity, f.priority.toUpperCase(), f.leadCount.toString()]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Personalized Approaches", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Segment", "Approach", "Expected Conversion"]],
      body: analysis.personalizedApproaches.map(p => [p.segment, p.approach, `${p.expectedConversion}%`]),
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
    });
    
    doc.save(`partial-interest-analysis-${campaignId}.pdf`);
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const transcriptTexts = transcripts
        ?.filter((t) => t.transcript || t.summary)
        .map((t) => t.transcript || t.summary)
        .join("\n\n---\n\n");

      if (!transcriptTexts) {
        throw new Error("No transcripts available for analysis");
      }

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Analyze these call transcripts from PARTIALLY INTERESTED leads and identify follow-up opportunities. Return JSON only:

TRANSCRIPTS:
${transcriptTexts}

Return this exact JSON structure:
{
  "hesitationReasons": [{"reason": "string", "count": number, "percentage": number}],
  "followUpOpportunities": [{"opportunity": "string", "priority": "high"|"medium"|"low", "leadCount": number}],
  "bestTimeToCall": [{"timeSlot": "string", "successRate": number}],
  "engagementTriggers": [{"trigger": "string", "effectiveness": number}],
  "conversionPotential": {"high": number, "medium": number, "low": number},
  "personalizedApproaches": [{"segment": "string", "approach": "string", "expectedConversion": number}],
  "urgentFollowUps": ["lead name or identifier needing immediate follow-up"]
}

Focus on:
- Why they hesitated (timing, price, need more info, decision maker)
- Follow-up opportunities (demos, trials, discounts, callbacks)
- What would convert them
- Urgency indicators
- Personalized approaches for different segments`,
            },
          ],
          type: "analyze",
        },
      });

      if (error) throw error;

      try {
        const jsonMatch = data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as AnalysisResult;
        }
        throw new Error("Invalid response format");
      } catch {
        throw new Error("Failed to parse analysis results");
      }
    },
    onSuccess: (data) => {
      setAnalysis(data);
    },
  });

  const hasTranscripts = transcripts && transcripts.length > 0;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-red-500 text-red-600 bg-red-500/10";
      case "medium": return "border-yellow-500 text-yellow-600 bg-yellow-500/10";
      case "low": return "border-green-500 text-green-600 bg-green-500/10";
      default: return "border-border";
    }
  };

  return (
    <div className="border-2 border-yellow-500/30 bg-yellow-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-yellow-600" />
          <h3 className="font-bold">AI Follow-Up Opportunity Analyzer</h3>
        </div>
        <div className="flex gap-2">
          {analysis && (
            <Button onClick={exportToPDF} size="sm" variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          )}
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={!hasTranscripts || analyzeMutation.isPending}
            size="sm"
            className="gap-2 bg-yellow-600 hover:bg-yellow-700"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Find Opportunities
              </>
            )}
          </Button>
        </div>
      </div>

      {transcriptsLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transcripts...
        </div>
      )}

      {!hasTranscripts && !transcriptsLoading && (
        <p className="text-sm text-muted-foreground">
          No call transcripts available yet. Make calls to analyze follow-up opportunities.
        </p>
      )}

      {hasTranscripts && !analysis && !analyzeMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          {transcripts.length} transcript(s) ready. Click "Find Opportunities" to discover how to convert these leads.
        </p>
      )}

      {analysis && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Hesitation Reasons */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-yellow-600" />
              Why They Hesitated
            </h4>
            {analysis.hesitationReasons.slice(0, 5).map((reason, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{reason.reason}</span>
                  <span className="text-yellow-600">{reason.percentage}%</span>
                </div>
                <Progress value={reason.percentage} className="h-2 bg-muted [&>div]:bg-yellow-500" />
              </div>
            ))}
          </div>

          {/* Follow-Up Opportunities */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Follow-Up Opportunities
            </h4>
            <div className="space-y-2">
              {analysis.followUpOpportunities.slice(0, 4).map((opp, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm">{opp.opportunity}</span>
                  <Badge className={getPriorityColor(opp.priority)}>
                    {opp.priority} ({opp.leadCount})
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Conversion Potential */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              Conversion Potential
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-green-600 font-medium">High Potential</span>
                <span>{analysis.conversionPotential.high} leads</span>
              </div>
              <Progress value={(analysis.conversionPotential.high / leads.length) * 100} className="h-2 bg-muted [&>div]:bg-green-500" />
              <div className="flex justify-between text-sm">
                <span className="text-yellow-600 font-medium">Medium Potential</span>
                <span>{analysis.conversionPotential.medium} leads</span>
              </div>
              <Progress value={(analysis.conversionPotential.medium / leads.length) * 100} className="h-2 bg-muted [&>div]:bg-yellow-500" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Low Potential</span>
                <span>{analysis.conversionPotential.low} leads</span>
              </div>
              <Progress value={(analysis.conversionPotential.low / leads.length) * 100} className="h-2" />
            </div>
          </div>

          {/* Engagement Triggers */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              What Would Convert Them
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.engagementTriggers.slice(0, 6).map((trigger, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {trigger.trigger}
                  <span className="text-xs text-primary">({trigger.effectiveness}%)</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Personalized Approaches */}
          <div className="border-2 border-primary/30 bg-primary/5 p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Personalized Follow-Up Approaches
            </h4>
            <div className="space-y-3">
              {analysis.personalizedApproaches.slice(0, 4).map((approach, idx) => (
                <div key={idx} className="border-l-4 border-primary pl-3">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium text-yellow-700">Segment: {approach.segment}</p>
                    <Badge variant="outline" className="text-green-600 border-green-500">
                      {approach.expectedConversion}% conversion
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{approach.approach}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Urgent Follow-Ups */}
          {analysis.urgentFollowUps.length > 0 && (
            <div className="border-2 border-red-500/30 bg-red-500/5 p-4 space-y-3 md:col-span-2">
              <h4 className="font-medium flex items-center gap-2 text-red-600">
                <Clock className="h-4 w-4" />
                Urgent: Follow Up Today!
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.urgentFollowUps.map((lead, idx) => (
                  <Badge key={idx} variant="destructive">{lead}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
