import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { BulkCallDialog } from "@/components/campaigns/BulkCallDialog";
import { GoogleSheetSync } from "@/components/campaigns/GoogleSheetSync";
import { LeadDetailsDialog } from "@/components/campaigns/LeadDetailsDialog";
import { RetrySettingsDialog } from "@/components/campaigns/RetrySettingsDialog";
import {
  Plus,
  Upload,
  Play,
  Pause,
  ArrowLeft,
  Phone,
  Users,
  Target,
  XCircle,
  HelpCircle,
  Loader2,
  Download,
  Link as LinkIcon,
  FileSpreadsheet,
  History,
  Trash2,
  BookOpen,
  PhoneCall,
  RefreshCw,
  Eye,
  Settings2,
} from "lucide-react";

interface CampaignLead {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  stage: string;
  interest_level: string | null;
  call_status: string | null;
  call_duration: number | null;
  call_summary: string | null;
  call_sentiment: string | null;
  notes: string | null;
  call_id: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { value: "new", label: "New", color: "bg-muted" },
  { value: "contacted", label: "Contacted", color: "bg-blue-500/10 text-blue-600 border-blue-500" },
  { value: "interested", label: "Interested", color: "bg-green-500/10 text-green-600 border-green-500" },
  { value: "not_interested", label: "Not Interested", color: "bg-red-500/10 text-red-600 border-red-500" },
  { value: "partially_interested", label: "Partially Interested", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500" },
  { value: "site_visit_done", label: "Site Visit Done", color: "bg-purple-500/10 text-purple-600 border-purple-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-orange-500/10 text-orange-600 border-orange-500" },
  { value: "token_paid", label: "Token Paid", color: "bg-primary/10 text-primary border-primary" },
  { value: "closed", label: "Closed", color: "bg-green-600/10 text-green-700 border-green-600" },
  { value: "lost", label: "Lost", color: "bg-muted text-muted-foreground border-border" },
];

export default function CampaignDetail() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isBulkCallOpen, setIsBulkCallOpen] = useState(false);
  const [isSheetSyncOpen, setIsSheetSyncOpen] = useState(false);
  const [isRetrySettingsOpen, setIsRetrySettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [newLead, setNewLead] = useState({ name: "", phone_number: "", email: "" });
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<CampaignLead | null>(null);
  const [isLeadDetailsOpen, setIsLeadDetailsOpen] = useState(false);

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

  // Fetch active calls count (in progress)
  const { data: activeCallsCount } = useQuery({
    queryKey: ["campaign-active-calls", campaignId],
    enabled: !!campaignId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
    queryFn: async () => {
      const { count, error } = await supabase
        .from("campaign_call_queue")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId!)
        .eq("status", "in_progress");
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch campaign leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["campaign-leads", campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_leads")
        .select("*")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CampaignLead[];
    },
  });

  // Add single lead mutation
  const addLead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaign_leads").insert({
        campaign_id: campaignId!,
        client_id: user!.id,
        name: newLead.name,
        phone_number: newLead.phone_number,
        email: newLead.email || null,
        stage: "new",
      });
      if (error) throw error;

      // Update campaign total_leads count
      await supabase
        .from("campaigns")
        .update({ total_leads: (campaign?.total_leads || 0) + 1 })
        .eq("id", campaignId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      setIsAddLeadOpen(false);
      setNewLead({ name: "", phone_number: "", email: "" });
      toast({ title: "Lead added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // CSV Upload handler
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("mobile") || h.includes("number"));
      const emailIdx = headers.findIndex((h) => h.includes("email"));

      if (phoneIdx === -1) {
        toast({ title: "Error", description: "CSV must contain a phone/mobile column", variant: "destructive" });
        return;
      }

      const leadsToInsert = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
        const phone = values[phoneIdx];
        if (!phone) continue;

        leadsToInsert.push({
          campaign_id: campaignId!,
          client_id: user!.id,
          name: nameIdx >= 0 ? values[nameIdx] || "Unknown" : "Unknown",
          phone_number: phone,
          email: emailIdx >= 0 ? values[emailIdx] || null : null,
          stage: "new",
        });
      }

      if (leadsToInsert.length === 0) {
        toast({ title: "Error", description: "No valid leads found in CSV", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("campaign_leads").insert(leadsToInsert);
      if (error) throw error;

      // Update total_leads count
      await supabase
        .from("campaigns")
        .update({ total_leads: (campaign?.total_leads || 0) + leadsToInsert.length })
        .eq("id", campaignId!);

      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      toast({ title: "Success", description: `${leadsToInsert.length} leads imported` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
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
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      toast({ title: "Lead deleted" });
    },
  });

  // Pause/Resume campaign mutation
  const toggleCampaignStatus = useMutation({
    mutationFn: async (newStatus: "active" | "paused") => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: newStatus })
        .eq("id", campaignId!);
      if (error) throw error;
    },
    onSuccess: (_, newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      toast({ 
        title: newStatus === "paused" ? "Campaign paused" : "Campaign resumed",
        description: newStatus === "paused" 
          ? "No new calls will be initiated" 
          : "Calls will continue processing"
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Filter leads based on active tab
  const filteredLeads = leads?.filter((lead) => {
    if (activeTab === "all") return true;
    if (activeTab === "interested") return lead.interest_level === "interested" || lead.stage === "interested";
    if (activeTab === "not_interested") return lead.interest_level === "not_interested" || lead.stage === "not_interested";
    if (activeTab === "partial") return lead.interest_level === "partially_interested" || lead.stage === "partially_interested";
    if (activeTab === "new") return lead.stage === "new";
    return true;
  });

  const getStageBadge = (stage: string) => {
    const stageConfig = STAGES.find((s) => s.value === stage) || STAGES[0];
    return (
      <Badge className={`border-2 ${stageConfig.color}`}>
        {stageConfig.label}
      </Badge>
    );
  };

  // Calculate stats
  const interestedCount = leads?.filter((l) => l.interest_level === "interested" || l.stage === "interested").length || 0;
  const notInterestedCount = leads?.filter((l) => l.interest_level === "not_interested" || l.stage === "not_interested").length || 0;
  const partialCount = leads?.filter((l) => l.interest_level === "partially_interested" || l.stage === "partially_interested").length || 0;
  const newCount = leads?.filter((l) => l.stage === "new").length || 0;

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
            <Link to="/client/campaigns">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{campaign?.name}</h1>
            <p className="text-muted-foreground">{campaign?.description || "No description"}</p>
          </div>
          <Button variant="outline" onClick={() => setIsGuideOpen(true)}>
            <BookOpen className="h-4 w-4 mr-2" />
            Integration Guide
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-6 gap-4">
          {/* Active Calls Indicator */}
          <div className={`border-2 p-4 text-center ${activeCallsCount && activeCallsCount > 0 ? "border-primary/50 bg-primary/5 animate-pulse" : "border-border bg-card"}`}>
            <PhoneCall className={`h-5 w-5 mx-auto mb-2 ${activeCallsCount && activeCallsCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
            <p className={`text-2xl font-bold ${activeCallsCount && activeCallsCount > 0 ? "text-primary" : ""}`}>
              {activeCallsCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">Active Calls</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-2xl font-bold">{leads?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <Phone className="h-5 w-5 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{newCount}</p>
            <p className="text-xs text-muted-foreground">New</p>
          </div>
          <div className="border-2 border-green-500/30 bg-green-500/5 p-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{interestedCount}</p>
            <p className="text-xs text-muted-foreground">Interested</p>
          </div>
          <div className="border-2 border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
            <HelpCircle className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
            <p className="text-2xl font-bold text-yellow-600">{partialCount}</p>
            <p className="text-xs text-muted-foreground">Partially Interested</p>
          </div>
          <div className="border-2 border-red-500/30 bg-red-500/5 p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{notInterestedCount}</p>
            <p className="text-xs text-muted-foreground">Not Interested</p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-wrap gap-3">
          <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    placeholder="Lead name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    placeholder="+91XXXXXXXXXX"
                    value={newLead.phone_number}
                    onChange={(e) => setNewLead({ ...newLead, phone_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email (optional)</Label>
                  <Input
                    placeholder="email@example.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => addLead.mutate()}
                  disabled={!newLead.name || !newLead.phone_number || addLead.isPending}
                >
                  {addLead.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Lead
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            className="hidden"
            onChange={handleCSVUpload}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>

          <Button variant="outline" onClick={() => setIsSheetSyncOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {campaign?.google_sheet_id ? "Sync Sheets" : "Connect Sheets"}
          </Button>

          <Button variant="outline" asChild>
            <Link to={`/client/campaigns/${campaignId}/analytics`}>
              <History className="h-4 w-4 mr-2" />
              Call History & Analytics
            </Link>
          </Button>

          <Button variant="outline" onClick={() => setIsRetrySettingsOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Retry Settings
          </Button>

          {/* Activate Campaign - call all uncalled leads */}
          {newCount > 0 && campaign?.agent_id && (
            <Button
              variant="default"
              onClick={() => {
                // Select all new/uncalled leads and open bulk call dialog
                const uncalledLeadIds = leads?.filter(l => l.stage === "new" && !l.call_id).map(l => l.id) || [];
                if (uncalledLeadIds.length > 0) {
                  setSelectedLeads(uncalledLeadIds);
                  setIsBulkCallOpen(true);
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Activate Campaign ({newCount} leads)
            </Button>
          )}

          {/* Show message if no agent assigned but there are leads */}
          {newCount > 0 && !campaign?.agent_id && (
            <Button
              variant="outline"
              asChild
              className="border-orange-500 text-orange-600 hover:bg-orange-500/10"
            >
              <Link to="/client/agents">
                <Play className="h-4 w-4 mr-2" />
                Assign Agent to Start Calls
              </Link>
            </Button>
          )}

          {/* Pause/Resume Campaign */}
          {campaign?.status === "active" && (
            <Button
              variant="outline"
              onClick={() => toggleCampaignStatus.mutate("paused")}
              disabled={toggleCampaignStatus.isPending}
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-500/10"
            >
              {toggleCampaignStatus.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Pause className="h-4 w-4 mr-2" />
              )}
              Pause Campaign
            </Button>
          )}

          {campaign?.status === "paused" && (
            <Button
              variant="default"
              onClick={() => toggleCampaignStatus.mutate("active")}
              disabled={toggleCampaignStatus.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {toggleCampaignStatus.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Resume Campaign
            </Button>
          )}
          {selectedLeads.length > 0 && (
            <Button variant="default" onClick={() => setIsBulkCallOpen(true)}>
              <PhoneCall className="h-4 w-4 mr-2" />
              Call Selected ({selectedLeads.length})
            </Button>
          )}
        </div>

        {/* Bulk Call Dialog */}
        <BulkCallDialog
          open={isBulkCallOpen}
          onOpenChange={setIsBulkCallOpen}
          campaignId={campaignId!}
          agentId={campaign?.agent_id || null}
          selectedLeadIds={selectedLeads}
          concurrencyLevel={campaign?.concurrency_level || 5}
        />

        {/* Google Sheets Sync Dialog */}
        <GoogleSheetSync
          open={isSheetSyncOpen}
          onOpenChange={setIsSheetSyncOpen}
          campaignId={campaignId!}
          existingSheetId={campaign?.google_sheet_id}
        />

        {/* Retry Settings Dialog */}
        <RetrySettingsDialog
          open={isRetrySettingsOpen}
          onOpenChange={setIsRetrySettingsOpen}
          campaignId={campaignId!}
          currentRetryDelay={campaign?.retry_delay_minutes || 3}
          currentMaxRetries={campaign?.max_daily_retries || 5}
        />

        {/* Lead Details Dialog */}
        <LeadDetailsDialog
          lead={selectedLead}
          open={isLeadDetailsOpen}
          onOpenChange={setIsLeadDetailsOpen}
        />

        {/* Leads Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({leads?.length || 0})</TabsTrigger>
            <TabsTrigger value="new">New ({newCount})</TabsTrigger>
            <TabsTrigger value="interested" className="text-green-600">
              Interested ({interestedCount})
            </TabsTrigger>
            <TabsTrigger value="partial" className="text-yellow-600">
              Partial ({partialCount})
            </TabsTrigger>
            <TabsTrigger value="not_interested" className="text-red-600">
              Not Interested ({notInterestedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="border-2 border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeads(filteredLeads?.map((l) => l.id) || []);
                          } else {
                            setSelectedLeads([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Call Status</TableHead>
                    <TableHead>Summary</TableHead>
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
                  ) : filteredLeads?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads?.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads([...selectedLeads, lead.id]);
                              } else {
                                setSelectedLeads(selectedLeads.filter((id) => id !== lead.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lead.name}</p>
                            {lead.email && (
                              <p className="text-xs text-muted-foreground">{lead.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{lead.phone_number}</TableCell>
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
                        <TableCell>
                          {lead.call_status ? (
                            <Badge variant="outline">{lead.call_status}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not called</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-sm truncate">{lead.call_summary || "-"}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedLead(lead);
                                setIsLeadDetailsOpen(true);
                              }}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Make call">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this lead?")) {
                                  deleteLead.mutate(lead.id);
                                }
                              }}
                              title="Delete lead"
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
          </TabsContent>
        </Tabs>

        {/* Integration Guide Dialog */}
        <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lead Import Guide</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* CSV Format */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-500" />
                  CSV Upload Format (Bolna Compatible)
                </h3>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  <p>name,phone_number,email</p>
                  <p>John Doe,+919876543210,john@example.com</p>
                  <p>Jane Smith,+919876543211,jane@example.com</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Required columns: <code className="bg-muted px-1">phone_number</code> or <code className="bg-muted px-1">mobile</code>
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download Sample CSV
                </Button>
              </div>

              {/* Google Sheets */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-500" />
                  Google Sheets Integration
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Create a Google Sheet with columns: <code className="bg-muted px-1">name</code>, <code className="bg-muted px-1">phone_number</code>, <code className="bg-muted px-1">email</code></li>
                  <li>Go to <strong>File → Share → Publish to web</strong></li>
                  <li>Select the sheet and choose <strong>CSV</strong> format</li>
                  <li>Copy the generated URL</li>
                  <li>In campaign settings, paste the URL as the Google Sheet source</li>
                </ol>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Example URL format:</p>
                  <code className="text-xs break-all">
                    https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv
                  </code>
                </div>
              </div>

              {/* CRM API */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-primary" />
                  CRM API Integration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Connect your CRM via REST API to automatically sync leads.
                </p>
                <div className="bg-muted p-4 rounded-lg text-sm space-y-3">
                  <div>
                    <p className="font-medium">Expected API Response Format:</p>
                    <pre className="mt-2 text-xs overflow-x-auto">
{`{
  "leads": [
    {
      "name": "John Doe",
      "phone": "+919876543210",
      "email": "john@example.com"
    }
  ]
}`}
                    </pre>
                  </div>
                  <div>
                    <p className="font-medium">Supported field mappings:</p>
                    <ul className="list-disc list-inside mt-1 text-xs">
                      <li><code>name</code>, <code>full_name</code>, <code>contact_name</code></li>
                      <li><code>phone</code>, <code>phone_number</code>, <code>mobile</code></li>
                      <li><code>email</code>, <code>email_address</code></li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure API endpoint and authentication in campaign settings.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
