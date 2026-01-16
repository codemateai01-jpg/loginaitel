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
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ObjectionAnalyzer } from "@/components/campaigns/ObjectionAnalyzer";
import { ObjectionTrendsComparison } from "@/components/campaigns/ObjectionTrendsComparison";

const STAGES = [
  { value: "not_interested", label: "Not Interested", color: "bg-red-500/10 text-red-600 border-red-500" },
  { value: "new", label: "Move to New", color: "bg-muted border-border" },
  { value: "lost", label: "Mark as Lost", color: "bg-muted text-muted-foreground border-border" },
];

export default function CampaignNotInterestedLeads() {
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

  // Fetch not interested leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["campaign-not-interested-leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_leads")
        .select("*")
        .eq("campaign_id", campaignId!)
        .or("interest_level.eq.not_interested,stage.eq.not_interested,stage.eq.lost")
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
        .update({ stage, interest_level: stage === "new" ? null : "not_interested" })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-not-interested-leads"] });
      toast({ title: "Stage updated" });
    },
  });

  // Delete lead mutation
  const deleteLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from("campaign_leads").delete().eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-not-interested-leads"] });
      toast({ title: "Lead removed" });
    },
  });

  // Stats
  const notInterestedCount = leads?.filter((l) => l.stage === "not_interested").length || 0;
  const lostCount = leads?.filter((l) => l.stage === "lost").length || 0;

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
              <XCircle className="h-8 w-8 text-red-500" />
              Not Interested Leads - {campaign?.name}
            </h1>
            <p className="text-muted-foreground">
              Leads who declined or are marked as lost
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border-2 border-red-500/30 bg-red-500/5 p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{notInterestedCount}</p>
            <p className="text-sm text-muted-foreground">Not Interested</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-3xl font-bold text-muted-foreground">{lostCount}</p>
            <p className="text-sm text-muted-foreground">Lost</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="border-2 border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
          <RefreshCw className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Re-engage Option</p>
            <p className="text-sm text-muted-foreground">
              You can move leads back to "New" to retry calling them in future campaigns.
            </p>
          </div>
        </div>

        {/* AI Objection Analyzer */}
        <ObjectionAnalyzer
          campaignId={campaignId!}
          campaignName={campaign?.name}
          leads={leads?.map((l) => ({
            id: l.id,
            name: l.name,
            call_id: l.call_id,
            call_summary: l.call_summary,
          })) || []}
        />

        {/* Cross-Campaign Objection Trends */}
        <ObjectionTrendsComparison />

        {/* Leads Table */}
        <div className="border-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border">
            <h3 className="font-bold flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              All Not Interested/Lost Leads ({leads?.length || 0})
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason/Summary</TableHead>
                <TableHead>Date</TableHead>
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
                    No not-interested leads yet - that's good news! 🎉
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
                      <p className="text-sm truncate text-red-600">{lead.call_summary || "No reason given"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(lead.created_at), "PP")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateLeadStage.mutate({ leadId: lead.id, stage: "new" })}
                          title="Move back to New"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Remove this lead permanently?")) {
                              deleteLead.mutate(lead.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
