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
  Lightbulb,
  Phone,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  BookOpen,
  Users,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Shield,
  ArrowRight,
  Quote,
  History,
  Save,
  GitCompare,
  Trash2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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

interface CallFlowStep {
  step: number;
  action: string;
  script: string;
  timing: string;
}

interface CustomerQuestion {
  question: string;
  frequency: number;
  suggestedAnswer: string;
  category: string;
}

interface Objection {
  objection: string;
  frequency: number;
  bestRebuttal: string;
  successRate: string;
}

interface InterestTrigger {
  trigger: string;
  frequency: number;
  context: string;
}

interface InsightsData {
  bestSalesPitch: {
    openingLines: string[];
    valuePropositions: string[];
    closingTechniques: string[];
    recommendedCallFlow: CallFlowStep[];
    toneGuidelines: string[];
  };
  customerQuestions: {
    mostAsked: CustomerQuestion[];
    criticalQuestions: string[];
    questionPatterns: string[];
  };
  objectionHandling: {
    topObjections: Objection[];
    objectionCategories: { category: string; count: number; handlingStrategy: string }[];
    killerRebuttals: string[];
  };
  interestTriggers: {
    whatWorked: InterestTrigger[];
    buyingSignals: string[];
    engagementPeaks: string[];
    emotionalTriggers: string[];
  };
  callFlowAnalysis: {
    optimalDuration: string;
    criticalMoments: string[];
    dropoffPoints: string[];
    recoveryTechniques: string[];
  };
  performanceInsights: {
    conversionPatterns: string[];
    failurePatterns: string[];
    improvementAreas: string[];
    trainingRecommendations: string[];
  };
  aiRecommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    scriptUpdates: string[];
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

  // Fetch campaigns
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-for-insights", selectedClient],
    queryFn: async () => {
      let query = supabase.from("campaigns").select("id, name, client_id");
      
      if (role === "client") {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) query = query.eq("client_id", user.id);
      } else if (selectedClient && selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }
      
      const { data, error } = await query;
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
      // Using raw query since table is not in generated types yet
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
    doc.text("AI Call Insights Report", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: "center" });
    doc.text(`Total Calls Analyzed: ${analysis.metadata.totalCalls}`, pageWidth / 2, 34, { align: "center" });

    let yPos = 45;

    // Best Sales Pitch Section
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Best Sales Pitch - Recommended Call Flow", 14, yPos);

    if (analysis.insights.bestSalesPitch?.recommendedCallFlow?.length) {
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Step", "Action", "Script", "Timing"]],
        body: analysis.insights.bestSalesPitch.recommendedCallFlow.map(s => [
          s.step.toString(),
          s.action,
          s.script.substring(0, 60) + (s.script.length > 60 ? "..." : ""),
          s.timing
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
        head: [["Question", "Frequency", "Suggested Answer"]],
        body: analysis.insights.customerQuestions.mostAsked.slice(0, 10).map(q => [
          q.question,
          q.frequency.toString(),
          q.suggestedAnswer.substring(0, 50) + "..."
        ]),
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Objection Handling
    doc.addPage();
    yPos = 20;
    doc.text("Top Objections & Rebuttals", 14, yPos);

    if (analysis.insights.objectionHandling?.topObjections?.length) {
      autoTable(doc, {
        startY: yPos + 5,
        head: [["Objection", "Best Rebuttal", "Success Rate"]],
        body: analysis.insights.objectionHandling.topObjections.slice(0, 10).map(o => [
          o.objection,
          o.bestRebuttal.substring(0, 50) + "...",
          o.successRate
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

    doc.save(`ai-call-insights-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF exported successfully!");
  };

  const ins = analysis?.insights;

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              AI Call Insights
            </h1>
            <p className="text-muted-foreground">
              Comprehensive AI analysis of call transcripts for actionable sales insights
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
                <div className="w-64">
                  <label className="text-sm font-medium mb-2 block">Select Client</label>
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

              <div className="w-64">
                <label className="text-sm font-medium mb-2 block">Select Campaign</label>
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

        {/* Stats Overview */}
        {analysis && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analysis.metadata.totalCalls}</p>
                    <p className="text-sm text-muted-foreground">Calls Analyzed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <ThumbsUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analysis.metadata.interestedCalls}</p>
                    <p className="text-sm text-muted-foreground">Interested</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <ThumbsDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analysis.metadata.notInterestedCalls}</p>
                    <p className="text-sm text-muted-foreground">Not Interested</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{analysis.metadata.partialCalls}</p>
                    <p className="text-sm text-muted-foreground">Partial Interest</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State - Show when no analysis has been run */}
        {!analysis && !analyzeMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Brain className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Analysis Yet</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Click "Run AI Analysis" to analyze your call transcripts and get actionable insights 
                including best sales pitches, customer questions, objection handling strategies, and more.
              </p>
              <Button onClick={() => analyzeMutation.mutate()} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Run AI Analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {analyzeMutation.isPending && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analyzing Calls...</h3>
              <p className="text-muted-foreground max-w-md">
                Our AI is analyzing your call transcripts to extract insights. 
                This may take a few moments depending on the number of calls.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Insights Tabs */}
        {analysis && ins && (
          <Tabs defaultValue="sales-pitch" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto">
              <TabsTrigger value="sales-pitch" className="gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden md:inline">Sales Pitch</span>
              </TabsTrigger>
              <TabsTrigger value="questions" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden md:inline">Questions</span>
              </TabsTrigger>
              <TabsTrigger value="objections" className="gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden md:inline">Objections</span>
              </TabsTrigger>
              <TabsTrigger value="triggers" className="gap-2">
                <Zap className="h-4 w-4" />
                <span className="hidden md:inline">Interest</span>
              </TabsTrigger>
              <TabsTrigger value="flow" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden md:inline">Call Flow</span>
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                <span className="hidden md:inline">Actions</span>
              </TabsTrigger>
            </TabsList>

            {/* Sales Pitch Tab */}
            <TabsContent value="sales-pitch" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Recommended Call Flow */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Recommended Call Flow
                    </CardTitle>
                    <CardDescription>AI-generated optimal call script based on successful calls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {ins.bestSalesPitch?.recommendedCallFlow?.map((step, idx) => (
                        <div key={idx} className="flex gap-4 p-4 border rounded-lg bg-muted/30">
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                            {step.step}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold">{step.action}</h4>
                              <Badge variant="outline">{step.timing}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground italic">"{step.script}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Opening Lines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Best Opening Lines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.bestSalesPitch?.openingLines?.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Quote className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span className="italic">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Value Propositions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Key Value Propositions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.bestSalesPitch?.valuePropositions?.map((prop, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{prop}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Closing Techniques */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Effective Closing Techniques</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.bestSalesPitch?.closingTechniques?.map((tech, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{tech}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Tone Guidelines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tone Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.bestSalesPitch?.toneGuidelines?.map((guide, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <MessageSquare className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <span>{guide}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Customer Questions Tab */}
            <TabsContent value="questions" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-blue-600" />
                      Most Asked Questions
                    </CardTitle>
                    <CardDescription>Common questions from customers with suggested answers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {ins.customerQuestions?.mostAsked?.map((q, idx) => (
                          <div key={idx} className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{q.question}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{q.category}</Badge>
                                <Badge variant="outline">{q.frequency}x asked</Badge>
                              </div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded text-sm">
                              <span className="font-medium text-green-600">Suggested Answer: </span>
                              {q.suggestedAnswer}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Critical Questions</CardTitle>
                    <CardDescription>Questions that lead to conversion if answered well</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.customerQuestions?.criticalQuestions?.map((q, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-yellow-500/10 rounded">
                          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Question Patterns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.customerQuestions?.questionPatterns?.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Objections Tab */}
            <TabsContent value="objections" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-600" />
                      Top Objections & Best Rebuttals
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {ins.objectionHandling?.topObjections?.map((obj, idx) => (
                          <div key={idx} className="p-4 border rounded-lg space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="font-medium text-red-700">{obj.objection}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{obj.frequency}x</Badge>
                                <Badge className="bg-green-100 text-green-700">{obj.successRate} success</Badge>
                              </div>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded text-sm border-l-4 border-green-500">
                              <span className="font-medium text-green-700">Best Rebuttal: </span>
                              {obj.bestRebuttal}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Objection Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {ins.objectionHandling?.objectionCategories?.map((cat, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{cat.category}</span>
                            <span className="text-muted-foreground">{cat.count} occurrences</span>
                          </div>
                          <Progress value={(cat.count / (ins.objectionHandling?.objectionCategories?.[0]?.count || 1)) * 100} className="h-2" />
                          <p className="text-xs text-muted-foreground">{cat.handlingStrategy}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Killer Rebuttals</CardTitle>
                    <CardDescription>Rebuttals that converted objections to interest</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.objectionHandling?.killerRebuttals?.map((r, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-green-500/10 rounded">
                          <Zap className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Interest Triggers Tab */}
            <TabsContent value="triggers" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-600" />
                      What Made Leads Interested
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {ins.interestTriggers?.whatWorked?.map((trigger, idx) => (
                        <div key={idx} className="p-4 border rounded-lg bg-yellow-500/5">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{trigger.trigger}</span>
                            <Badge variant="secondary">{trigger.frequency}x</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{trigger.context}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Buying Signals</CardTitle>
                    <CardDescription>Phrases indicating purchase intent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {ins.interestTriggers?.buyingSignals?.map((signal, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {signal}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Emotional Triggers</CardTitle>
                    <CardDescription>Emotional appeals that resonated</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.interestTriggers?.emotionalTriggers?.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-pink-500 flex-shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Call Flow Analysis Tab */}
            <TabsContent value="flow" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Optimal Call Duration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-primary">{ins.callFlowAnalysis?.optimalDuration}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Critical Moments</CardTitle>
                    <CardDescription>Key decision points in calls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.callFlowAnalysis?.criticalMoments?.map((m, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Target className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-red-600">Drop-off Points</CardTitle>
                    <CardDescription>Where calls typically fail</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.callFlowAnalysis?.dropoffPoints?.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-red-500/10 rounded">
                          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-green-600">Recovery Techniques</CardTitle>
                    <CardDescription>How to recover failing calls</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {ins.callFlowAnalysis?.recoveryTechniques?.map((t, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm p-2 bg-green-500/10 rounded">
                          <RefreshCw className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* AI Recommendations Tab */}
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
                    <ul className="space-y-3">
                      {ins.aiRecommendations?.immediate?.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-yellow-200 dark:border-yellow-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-yellow-600">
                      <Clock className="h-5 w-5" />
                      Short-term Improvements
                    </CardTitle>
                    <CardDescription>Next 1-2 weeks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {ins.aiRecommendations?.shortTerm?.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-green-200 dark:border-green-900">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      Long-term Strategy
                    </CardTitle>
                    <CardDescription>Strategic recommendations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {ins.aiRecommendations?.longTerm?.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <ArrowRight className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Suggested Script Updates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {ins.aiRecommendations?.scriptUpdates?.map((update, idx) => (
                        <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                          <p className="text-sm">{update}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Training Recommendations */}
                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      Training Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {ins.performanceInsights?.trainingRecommendations?.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-3 border rounded-lg">
                          <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0" />
                          <span className="text-sm">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Empty State */}
        {!analysis && !analyzeMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Brain className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Ready to Analyze</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Click "Run AI Analysis" to get comprehensive insights from your call transcripts including best sales pitches, customer questions, objection handling, and more.
              </p>
              <Button onClick={() => analyzeMutation.mutate()} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Run AI Analysis
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {analyzeMutation.isPending && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analyzing Call Transcripts...</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Our AI is analyzing your calls to extract insights on sales techniques, customer questions, objections, and more. This may take a moment.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
