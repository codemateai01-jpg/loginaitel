import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CampaignObjections {
  campaignId: string;
  campaignName: string;
  date: string;
  objections: Array<{ objection: string; percentage: number }>;
}

interface TrendAnalysis {
  overallTrends: Array<{
    objection: string;
    trend: "increasing" | "decreasing" | "stable";
    change: number;
    campaigns: string[];
  }>;
  improvementAreas: string[];
  worseningAreas: string[];
  recommendations: string[];
  campaignComparison: Array<{
    campaignName: string;
    topObjection: string;
    successRate: number;
  }>;
}

export function ObjectionTrendsComparison() {
  const { user } = useAuth();
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);

  // Fetch all campaigns for this client
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ["client-campaigns-for-trends", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, created_at, not_interested_leads")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch not-interested leads for selected campaigns
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ["campaign-objection-trends", selectedCampaigns],
    enabled: selectedCampaigns.length >= 2,
    queryFn: async () => {
      const allData: CampaignObjections[] = [];

      for (const campaignId of selectedCampaigns) {
        const campaign = campaigns?.find((c) => c.id === campaignId);
        const { data: leads } = await supabase
          .from("campaign_leads")
          .select("call_id, call_summary")
          .eq("campaign_id", campaignId)
          .or("interest_level.eq.not_interested,stage.eq.not_interested,stage.eq.lost");

        const callIds = leads?.filter((l) => l.call_id).map((l) => l.call_id!) || [];
        
        if (callIds.length > 0) {
          const { data: calls } = await supabase
            .from("calls")
            .select("transcript, summary")
            .in("id", callIds);

          allData.push({
            campaignId,
            campaignName: campaign?.name || campaignId,
            date: campaign?.created_at || new Date().toISOString(),
            objections: [], // Will be filled by AI
          });
        }
      }

      return allData;
    },
  });

  const exportToPDF = () => {
    if (!analysis) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text("Objection Trends Report", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Campaigns Compared: ${selectedCampaigns.length}`, pageWidth / 2, 30, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 36, { align: "center" });
    
    let yPos = 50;
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Overall Trends", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Objection", "Trend", "Change"]],
      body: analysis.overallTrends.map(t => [
        t.objection, 
        t.trend.toUpperCase(), 
        `${t.change > 0 ? '+' : ''}${t.change}%`
      ]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    doc.text("Campaign Comparison", 14, yPos);
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Campaign", "Top Objection", "Success Rate"]],
      body: analysis.campaignComparison.map(c => [c.campaignName, c.topObjection, `${c.successRate}%`]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Recommendations", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Recommendation"]],
      body: analysis.recommendations.map(r => [r]),
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
    });
    
    doc.save(`objection-trends-comparison.pdf`);
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      // Fetch all transcripts for selected campaigns
      const transcriptsByCapmaign: Record<string, string[]> = {};
      
      for (const campaignId of selectedCampaigns) {
        const { data: leads } = await supabase
          .from("campaign_leads")
          .select("call_id")
          .eq("campaign_id", campaignId)
          .or("interest_level.eq.not_interested,stage.eq.not_interested,stage.eq.lost");

        const callIds = leads?.filter((l) => l.call_id).map((l) => l.call_id!) || [];
        
        if (callIds.length > 0) {
          const { data: calls } = await supabase
            .from("calls")
            .select("transcript, summary")
            .in("id", callIds);

          transcriptsByCapmaign[campaignId] = calls?.map((c) => c.transcript || c.summary || "").filter(Boolean) || [];
        }
      }

      const campaignData = selectedCampaigns.map((id) => {
        const campaign = campaigns?.find((c) => c.id === id);
        return {
          name: campaign?.name || id,
          date: campaign?.created_at || "",
          transcripts: transcriptsByCapmaign[id] || [],
        };
      });

      const { data, error } = await supabase.functions.invoke("agent-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Analyze objection patterns across these campaigns over time and identify trends. Return JSON only:

CAMPAIGNS DATA:
${JSON.stringify(campaignData, null, 2)}

Return this exact JSON structure:
{
  "overallTrends": [{"objection": "string", "trend": "increasing"|"decreasing"|"stable", "change": number, "campaigns": ["campaign names"]}],
  "improvementAreas": ["areas where objections decreased"],
  "worseningAreas": ["areas where objections increased"],
  "recommendations": ["actionable recommendations based on trends"],
  "campaignComparison": [{"campaignName": "string", "topObjection": "string", "successRate": number}]
}

Focus on:
- Which objections are increasing/decreasing over time
- What's getting better vs worse
- Specific recommendations to improve
- Compare success rates across campaigns`,
            },
          ],
          type: "analyze",
        },
      });

      if (error) throw error;

      try {
        const jsonMatch = data.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TrendAnalysis;
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

  const toggleCampaign = (campaignId: string) => {
    setSelectedCampaigns((prev) =>
      prev.includes(campaignId)
        ? prev.filter((id) => id !== campaignId)
        : [...prev, campaignId]
    );
    setAnalysis(null);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing": return <TrendingUp className="h-4 w-4 text-red-600" />;
      case "decreasing": return <TrendingDown className="h-4 w-4 text-green-600" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing": return "border-red-500 text-red-600 bg-red-500/10";
      case "decreasing": return "border-green-500 text-green-600 bg-green-500/10";
      default: return "border-border text-muted-foreground";
    }
  };

  return (
    <div className="border-2 border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Cross-Campaign Objection Trends</h3>
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
            disabled={selectedCampaigns.length < 2 || analyzeMutation.isPending}
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
                Compare Trends
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Campaign Selection */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Select at least 2 campaigns to compare objection patterns over time:
        </p>
        <div className="flex flex-wrap gap-2">
          {campaignsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            campaigns?.map((campaign) => (
              <Badge
                key={campaign.id}
                variant={selectedCampaigns.includes(campaign.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCampaign(campaign.id)}
              >
                {campaign.name}
                {campaign.not_interested_leads ? ` (${campaign.not_interested_leads})` : ""}
              </Badge>
            ))
          )}
        </div>
      </div>

      {selectedCampaigns.length < 2 && (
        <p className="text-sm text-muted-foreground italic">
          Select at least 2 campaigns to see trends
        </p>
      )}

      {analysis && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Overall Trends */}
          <div className="border-2 border-border bg-card p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Objection Trends Over Time
            </h4>
            <div className="grid gap-2 md:grid-cols-2">
              {analysis.overallTrends.map((trend, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(trend.trend)}
                    <span className="text-sm">{trend.objection}</span>
                  </div>
                  <Badge className={getTrendColor(trend.trend)}>
                    {trend.change > 0 ? "+" : ""}{trend.change}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Improvement Areas */}
          <div className="border-2 border-green-500/30 bg-green-500/5 p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-green-600">
              <TrendingDown className="h-4 w-4" />
              Getting Better
            </h4>
            <ul className="space-y-1">
              {analysis.improvementAreas.map((area, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-green-600">✓</span>
                  {area}
                </li>
              ))}
            </ul>
          </div>

          {/* Worsening Areas */}
          <div className="border-2 border-red-500/30 bg-red-500/5 p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2 text-red-600">
              <TrendingUp className="h-4 w-4" />
              Needs Attention
            </h4>
            <ul className="space-y-1">
              {analysis.worseningAreas.map((area, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-red-600">!</span>
                  {area}
                </li>
              ))}
            </ul>
          </div>

          {/* Campaign Comparison */}
          <div className="border-2 border-border bg-card p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium">Campaign Comparison</h4>
            <div className="space-y-2">
              {analysis.campaignComparison.map((campaign, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{campaign.campaignName}</p>
                    <p className="text-xs text-muted-foreground">Top objection: {campaign.topObjection}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600">{campaign.successRate}%</p>
                    <p className="text-xs text-muted-foreground">Success rate</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="border-2 border-primary/30 bg-primary/5 p-4 space-y-3 md:col-span-2">
            <h4 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Recommendations Based on Trends
            </h4>
            <ul className="grid gap-2 md:grid-cols-2">
              {analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm flex gap-2">
                  <span className="text-primary">•</span>
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
