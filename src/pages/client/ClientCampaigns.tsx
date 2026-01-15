import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Plus,
  Play,
  Pause,
  Eye,
  Trash2,
  Users,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  BarChart3,
  Target,
  Megaphone,
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  agent_id: string | null;
  concurrency_level: number;
  total_leads: number;
  contacted_leads: number;
  interested_leads: number;
  not_interested_leads: number;
  partially_interested_leads: number;
  created_at: string;
}

export default function ClientCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
    agent_id: "",
    concurrency_level: 5,
  });

  // Fetch campaigns with live stats from campaign_leads
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["client-campaigns", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // First fetch campaigns
      const { data: campaignsData, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Then fetch lead stats for each campaign from campaign_leads (more accurate than stored counters)
      const campaignsWithStats = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: leads } = await supabase
            .from("campaign_leads")
            .select("call_status, interest_level")
            .eq("campaign_id", campaign.id);
          
          const leadStats = leads || [];
          const contacted = leadStats.filter(l => l.call_status !== null).length;
          const interested = leadStats.filter(l => l.interest_level === "interested").length;
          const notInterested = leadStats.filter(l => l.interest_level === "not_interested").length;
          const partiallyInterested = leadStats.filter(l => l.interest_level === "partially_interested").length;
          
          return {
            ...campaign,
            total_leads: leadStats.length || campaign.total_leads,
            contacted_leads: contacted,
            interested_leads: interested,
            not_interested_leads: notInterested,
            partially_interested_leads: partiallyInterested,
          } as Campaign;
        })
      );
      
      return campaignsWithStats;
    },
  });

  // Fetch agents for dropdown
  const { data: agents } = useQuery({
    queryKey: ["client-agents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, agent_name")
        .eq("client_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaigns").insert({
        client_id: user!.id,
        name: newCampaign.name,
        description: newCampaign.description || null,
        agent_id: newCampaign.agent_id || null,
        concurrency_level: newCampaign.concurrency_level,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-campaigns"] });
      setIsCreateOpen(false);
      setNewCampaign({ name: "", description: "", agent_id: "", concurrency_level: 5 });
      toast({ title: "Campaign created", description: "Start adding leads to your campaign." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update campaign status mutation
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-campaigns"] });
      toast({ title: "Status updated" });
    },
  });

  // Delete campaign mutation
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-campaigns"] });
      toast({ title: "Campaign deleted" });
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-muted text-muted-foreground border-border",
      active: "bg-green-500/10 text-green-600 border-green-500",
      paused: "bg-yellow-500/10 text-yellow-600 border-yellow-500",
      completed: "bg-primary/10 text-primary border-primary",
    };
    return (
      <Badge className={`border-2 ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Calculate overall stats
  const totalLeads = campaigns?.reduce((sum, c) => sum + c.total_leads, 0) || 0;
  const totalContacted = campaigns?.reduce((sum, c) => sum + c.contacted_leads, 0) || 0;
  const totalInterested = campaigns?.reduce((sum, c) => sum + c.interested_leads, 0) || 0;

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
            <p className="text-muted-foreground">
              Manage your calling campaigns and track lead progress
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g., Q1 Outreach"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Campaign description..."
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Select Agent</Label>
                  <Select
                    value={newCampaign.agent_id}
                    onValueChange={(v) => setNewCampaign({ ...newCampaign, agent_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.agent_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Concurrency Level</Label>
                  <Select
                    value={String(newCampaign.concurrency_level)}
                    onValueChange={(v) => setNewCampaign({ ...newCampaign, concurrency_level: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} calls at a time
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Maximum simultaneous calls (max 10)
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createCampaign.mutate()}
                  disabled={!newCampaign.name || createCampaign.isPending}
                >
                  {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Overview */}
        <div className="grid sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Campaigns</span>
            </div>
            <p className="text-2xl font-bold">{campaigns?.length || 0}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Leads</span>
            </div>
            <p className="text-2xl font-bold">{totalLeads}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Contacted</span>
            </div>
            <p className="text-2xl font-bold">{totalContacted}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Interested</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{totalInterested}</p>
          </div>
        </div>

        {/* Campaigns Table */}
        <div className="border-2 border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Contacted</TableHead>
                <TableHead className="text-center">Interested</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : campaigns?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No campaigns yet. Create your first campaign to get started.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns?.map((campaign) => {
                  const progress = campaign.total_leads > 0 
                    ? Math.round((campaign.contacted_leads / campaign.total_leads) * 100) 
                    : 0;
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <Link 
                            to={`/client/campaigns/${campaign.id}`}
                            className="font-medium hover:text-primary transition-colors"
                          >
                            {campaign.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            Created {format(new Date(campaign.created_at), "PP")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell className="text-center">{campaign.total_leads}</TableCell>
                      <TableCell className="text-center">{campaign.contacted_leads}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{campaign.interested_leads}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-10">{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/client/campaigns/${campaign.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/client/campaigns/${campaign.id}/analytics`}>
                              <BarChart3 className="h-4 w-4" />
                            </Link>
                          </Button>
                          {campaign.status === "active" ? (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => updateStatus.mutate({ id: campaign.id, status: "paused" })}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : campaign.status !== "completed" && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => updateStatus.mutate({ id: campaign.id, status: "active" })}
                              disabled={campaign.total_leads === 0}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                              if (confirm("Delete this campaign?")) {
                                deleteCampaign.mutate(campaign.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
