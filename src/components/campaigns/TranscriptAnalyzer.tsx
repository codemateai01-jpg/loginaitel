import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, TrendingUp, MessageSquare, Target, ThumbsUp, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface TranscriptAnalyzerProps {
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
  topInterests: Array<{ topic: string; count: number; percentage: number }>;
  buyingSignals: Array<{ signal: string; count: number }>;
  commonQuestions: Array<{ question: string; count: number }>;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  keyPhrases: string[];
  recommendations: string[];
}

export function TranscriptAnalyzer({ campaignId, campaignName, leads }: TranscriptAnalyzerProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const exportToPDF = () => {
    if (!analysis) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(34, 139, 34);
    doc.text("Interested Leads Analysis Report", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Campaign: ${campaignName || campaignId}`, pageWidth / 2, 30, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 36, { align: "center" });
    
    let yPos = 50;
    
    // Top Interests
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Top Interests", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Topic", "Count", "Percentage"]],
      body: analysis.topInterests.map(i => [i.topic, i.count.toString(), `${i.percentage}%`]),
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Buying Signals
    doc.text("Buying Signals Detected", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Signal", "Count"]],
      body: analysis.buyingSignals.map(s => [s.signal, s.count.toString()]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Sentiment
    doc.text("Sentiment Breakdown", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Sentiment", "Percentage"]],
      body: [
        ["Positive", `${analysis.sentimentBreakdown.positive}%`],
        ["Neutral", `${analysis.sentimentBreakdown.neutral}%`],
        ["Negative", `${analysis.sentimentBreakdown.negative}%`],
      ],
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
    });
    
    // Recommendations on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.text("AI Recommendations", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Recommendation"]],
      body: analysis.recommendations.map(r => [r]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237] },
    });
    
    doc.save(`interested-leads-analysis-${campaignId}.pdf`);
  };

  // Fetch transcripts for leads with call_ids
  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ["interested-transcripts", campaignId],
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

  // Analyze transcripts using AI
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
              content: `Analyze these call transcripts from INTERESTED leads and extract insights. Return JSON only:

TRANSCRIPTS:
${transcriptTexts}

Return this exact JSON structure:
{
  "topInterests": [{"topic": "string", "count": number, "percentage": number}],
  "buyingSignals": [{"signal": "string", "count": number}],
  "commonQuestions": [{"question": "string", "count": number}],
  "sentimentBreakdown": {"positive": number, "neutral": number, "negative": number},
  "keyPhrases": ["phrase1", "phrase2"],
  "recommendations": ["recommendation1", "recommendation2"]
}

Focus on:
- What features/aspects interested them most
- Buying signals (urgency, budget mentions, decision timeline)
- Common questions they asked
- Sentiment analysis
- Key phrases that indicate interest
- Recommendations for follow-up`,
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

  return (
    <div className="border-2 border-green-500/30 bg-green-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-green-600" />
          <h3 className="font-bold">AI Transcript Analyzer</h3>
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
            className="gap-2"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analyze Interests
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
          No call transcripts available yet. Make some calls to analyze interests.
        </p>
      )}

      {hasTranscripts && !analysis && !analyzeMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          {transcripts.length} transcript(s) ready for analysis. Click "Analyze Interests" to discover what your interested leads care about.
        </p>
      )}

      {analysis && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top Interests */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              Top Interests
            </h4>
            {analysis.topInterests.slice(0, 5).map((interest, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{interest.topic}</span>
                  <span className="text-muted-foreground">{interest.percentage}%</span>
                </div>
                <Progress value={interest.percentage} className="h-2" />
              </div>
            ))}
          </div>

          {/* Buying Signals */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Buying Signals Detected
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.buyingSignals.slice(0, 6).map((signal, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {signal.signal}
                  <span className="text-xs text-muted-foreground">({signal.count})</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Common Questions */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-600" />
              Common Questions
            </h4>
            <ul className="space-y-2 text-sm">
              {analysis.commonQuestions.slice(0, 4).map((q, idx) => (
                <li key={idx} className="flex justify-between">
                  <span className="truncate">{q.question}</span>
                  <Badge variant="outline">{q.count}x</Badge>
                </li>
              ))}
            </ul>
          </div>

          {/* Sentiment Breakdown */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-600" />
              Sentiment Breakdown
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Positive</span>
                <span className="text-green-600">{analysis.sentimentBreakdown.positive}%</span>
              </div>
              <Progress value={analysis.sentimentBreakdown.positive} className="h-2 bg-muted [&>div]:bg-green-500" />
              <div className="flex justify-between text-sm">
                <span>Neutral</span>
                <span className="text-muted-foreground">{analysis.sentimentBreakdown.neutral}%</span>
              </div>
              <Progress value={analysis.sentimentBreakdown.neutral} className="h-2" />
            </div>
          </div>

          {/* Recommendations */}
          <div className="border-2 border-border bg-card p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Recommendations for Follow-up
            </h4>
            <ul className="grid gap-2 md:grid-cols-2">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-green-600">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
