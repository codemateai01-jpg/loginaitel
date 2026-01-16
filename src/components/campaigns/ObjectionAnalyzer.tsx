import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, AlertTriangle, ShieldX, Lightbulb, TrendingDown, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ObjectionAnalyzerProps {
  campaignId: string;
  campaignName?: string;
  leads: Array<{
    id: string;
    name: string;
    call_id: string | null;
    call_summary: string | null;
  }>;
}

interface ObjectionAnalysis {
  topObjections: Array<{ objection: string; count: number; percentage: number }>;
  objectionCategories: Array<{ category: string; count: number; examples: string[] }>;
  commonRejectionPhrases: string[];
  callDropoffPoints: Array<{ point: string; count: number }>;
  rebuttals: Array<{ objection: string; suggestedRebuttal: string }>;
  improvementAreas: string[];
}

export function ObjectionAnalyzer({ campaignId, campaignName, leads }: ObjectionAnalyzerProps) {
  const [analysis, setAnalysis] = useState<ObjectionAnalysis | null>(null);

  const exportToPDF = () => {
    if (!analysis) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(220, 38, 38);
    doc.text("Objection Analysis Report", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Campaign: ${campaignName || campaignId}`, pageWidth / 2, 30, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 36, { align: "center" });
    
    let yPos = 50;
    
    // Top Objections
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Top Objections", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Objection", "Count", "Percentage"]],
      body: analysis.topObjections.map(o => [o.objection, o.count.toString(), `${o.percentage}%`]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Objection Categories
    doc.text("Objection Categories", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Category", "Count"]],
      body: analysis.objectionCategories.map(c => [c.category, c.count.toString()]),
      theme: "striped",
      headStyles: { fillColor: [249, 115, 22] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Common Rejection Phrases
    doc.text("Common Rejection Phrases", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Phrase"]],
      body: analysis.commonRejectionPhrases.map(p => [`"${p}"`]),
      theme: "striped",
      headStyles: { fillColor: [234, 179, 8] },
    });
    
    // Rebuttals on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Suggested Rebuttals", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Objection", "Suggested Rebuttal"]],
      body: analysis.rebuttals.map(r => [r.objection, r.suggestedRebuttal]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237] },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 120 } },
    });
    
    const yPos2 = (doc as any).lastAutoTable.finalY + 15;
    doc.text("Script Improvement Suggestions", 14, yPos2);
    autoTable(doc, {
      startY: yPos2 + 5,
      head: [["Improvement Area"]],
      body: analysis.improvementAreas.map(a => [a]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`objection-analysis-${campaignId}.pdf`);
  };

  // Fetch transcripts for leads with call_ids
  const { data: transcripts, isLoading: transcriptsLoading } = useQuery({
    queryKey: ["not-interested-transcripts", campaignId],
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

  // Analyze objections using AI
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
              content: `Analyze these call transcripts from NOT INTERESTED/REJECTED leads and extract objection patterns. Return JSON only:

TRANSCRIPTS:
${transcriptTexts}

Return this exact JSON structure:
{
  "topObjections": [{"objection": "string", "count": number, "percentage": number}],
  "objectionCategories": [{"category": "string", "count": number, "examples": ["example1"]}],
  "commonRejectionPhrases": ["phrase1", "phrase2"],
  "callDropoffPoints": [{"point": "string", "count": number}],
  "rebuttals": [{"objection": "string", "suggestedRebuttal": "string"}],
  "improvementAreas": ["area1", "area2"]
}

Focus on:
- Main objections (price, timing, need, trust, competition)
- Exact rejection phrases used
- Where in the call they lost interest
- Suggested rebuttals for each objection
- Script improvements to prevent objections`,
            },
          ],
          type: "analyze",
        },
      });

      if (error) throw error;

      try {
        const jsonMatch = data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as ObjectionAnalysis;
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
    <div className="border-2 border-red-500/30 bg-red-500/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h3 className="font-bold">AI Objection Analyzer</h3>
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
            variant="destructive"
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
                Analyze Objections
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
          No call transcripts available yet. Objections will be analyzed once calls are made.
        </p>
      )}

      {hasTranscripts && !analysis && !analyzeMutation.isPending && (
        <p className="text-sm text-muted-foreground">
          {transcripts.length} transcript(s) ready for analysis. Click "Analyze Objections" to understand why leads declined.
        </p>
      )}

      {analysis && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Top Objections */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-600" />
              Top Objections
            </h4>
            {analysis.topObjections.slice(0, 5).map((obj, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{obj.objection}</span>
                  <span className="text-red-600">{obj.percentage}%</span>
                </div>
                <Progress value={obj.percentage} className="h-2 bg-muted [&>div]:bg-red-500" />
              </div>
            ))}
          </div>

          {/* Objection Categories */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              Objection Categories
            </h4>
            <div className="space-y-2">
              {analysis.objectionCategories.slice(0, 4).map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <Badge variant="outline" className="border-red-500/50 text-red-600">
                    {cat.category}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{cat.count} occurrences</span>
                </div>
              ))}
            </div>
          </div>

          {/* Common Rejection Phrases */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Common Rejection Phrases
            </h4>
            <div className="space-y-2">
              {analysis.commonRejectionPhrases.slice(0, 5).map((phrase, idx) => (
                <p key={idx} className="text-sm italic text-muted-foreground">
                  "{phrase}"
                </p>
              ))}
            </div>
          </div>

          {/* Call Dropoff Points */}
          <div className="border-2 border-border bg-card p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Where Calls Go Wrong
            </h4>
            <ul className="space-y-2 text-sm">
              {analysis.callDropoffPoints.slice(0, 4).map((point, idx) => (
                <li key={idx} className="flex justify-between">
                  <span>{point.point}</span>
                  <Badge variant="destructive">{point.count}x</Badge>
                </li>
              ))}
            </ul>
          </div>

          {/* Suggested Rebuttals */}
          <div className="border-2 border-primary/30 bg-primary/5 p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              Suggested Rebuttals
            </h4>
            <div className="space-y-3">
              {analysis.rebuttals.slice(0, 4).map((reb, idx) => (
                <div key={idx} className="border-l-4 border-primary pl-3">
                  <p className="text-sm font-medium text-red-600">When they say: "{reb.objection}"</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-green-600 font-medium">Try:</span> {reb.suggestedRebuttal}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Improvement Areas */}
          <div className="border-2 border-border bg-card p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Script Improvement Suggestions
            </h4>
            <ul className="grid gap-2 md:grid-cols-2">
              {analysis.improvementAreas.map((area, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-primary">•</span>
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
