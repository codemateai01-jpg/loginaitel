import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  ArrowLeft,
  Target,
  Phone,
  Loader2,
  Calendar,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { TranscriptAnalyzer } from "@/components/campaigns/TranscriptAnalyzer";

const STAGES = [
  { value: "interested", label: "Interested", color: "bg-green-500/10 text-green-600 border-green-500" },
  { value: "site_visit_done", label: "Site Visit Done", color: "bg-purple-500/10 text-purple-600 border-purple-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-500/10 text-orange-600 border-orange-500" },
  { value: "token_paid", label: "Token Paid", color: "bg-primary/10 text-primary border-primary" },
  { value: "closed", label: "Closed", color: "bg-green-600/10 text-green-700 border-green-600" },
  { value: "lost", label: "Lost", color: "bg-muted text-muted-foreground border-border" },
];

export default function CampaignInterestedLeads() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaign details
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch interested leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["campaign-interested-leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_leads")
        .select("*")
        .eq("campaign_id", campaignId!)
        .or("interest_level.eq.interested,stage.eq.interested,stage.eq.site_visit_done,stage.eq.negotiation,stage.eq.token_paid,stage.eq.closed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Update lead stage mutation
  const updateLeadStage = useMutation({
    mutationFn: async ({ leadId, stage }: { leadId: string; stage: string }) => {
      const { error } = await supabase
        .from("campaign_leads")
        .update({ stage })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-interested-leads"] });
      toast({ title: "Stage updated" });
    },
  });

  const getStageBadge = (stage: string) => {
    const stageConfig = STAGES.find((s) => s.value === stage) || STAGES[0];
    return (
      <Badge className={`border-2 ${stageConfig.color}`}>
        {stageConfig.label}
      </Badge>
    );
  };

  // Group leads by stage
  const leadsByStage = {
    interested: leads?.filter((l) => l.stage === "interested") || [],
    site_visit_done: leads?.filter((l) => l.stage === "site_visit_done") || [],
    negotiation: leads?.filter((l) => l.stage === "negotiation") || [],
    token_paid: leads?.filter((l) => l.stage === "token_paid") || [],
    closed: leads?.filter((l) => l.stage === "closed") || [],
  };

  if (campaignLoading) {
    return (
      <DashboardLayout role="client">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/client/campaigns/${campaignId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Target className="h-8 w-8 text-green-500" />
              Interested Leads - {campaign?.name}
            </h1>
            <p className="text-muted-foreground">
              Leads who showed interest and are in the sales pipeline
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid sm:grid-cols-5 gap-4">
          <div className="border-2 border-green-500/30 bg-green-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{leadsByStage.interested.length}</p>
            <p className="text-xs text-muted-foreground">Interested</p>
          </div>
          <div className="border-2 border-purple-500/30 bg-purple-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{leadsByStage.site_visit_done.length}</p>
            <p className="text-xs text-muted-foreground">Site Visit Done</p>
          </div>
          <div className="border-2 border-orange-500/30 bg-orange-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{leadsByStage.negotiation.length}</p>
            <p className="text-xs text-muted-foreground">Negotiation</p>
          </div>
          <div className="border-2 border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{leadsByStage.token_paid.length}</p>
            <p className="text-xs text-muted-foreground">Token Paid</p>
          </div>
          <div className="border-2 border-green-600/30 bg-green-600/5 p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{leadsByStage.closed.length}</p>
            <p className="text-xs text-muted-foreground">Closed</p>
          </div>
        </div>

        {/* AI Transcript Analyzer */}
        <TranscriptAnalyzer
          campaignId={campaignId!}
          leads={leads?.map((l) => ({
            id: l.id,
            name: l.name,
            call_id: l.call_id,
            call_summary: l.call_summary,
          })) || []}
        />

        {/* Leads Table */}
        <div className="border-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              All Interested Leads ({leads?.length || 0})
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Call Summary</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : leads?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No interested leads yet. Start calling to find interested prospects!
                  </TableCell>
                </TableRow>
              ) : (
                leads?.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <p className="font-medium">{lead.name}</p>
                    </TableCell>
                    <TableCell className="font-mono">{lead.phone_number}</TableCell>
                    <TableCell>{lead.email || "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={lead.stage}
                        onValueChange={(value) => updateLeadStage.mutate({ leadId: lead.id, stage: value })}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((stage) => (
                            <SelectItem key={stage.value} value={stage.value}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm truncate">{lead.call_summary || "No summary"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(lead.created_at), "PP")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
