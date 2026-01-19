import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "@/contexts/AuthContext";
import {
  Brain,
  Sparkles,
  MessageSquare,
  Target,
  TrendingUp,
  AlertTriangle,
  Phone,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Users,
  HelpCircle,
  Shield,
  ArrowRight,
  History,
  Save,
  GitCompare,
  Trash2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Mic,
  MicOff,
  Activity,
  Timer,
  Volume2,
  VolumeX,
  BarChart3,
  Bot,
  Swords,
  Trophy,
  TrendingDown,
  DollarSign,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AICallInsightsProps {
  role: "admin" | "client";
}

interface ScoreBreakdown {
  metric: string;
  score: number;
  description: string;
}

interface CustomerQuestion {
  question: string;
  frequency: number;
  category: string;
}

interface Objection {
  objection: string;
  frequency: number;
  category: string;
}

interface ObjectionCategory {
  category: string;
  count: number;
  handlingStrategy: string;
}

interface LatencyByPhase {
  phase: string;
  avgLatency: string;
}

interface QuestionsByPhase {
  phase: string;
  questions: string[];
}

interface DailyPerformance {
  date: string;
  callCount: number;
  avgScore: number;
  avgDuration: string;
}

interface InsightsData {
  conversationIntelligence: {
    agentPerformance: {
      overallScore: number;
      scoreBreakdown: ScoreBreakdown[];
      overTalkingFlags: string[];
      underTalkingFlags: string[];
      latencyIssues: string[];
    };
    talkTimeAnalysis: {
      avgAgentTalkPercent: number;
      avgCustomerTalkPercent: number;
      optimalRatio: string;
      talkTimeInsights: string[];
    };
    silenceAnalysis: {
      avgSilenceDuration: string;
      awkwardSilences: string[];
      strategicPauses: string[];
      recommendations: string[];
    };
    interruptionPatterns: {
      agentInterruptions: number;
      customerInterruptions: number;
      interruptionImpact: string[];
      recommendations: string[];
    };
    responseLatency: {
      avgLatencySeconds: number;
      fastResponses: string[];
      slowResponses: string[];
      latencyByCallPhase: LatencyByPhase[];
    };
    dailyPerformance: DailyPerformance[];
  };
  customerQuestions: {
    mostAsked: CustomerQuestion[];
    criticalQuestions: string[];
    questionPatterns: string[];
    questionsByPhase: QuestionsByPhase[];
  };
  objectionHandling: {
    topObjections: Objection[];
    objectionCategories: ObjectionCategory[];
    objectionTiming: string[];
    resolutionPatterns: string[];
  };
  transcriptInsights: {
    keyPhrases: {
      positiveIndicators: string[];
      negativeIndicators: string[];
      engagementPeaks: string[];
    };
    sentimentFlow: {
      openingMood: string;
      turningPoints: string[];
      closingMood: string;
    };
    topicAnalysis: {
      mostDiscussed: string[];
      successfulTopics: string[];
      problematicTopics: string[];
    };
    callStructure: {
      optimalFlow: string[];
      dropoffPoints: string[];
      recoveryOpportunities: string[];
    };
  };
  competitorMentions?: {
    competitorsIdentified: {
      name: string;
      mentionCount: number;
      context: string;
      sentiment: string;
    }[];
    mentionTiming: string[];
    customerComparisons: string[];
    competitiveAdvantages: string[];
    competitiveWeaknesses: string[];
    winStrategies: string[];
    lossPatterns: string[];
    pricingComparisons: string[];
    featureComparisons: string[];
  };
  performanceInsights: {
    conversionPatterns: string[];
    failurePatterns: string[];
    improvementAreas: string[];
    trainingRecommendations: string[];
    agentStrengths: string[];
    agentWeaknesses: string[];
  };
  aiRecommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

interface AnalysisResult {
  insights: InsightsData;
  metadata: {
    analyzedAt: string;
    totalCalls: number;
    interestedCalls: number;
    notInterestedCalls: number;
    partialCalls: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    clientId?: string;
    campaignId?: string;
    agentId?: string;
  };
}

interface SavedInsight {
  id: string;
  client_id: string;
  campaign_id: string | null;
  insights: InsightsData;
  metadata: AnalysisResult["metadata"];
  total_calls: number;
  interested_calls: number;
  not_interested_calls: number;
  partial_calls: number;
  conversion_rate: number | null;
  created_at: string;
  notes: string | null;
}

export default function AICallInsights({ role }: AICallInsightsProps) {
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<SavedInsight[]>([]);
  const [saveNotes, setSaveNotes] = useState("");

  // Fetch clients for admin
  const { data: clients } = useQuery({
    queryKey: ["clients-for-insights"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      if (error) throw error;
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", data.map(d => d.user_id));
      
      return profiles || [];
    },
  });

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["agents-for-insights", selectedClient],
    queryFn: async () => {
      let query = supabase.from("aitel_agents").select("id, agent_name, client_id");
      
      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      } else if (selectedClient && selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-insights", selectedClient],
    queryFn: async () => {
      let query = supabase.from("campaigns").select("id, name, client_id, status, total_leads, interested_leads, created_at");
      
      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      } else if (selectedClient && selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Analysis mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze-call-insights", {
        body: {
          clientId: role === "admin" && selectedClient !== "all" ? selectedClient : undefined,
          campaignId: selectedCampaign !== "all" ? selectedCampaign : undefined,
          agentId: selectedAgent !== "all" ? selectedAgent : undefined,
          analysisType: "comprehensive",
        },
      });

      if (error) throw error;
      if (data.error && !data.insights) throw new Error(data.error);
      return data as AnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast.success("AI Analysis Complete!", {
        description: `Analyzed ${data.metadata.totalCalls} calls successfully`,
      });
    },
    onError: (error) => {
      console.error("Analysis error:", error);
      toast.error("Analysis Failed", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    },
  });

  // Fetch saved insights history
  const { data: insightsHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["insights-history", selectedClient, selectedCampaign],
    queryFn: async () => {
      let query = supabase
        .from("ai_insights_history" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      } else if (selectedClient && selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }

      if (selectedCampaign && selectedCampaign !== "all") {
        query = query.eq("campaign_id", selectedCampaign);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return (data || []) as unknown as SavedInsight[];
    },
  });

  // Save insights mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysis || !user) throw new Error("No analysis to save");
      
      const clientId = role === "admin" && selectedClient && selectedClient !== "all" ? selectedClient : user.id;
      const conversionRate = analysis.metadata.totalCalls > 0 
        ? (analysis.metadata.interestedCalls / analysis.metadata.totalCalls) * 100 
        : 0;

      const { error } = await supabase.from("ai_insights_history" as any).insert({
        client_id: clientId,
        campaign_id: selectedCampaign !== "all" ? selectedCampaign : null,
        insights: analysis.insights,
        metadata: analysis.metadata,
        total_calls: analysis.metadata.totalCalls,
        interested_calls: analysis.metadata.interestedCalls,
        not_interested_calls: analysis.metadata.notInterestedCalls,
        partial_calls: analysis.metadata.partialCalls,
        conversion_rate: conversionRate,
        notes: saveNotes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Insights Saved!", {
        description: "Your analysis has been saved for future comparison",
      });
      setSaveNotes("");
      refetchHistory();
    },
    onError: (error) => {
      toast.error("Failed to save", {
        description: error instanceof Error ? error.message : "Please try again",
      });
    },
  });

  // Delete insight mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_insights_history" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Insight deleted");
      refetchHistory();
      setSelectedForCompare([]);
    },
    onError: () => {
      toast.error("Failed to delete insight");
    },
  });

  // Load a saved insight
  const loadSavedInsight = (saved: SavedInsight) => {
    setAnalysis({
      insights: saved.insights,
      metadata: saved.metadata,
    });
    setShowHistory(false);
    toast.success("Loaded saved insight", {
      description: `From ${format(new Date(saved.created_at), "MMM d, yyyy 'at' h:mm a")}`,
    });
  };

  // Toggle selection for comparison
  const toggleCompareSelection = (saved: SavedInsight) => {
    setSelectedForCompare(prev => {
      const exists = prev.find(s => s.id === saved.id);
      if (exists) {
        return prev.filter(s => s.id !== saved.id);
      }
      if (prev.length >= 2) {
        return [prev[1], saved];
      }
      return [...prev, saved];
    });
  };

  // Calculate comparison metrics
  const getComparisonData = () => {
    if (selectedForCompare.length !== 2) return null;
    const [older, newer] = selectedForCompare.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    const conversionChange = (newer.conversion_rate || 0) - (older.conversion_rate || 0);
    const callsChange = newer.total_calls - older.total_calls;
    const interestedChange = newer.interested_calls - older.interested_calls;

    return { older, newer, conversionChange, callsChange, interestedChange };
  };

  const exportToPDF = () => {
    if (!analysis) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text("Conversation Intelligence Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: "center" });
    doc.text(`Total Calls Analyzed: ${analysis.metadata.totalCalls}`, pageWidth / 2, 34, { align: "center" });

    let yPos = 45;

    // Agent Performance Section
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Agent Performance Metrics", 14, yPos);

    const perfData = analysis.insights.conversationIntelligence?.agentPerformance;
    if (perfData?.scoreBreakdown?.length) {
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Metric", "Score", "Details"]],
        body: perfData.scoreBreakdown.map(s => [
          s.metric,
          `${s.score}/100`,
          s.description.substring(0, 60) + (s.description.length > 60 ? "..." : ""),
        ]),
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Customer Questions
    doc.addPage();
    yPos = 20;
    doc.text("Most Asked Customer Questions", 14, yPos);

    if (analysis.insights.customerQuestions?.mostAsked?.length) {
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Question", "Frequency", "Category"]],
        body: analysis.insights.customerQuestions.mostAsked.slice(0, 10).map(q => [
          q.question,
          q.frequency.toString(),
          q.category,
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Objections
    doc.addPage();
    yPos = 20;
    doc.text("Top Objections", 14, yPos);

    if (analysis.insights.objectionHandling?.topObjections?.length) {
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Objection", "Frequency", "Category"]],
        body: analysis.insights.objectionHandling.topObjections.slice(0, 10).map(o => [
          o.objection,
          o.frequency.toString(),
          o.category,
        ]),
        theme: "striped",
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 8 },
      });
    }

    // AI Recommendations
    doc.addPage();
    yPos = 20;
    doc.text("AI Recommendations", 14, yPos);

    const allRecs = [
      ...(analysis.insights.aiRecommendations?.immediate || []).map(r => ["Immediate", r]),
      ...(analysis.insights.aiRecommendations?.shortTerm || []).map(r => ["Short-term", r]),
      ...(analysis.insights.aiRecommendations?.longTerm || []).map(r => ["Long-term", r]),
    ];

    if (allRecs.length) {
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Priority", "Recommendation"]],
        body: allRecs,
        theme: "striped",
        headStyles: { fillColor: [34, 197, 94] },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`conversation-intelligence-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF exported successfully!");
  };

  // Quick campaign selection
  const selectCampaign = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    toast.info("Campaign selected", { description: "Click 'Run AI Analysis' to analyze this campaign" });
  };

  const ins = analysis?.insights;

  // Helper to safely get arrays from AI response
  const safeArray = <T,>(arr: T[] | undefined | null): T[] => arr ?? [];

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Conversation Intelligence
            </h1>
            <p className="text-muted-foreground">
              AI-powered analysis of agent performance, talk time, and call dynamics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* History Button */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                  {insightsHistory && insightsHistory.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{insightsHistory.length}</Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Saved Insights History
                  </DialogTitle>
                  <DialogDescription>
                    View, load, and compare past AI analyses to track improvements
                  </DialogDescription>
                </DialogHeader>
                
                {/* Compare Mode Toggle */}
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={compareMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setCompareMode(!compareMode);
                        setSelectedForCompare([]);
                      }}
                      className="gap-2"
                    >
                      <GitCompare className="h-4 w-4" />
                      {compareMode ? "Exit Compare" : "Compare Mode"}
                    </Button>
                    {compareMode && (
                      <span className="text-sm text-muted-foreground">
                        Select 2 insights to compare ({selectedForCompare.length}/2)
                      </span>
                    )}
                  </div>
                </div>

                {/* Comparison View */}
                {compareMode && selectedForCompare.length === 2 && getComparisonData() && (
                  <Card className="bg-muted/30 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GitCompare className="h-5 w-5 text-primary" />
                        Performance Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const data = getComparisonData()!;
                        return (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-xs text-muted-foreground">Period</p>
                              <p className="text-sm font-medium">
                                {format(new Date(data.older.created_at), "MMM d")} → {format(new Date(data.newer.created_at), "MMM d")}
                              </p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-xs text-muted-foreground">Conversion Rate</p>
                              <div className="flex items-center justify-center gap-1">
                                {data.conversionChange > 0 ? (
                                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                                ) : data.conversionChange < 0 ? (
                                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className={`font-bold ${data.conversionChange > 0 ? 'text-green-600' : data.conversionChange < 0 ? 'text-red-600' : ''}`}>
                                  {data.conversionChange > 0 ? '+' : ''}{data.conversionChange.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-xs text-muted-foreground">Total Calls</p>
                              <div className="flex items-center justify-center gap-1">
                                {data.callsChange > 0 ? (
                                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                                ) : data.callsChange < 0 ? (
                                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-bold">
                                  {data.callsChange > 0 ? '+' : ''}{data.callsChange}
                                </span>
                              </div>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-background">
                              <p className="text-xs text-muted-foreground">Interested Leads</p>
                              <div className="flex items-center justify-center gap-1">
                                {data.interestedChange > 0 ? (
                                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                                ) : data.interestedChange < 0 ? (
                                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Minus className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className={`font-bold ${data.interestedChange > 0 ? 'text-green-600' : data.interestedChange < 0 ? 'text-red-600' : ''}`}>
                                  {data.interestedChange > 0 ? '+' : ''}{data.interestedChange}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* History List */}
                <ScrollArea className="flex-1 pr-4">
                  {!insightsHistory || insightsHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No saved insights yet</p>
                      <p className="text-sm">Run an analysis and save it to start tracking</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {insightsHistory.map((saved) => (
                        <Card 
                          key={saved.id} 
                          className={`cursor-pointer transition-all ${
                            compareMode && selectedForCompare.find(s => s.id === saved.id) 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => compareMode ? toggleCompareSelection(saved) : undefined}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {format(new Date(saved.created_at), "MMM d, yyyy 'at' h:mm a")}
                                  </span>
                                  {compareMode && selectedForCompare.find(s => s.id === saved.id) && (
                                    <Badge variant="default" className="text-xs">
                                      #{selectedForCompare.findIndex(s => s.id === saved.id) + 1}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <Badge variant="outline">{saved.total_calls} calls</Badge>
                                  <Badge variant="secondary" className="bg-green-500/10 text-green-700">
                                    {saved.interested_calls} interested
                                  </Badge>
                                  <Badge variant="secondary">
                                    {saved.conversion_rate?.toFixed(1) || 0}% conversion
                                  </Badge>
                                </div>
                                {saved.notes && (
                                  <p className="text-sm text-muted-foreground truncate">{saved.notes}</p>
                                )}
                              </div>
                              {!compareMode && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadSavedInsight(saved);
                                    }}
                                  >
                                    Load
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this insight?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This action cannot be undone. This will permanently delete the saved analysis.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteMutation.mutate(saved.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>

            {/* Save Button */}
            {analysis && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Save className="h-4 w-4" />
                    <span className="hidden sm:inline">Save</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Analysis</DialogTitle>
                    <DialogDescription>
                      Save this analysis to track changes over time and compare with future results.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-muted-foreground">Total Calls</p>
                        <p className="text-lg font-bold">{analysis.metadata.totalCalls}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted">
                        <p className="text-muted-foreground">Conversion Rate</p>
                        <p className="text-lg font-bold">
                          {analysis.metadata.totalCalls > 0 
                            ? ((analysis.metadata.interestedCalls / analysis.metadata.totalCalls) * 100).toFixed(1)
                            : 0}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
                      <textarea
                        className="w-full p-3 border rounded-lg text-sm resize-none bg-background"
                        rows={3}
                        placeholder="Add notes about this analysis..."
                        value={saveNotes}
                        onChange={(e) => setSaveNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                      className="gap-2"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Analysis
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {analysis && (
              <Button variant="outline" onClick={exportToPDF} className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export PDF</span>
              </Button>
            )}
            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
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
                  Run AI Analysis
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              {role === "admin" && (
                <div className="w-56">
                  <label className="text-sm font-medium mb-2 block">Client</label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients?.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>
                          {c.full_name || c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="w-56">
                <label className="text-sm font-medium mb-2 block">Agent</label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="All agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          {a.agent_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-56">
                <label className="text-sm font-medium mb-2 block">Campaign</label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="All campaigns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campaigns?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Campaigns Quick Select */}
        {campaigns && campaigns.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Recent Campaigns
              </CardTitle>
              <CardDescription>Click to quickly analyze a campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {campaigns.slice(0, 6).map((campaign) => (
                  <Button
                    key={campaign.id}
                    variant={selectedCampaign === campaign.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectCampaign(campaign.id)}
                    className="gap-2"
                  >
                    <span>{campaign.name}</span>
                    {campaign.total_leads && (
                      <Badge variant="secondary" className="text-xs">
                        {campaign.total_leads} leads
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        {analysis && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Calls</p>
                    <p className="text-2xl font-bold">{analysis.metadata.totalCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Interested</p>
                    <p className="text-2xl font-bold text-green-600">{analysis.metadata.interestedCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Not Interested</p>
                    <p className="text-2xl font-bold text-red-600">{analysis.metadata.notInterestedCalls}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">{analysis.metadata.avgDuration}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Conversion</p>
                    <p className="text-2xl font-bold">
                      {analysis.metadata.totalCalls > 0 
                        ? ((analysis.metadata.interestedCalls / analysis.metadata.totalCalls) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analysis Empty State */}
        {!analysis && !analyzeMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Select your filters and click "Run AI Analysis" to get comprehensive conversation intelligence insights
              </p>
              <Button onClick={() => analyzeMutation.mutate()} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Start Analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Analysis Loading */}
        {analyzeMutation.isPending && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              <h3 className="text-lg font-semibold mb-2">Analyzing Conversations...</h3>
              <p className="text-muted-foreground">
                AI is processing call transcripts and extracting insights
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Analysis Tabs */}
        {analysis && (
          <Tabs defaultValue="intelligence" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
              <TabsTrigger value="intelligence" className="gap-2">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Intelligence</span>
              </TabsTrigger>
              <TabsTrigger value="competitors" className="gap-2">
                <Swords className="h-4 w-4" />
                <span className="hidden sm:inline">Competitors</span>
              </TabsTrigger>
              <TabsTrigger value="questions" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Questions</span>
              </TabsTrigger>
              <TabsTrigger value="objections" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Objections</span>
              </TabsTrigger>
              <TabsTrigger value="transcripts" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Transcripts</span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-2">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Actions</span>
              </TabsTrigger>
            </TabsList>

            {/* Conversation Intelligence Tab */}
            <TabsContent value="intelligence" className="space-y-4">
              {/* Agent Performance Score */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Agent Performance Score
                  </CardTitle>
                  <CardDescription>Overall conversation quality assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="pr-4">
                      <div className="flex items-center gap-6 mb-6">
                        <div className="text-center">
                          <div className={`text-5xl font-bold ${getScoreColor(ins?.conversationIntelligence?.agentPerformance?.overallScore || 0)}`}>
                            {ins?.conversationIntelligence?.agentPerformance?.overallScore || 0}
                          </div>
                          <p className="text-sm text-muted-foreground">Overall Score</p>
                        </div>
                        <div className="flex-1">
                          <Progress 
                            value={ins?.conversationIntelligence?.agentPerformance?.overallScore || 0} 
                            className="h-4"
                          />
                        </div>
                      </div>
                      
                      <div className="grid gap-3 md:grid-cols-2">
                        {safeArray(ins?.conversationIntelligence?.agentPerformance?.scoreBreakdown).map((item, idx) => (
                          <div key={idx} className="p-4 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{item.metric}</span>
                              <span className={`font-bold ${getScoreColor(item.score)}`}>{item.score}/100</span>
                            </div>
                            <Progress value={item.score} className="h-2 mb-2" />
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Talk Time Analysis */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mic className="h-5 w-5 text-blue-600" />
                      Talk Time Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[280px]">
                      <div className="pr-4 space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Agent Talk Time</span>
                            <span className="font-medium">{ins?.conversationIntelligence?.talkTimeAnalysis?.avgAgentTalkPercent || 0}%</span>
                          </div>
                          <Progress value={ins?.conversationIntelligence?.talkTimeAnalysis?.avgAgentTalkPercent || 0} className="h-3" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Customer Talk Time</span>
                            <span className="font-medium">{ins?.conversationIntelligence?.talkTimeAnalysis?.avgCustomerTalkPercent || 0}%</span>
                          </div>
                          <Progress value={ins?.conversationIntelligence?.talkTimeAnalysis?.avgCustomerTalkPercent || 0} className="h-3 [&>div]:bg-green-500" />
                        </div>
                        <Separator />
                        <p className="text-sm text-muted-foreground">
                          <strong>Optimal Ratio:</strong> {ins?.conversationIntelligence?.talkTimeAnalysis?.optimalRatio || "N/A"}
                        </p>
                        <ul className="space-y-1">
                          {safeArray(ins?.conversationIntelligence?.talkTimeAnalysis?.talkTimeInsights).map((insight, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <TrendingUp className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="h-5 w-5 text-yellow-600" />
                      Response Latency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[280px]">
                      <div className="pr-4">
                        <div className="text-center mb-4">
                          <div className="text-4xl font-bold text-primary">
                            {ins?.conversationIntelligence?.responseLatency?.avgLatencySeconds || 0}s
                          </div>
                          <p className="text-sm text-muted-foreground">Average Response Time</p>
                        </div>
                        <div className="space-y-2">
                          {safeArray(ins?.conversationIntelligence?.responseLatency?.latencyByCallPhase).map((phase, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                              <span className="text-sm">{phase.phase}</span>
                              <Badge variant="outline">{phase.avgLatency}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Silence & Interruptions */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <VolumeX className="h-5 w-5 text-gray-600" />
                      Silence Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[280px]">
                      <div className="pr-4">
                        <p className="text-lg font-semibold mb-3">
                          Avg Silence: {ins?.conversationIntelligence?.silenceAnalysis?.avgSilenceDuration || "N/A"}
                        </p>
                        <div className="space-y-3">
                          <div>
                            <h4 className="text-sm font-medium text-red-600 mb-1">Awkward Silences</h4>
                            <ul className="space-y-1">
                              {safeArray(ins?.conversationIntelligence?.silenceAnalysis?.awkwardSilences).map((s, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground">• {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-green-600 mb-1">Strategic Pauses</h4>
                            <ul className="space-y-1">
                              {safeArray(ins?.conversationIntelligence?.silenceAnalysis?.strategicPauses).map((s, idx) => (
                                <li key={idx} className="text-sm text-muted-foreground">• {s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-orange-600" />
                      Interruption Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[280px]">
                      <div className="pr-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">{ins?.conversationIntelligence?.interruptionPatterns?.agentInterruptions || 0}</p>
                            <p className="text-xs text-muted-foreground">Agent Interruptions</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">{ins?.conversationIntelligence?.interruptionPatterns?.customerInterruptions || 0}</p>
                            <p className="text-xs text-muted-foreground">Customer Interruptions</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {safeArray(ins?.conversationIntelligence?.interruptionPatterns?.interruptionImpact).map((impact, idx) => (
                            <p key={idx} className="text-sm text-muted-foreground">• {impact}</p>
                          ))}
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Flags */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-red-200 dark:border-red-900/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Volume2 className="h-5 w-5" />
                      Over-Talking Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.conversationIntelligence?.agentPerformance?.overTalkingFlags).map((flag, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-500/10 rounded">
                            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 dark:border-yellow-900/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-600">
                      <MicOff className="h-5 w-5" />
                      Under-Talking Flags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.conversationIntelligence?.agentPerformance?.underTalkingFlags).map((flag, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-yellow-500/10 rounded">
                            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Competitor Mentions Tab */}
            <TabsContent value="competitors" className="space-y-4">
              {/* Identified Competitors */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    Competitors Identified
                  </CardTitle>
                  <CardDescription>Competitors mentioned in calls with frequency and context</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3 pr-4">
                      {safeArray(ins?.competitorMentions?.competitorsIdentified).length > 0 ? (
                        safeArray(ins?.competitorMentions?.competitorsIdentified).map((comp, idx) => (
                          <div key={idx} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{comp.name}</span>
                                <Badge variant={
                                  comp.sentiment === "positive" ? "default" :
                                  comp.sentiment === "negative" ? "destructive" : "secondary"
                                }>
                                  {comp.sentiment}
                                </Badge>
                              </div>
                              <Badge variant="outline" className="text-lg">
                                {comp.mentionCount} mentions
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{comp.context}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Swords className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>No competitor mentions detected</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Win/Loss Analysis */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-green-200 dark:border-green-900/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <Trophy className="h-5 w-5" />
                      Win Strategies
                    </CardTitle>
                    <CardDescription>Successful approaches against competitors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.winStrategies).map((strategy, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-green-500/10 rounded">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{strategy}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.winStrategies).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No win strategies identified yet</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-900/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <TrendingDown className="h-5 w-5" />
                      Loss Patterns
                    </CardTitle>
                    <CardDescription>When we lose to competitors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.lossPatterns).map((pattern, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-500/10 rounded">
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{pattern}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.lossPatterns).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No loss patterns identified yet</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Competitive Advantages/Weaknesses */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      Our Competitive Advantages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.competitiveAdvantages).map((adv, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{adv}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.competitiveAdvantages).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No advantages identified yet</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-5 w-5" />
                      Our Competitive Weaknesses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.competitiveWeaknesses).map((weak, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{weak}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.competitiveWeaknesses).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No weaknesses identified yet</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Comparisons */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-yellow-600" />
                      Pricing Comparisons
                    </CardTitle>
                    <CardDescription>How pricing compares based on customer feedback</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.pricingComparisons).map((comp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-yellow-500/10 rounded">
                            <DollarSign className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <span>{comp}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.pricingComparisons).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No pricing comparisons identified</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" />
                      Feature Comparisons
                    </CardTitle>
                    <CardDescription>Feature-by-feature comparisons mentioned</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.featureComparisons).map((comp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-primary/10 rounded">
                            <Layers className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{comp}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.featureComparisons).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No feature comparisons identified</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Customer Comparisons & Timing */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Customer Comparisons</CardTitle>
                    <CardDescription>What customers compare between us and competitors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.customerComparisons).map((comp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <span>{comp}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.customerComparisons).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No comparisons identified</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Mention Timing</CardTitle>
                    <CardDescription>When in calls competitors are typically mentioned</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.competitorMentions?.mentionTiming).map((timing, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Clock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{timing}</span>
                          </li>
                        ))}
                        {safeArray(ins?.competitorMentions?.mentionTiming).length === 0 && (
                          <li className="text-sm text-muted-foreground text-center py-4">No timing patterns identified</li>
                        )}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Questions Tab */}
            <TabsContent value="questions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                    Most Asked Questions
                  </CardTitle>
                  <CardDescription>Common questions from customers by frequency and category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {safeArray(ins?.customerQuestions?.mostAsked).map((q, idx) => (
                        <div key={idx} className="p-4 border rounded-lg flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{q.question}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Badge variant="secondary">{q.category}</Badge>
                            <Badge variant="outline">{q.frequency}x</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Critical Questions</CardTitle>
                    <CardDescription>Questions that lead to conversion if handled well</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.customerQuestions?.criticalQuestions).map((q, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-yellow-500/10 rounded">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <span>{q}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Question Patterns</CardTitle>
                    <CardDescription>When and how customers typically ask questions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.customerQuestions?.questionPatterns).map((p, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Questions by Phase */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Questions by Call Phase</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="grid gap-4 md:grid-cols-3 pr-4">
                      {safeArray(ins?.customerQuestions?.questionsByPhase).map((phase, idx) => (
                        <div key={idx} className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2">{phase.phase}</h4>
                          <ul className="space-y-1">
                            {safeArray(phase.questions).map((q, qIdx) => (
                              <li key={qIdx} className="text-sm text-muted-foreground">• {q}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Objections Tab */}
            <TabsContent value="objections" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    Top Objections
                  </CardTitle>
                  <CardDescription>Most common objections by frequency and category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {safeArray(ins?.objectionHandling?.topObjections).map((obj, idx) => (
                        <div key={idx} className="p-4 border rounded-lg flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span className="font-medium">{obj.objection}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{obj.category}</Badge>
                            <Badge variant="outline">{obj.frequency}x</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Objection Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-3 pr-4">
                        {safeArray(ins?.objectionHandling?.objectionCategories).map((cat, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{cat.category}</span>
                              <span className="text-muted-foreground">{cat.count} occurrences</span>
                            </div>
                            <Progress value={(cat.count / (safeArray(ins?.objectionHandling?.objectionCategories)[0]?.count || 1)) * 100} className="h-2" />
                            <p className="text-xs text-muted-foreground">{cat.handlingStrategy}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Objection Timing</CardTitle>
                    <CardDescription>When objections typically arise</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.objectionHandling?.objectionTiming).map((t, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Clock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resolution Patterns</CardTitle>
                  <CardDescription>Patterns in how objections were resolved</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <ul className="space-y-2 pr-4">
                      {safeArray(ins?.objectionHandling?.resolutionPatterns).map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
                          <RefreshCw className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transcript Insights Tab */}
            <TabsContent value="transcripts" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-green-200 dark:border-green-900/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Positive Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.transcriptInsights?.keyPhrases?.positiveIndicators).map((p, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-900/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Negative Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.transcriptInsights?.keyPhrases?.negativeIndicators).map((p, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-lg">Engagement Peaks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.transcriptInsights?.keyPhrases?.engagementPeaks).map((p, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Sentiment Flow */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Sentiment Flow
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 border rounded-lg text-center">
                      <h4 className="text-sm text-muted-foreground mb-1">Opening Mood</h4>
                      <p className="font-medium">{ins?.transcriptInsights?.sentimentFlow?.openingMood || "N/A"}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="text-sm text-muted-foreground mb-2 text-center">Turning Points</h4>
                      <ul className="space-y-1">
                        {safeArray(ins?.transcriptInsights?.sentimentFlow?.turningPoints).map((t, idx) => (
                          <li key={idx} className="text-sm text-center">• {t}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <h4 className="text-sm text-muted-foreground mb-1">Closing Mood</h4>
                      <p className="font-medium">{ins?.transcriptInsights?.sentimentFlow?.closingMood || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Topic Analysis */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Most Discussed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-1 pr-4">
                        {safeArray(ins?.transcriptInsights?.topicAnalysis?.mostDiscussed).map((t, idx) => (
                          <li key={idx} className="text-sm">• {t}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-green-200 dark:border-green-900/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Successful Topics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-1 pr-4">
                        {safeArray(ins?.transcriptInsights?.topicAnalysis?.successfulTopics).map((t, idx) => (
                          <li key={idx} className="text-sm text-green-700 dark:text-green-400">• {t}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-red-200 dark:border-red-900/30">
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Problematic Topics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-1 pr-4">
                        {safeArray(ins?.transcriptInsights?.topicAnalysis?.problematicTopics).map((t, idx) => (
                          <li key={idx} className="text-sm text-red-700 dark:text-red-400">• {t}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Call Structure */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Structure Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="grid gap-4 md:grid-cols-3 pr-4">
                      <div>
                        <h4 className="font-medium text-green-600 mb-2">Optimal Flow</h4>
                        <ul className="space-y-1">
                          {safeArray(ins?.transcriptInsights?.callStructure?.optimalFlow).map((f, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-red-600 mb-2">Drop-off Points</h4>
                        <ul className="space-y-1">
                          {safeArray(ins?.transcriptInsights?.callStructure?.dropoffPoints).map((d, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-yellow-600 mb-2">Recovery Opportunities</h4>
                        <ul className="space-y-1">
                          {safeArray(ins?.transcriptInsights?.callStructure?.recoveryOpportunities).map((r, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <RefreshCw className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-red-200 dark:border-red-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Zap className="h-5 w-5" />
                      Immediate Actions
                    </CardTitle>
                    <CardDescription>Do these today</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-3 pr-4">
                        {safeArray(ins?.aiRecommendations?.immediate).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 dark:border-yellow-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-600">
                      <Clock className="h-5 w-5" />
                      Short-term Goals
                    </CardTitle>
                    <CardDescription>This week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-3 pr-4">
                        {safeArray(ins?.aiRecommendations?.shortTerm).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <Target className="h-5 w-5" />
                      Long-term Strategy
                    </CardTitle>
                    <CardDescription>Ongoing improvements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-3 pr-4">
                        {safeArray(ins?.aiRecommendations?.longTerm).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Performance Insights */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Agent Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.performanceInsights?.agentStrengths).map((s, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-green-500/10 rounded">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Areas to Improve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[200px]">
                      <ul className="space-y-2 pr-4">
                        {safeArray(ins?.performanceInsights?.agentWeaknesses).map((w, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-500/10 rounded">
                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Training Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <ul className="space-y-2 pr-4">
                      {safeArray(ins?.performanceInsights?.trainingRecommendations).map((r, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
                          <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
