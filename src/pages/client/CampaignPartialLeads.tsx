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
  HelpCircle,
  Phone,
  Loader2,
  Calendar,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { PartialInterestAnalyzer } from "@/components/campaigns/PartialInterestAnalyzer";

const STAGES = [
  { value: "partially_interested", label: "Partially Interested", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500" },
  { value: "interested", label: "Move to Interested", color: "bg-green-500/10 text-green-600 border-green-500" },
  { value: "not_interested", label: "Mark Not Interested", color: "bg-red-500/10 text-red-600 border-red-500" },
  { value: "contacted", label: "Needs Follow-up", color: "bg-blue-500/10 text-blue-600 border-blue-500" },
];

export default function CampaignPartialLeads() {
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

  // Fetch partially interested leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["campaign-partial-leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_leads")
        .select("*")
        .eq("campaign_id", campaignId!)
        .or("interest_level.eq.partially_interested,stage.eq.partially_interested")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Update lead stage mutation
  const updateLeadStage = useMutation({
    mutationFn: async ({ leadId, stage }: { leadId: string; stage: string }) => {
      const interestLevel = stage === "interested" 
        ? "interested" 
        : stage === "not_interested" 
        ? "not_interested" 
        : "partially_interested";
      
      const { error } = await supabase
        .from("campaign_leads")
        .update({ stage, interest_level: interestLevel })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-partial-leads"] });
      toast({ title: "Stage updated" });
    },
  });

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
              <HelpCircle className="h-8 w-8 text-yellow-500" />
              Partially Interested - {campaign?.name}
            </h1>
            <p className="text-muted-foreground">
              Leads who showed some interest but need follow-up
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="border-2 border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
          <p className="text-4xl font-bold text-yellow-600">{leads?.length || 0}</p>
          <p className="text-sm text-muted-foreground">Partially Interested Leads</p>
        </div>

        {/* Tip Box */}
        <div className="border-2 border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Follow-up Strategy</p>
            <p className="text-sm text-muted-foreground">
              These leads showed some interest but may need more information or a better time to talk.
              Consider scheduling follow-up calls or sending additional materials.
            </p>
          </div>
        </div>

        {/* AI Follow-Up Analyzer */}
        <PartialInterestAnalyzer
          campaignId={campaignId!}
          campaignName={campaign?.name}
          leads={leads?.map((l) => ({
            id: l.id,
            name: l.name,
            call_id: l.call_id,
            call_summary: l.call_summary,
          })) || []}
        />

        {/* Leads Table */}
        <div className="border-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border">
            <h3 className="font-bold flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-yellow-500" />
              All Partially Interested Leads
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes/Summary</TableHead>
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
                    No partially interested leads yet
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
                        <SelectTrigger className="w-44">
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
                      <p className="text-sm truncate text-yellow-700">{lead.call_summary || lead.notes || "No notes"}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(lead.created_at), "PP")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Call Again">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Schedule Follow-up">
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Add Note">
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
