import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { 
  Search, 
  Upload, 
  Phone, 
  MoreVertical, 
  Calendar,
  User,
  Filter,
  RefreshCw,
  Plus,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { RELeadUploadDialog } from "@/components/realestate/RELeadUploadDialog";
import { REAddLeadDialog } from "@/components/realestate/REAddLeadDialog";
import { REBulkCallDialog } from "@/components/realestate/REBulkCallDialog";
import { RELeadDetailsDialog } from "@/components/realestate/RELeadDetailsDialog";
import { REScheduleVisitDialog } from "@/components/realestate/REScheduleVisitDialog";

type LeadStage = 'new' | 'contacted' | 'interested' | 'site_visit_done' | 'negotiation' | 'token_paid' | 'closed' | 'lost';

interface RELead {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  source: string | null;
  stage: LeadStage;
  interest_score: number | null;
  project_id: string | null;
  assigned_executive_id: string | null;
  last_call_at: string | null;
  last_call_summary: string | null;
  created_at: string;
  projects?: { name: string } | null;
  sales_executives?: { name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  agent_name: string;
}

const stageConfig: Record<LeadStage, { label: string; color: string }> = {
  new: { label: "New", color: "bg-gray-500" },
  contacted: { label: "Contacted", color: "bg-blue-500" },
  interested: { label: "Interested", color: "bg-green-500" },
  site_visit_done: { label: "Site Visit Done", color: "bg-purple-500" },
  negotiation: { label: "Negotiation", color: "bg-orange-500" },
  token_paid: { label: "Token Paid", color: "bg-yellow-500" },
  closed: { label: "Closed", color: "bg-emerald-600" },
  lost: { label: "Lost", color: "bg-red-500" },
};

export default function RELeads() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [leads, setLeads] = useState<RELead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(searchParams.get("stage") || "all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  
  // Dialogs
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [bulkCallDialogOpen, setBulkCallDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [scheduleVisitDialogOpen, setScheduleVisitDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<RELead | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      let query = supabase
        .from("real_estate_leads")
        .select("*, projects(name), sales_executives(name)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (stageFilter !== "all") {
        query = query.eq("stage", stageFilter as any);
      }
      if (projectFilter !== "all") {
        query = query.eq("project_id", projectFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, stageFilter, projectFilter, sourceFilter, searchQuery, toast]);

  const fetchProjects = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("client_id", user.id)
      .eq("status", "active");

    setProjects(data || []);
  }, [user]);

  const fetchAgents = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("aitel_agents")
      .select("id, agent_name")
      .eq("client_id", user.id)
      .eq("status", "active");

    setAgents(data || []);
  }, [user]);

  useEffect(() => {
    fetchLeads();
    fetchProjects();
    fetchAgents();
  }, [fetchLeads, fetchProjects, fetchAgents]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(leads.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads(prev => [...prev, leadId]);
    } else {
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
    }
  };

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    try {
      const { error } = await supabase
        .from("real_estate_leads")
        .update({ stage: newStage })
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead stage updated",
      });
      
      fetchLeads();
    } catch (error) {
      console.error("Error updating stage:", error);
      toast({
        title: "Error",
        description: "Failed to update stage",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    const csvContent = [
      ["Name", "Phone", "Email", "Source", "Stage", "Interest Score", "Project", "Created At"].join(","),
      ...leads.map(lead => [
        lead.name || "",
        lead.phone_number,
        lead.email || "",
        lead.source || "",
        lead.stage,
        lead.interest_score || "",
        lead.projects?.name || "",
        format(new Date(lead.created_at), "yyyy-MM-dd HH:mm"),
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const handleViewDetails = (lead: RELead) => {
    setSelectedLead(lead);
    setDetailsDialogOpen(true);
  };

  const handleScheduleVisit = (lead: RELead) => {
    setSelectedLead(lead);
    setScheduleVisitDialogOpen(true);
  };

  const uniqueSources = [...new Set(leads.map(l => l.source).filter(Boolean))];

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">
              Manage your real estate leads
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <Button onClick={() => setAddLeadDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Object.entries(stageConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map(source => (
                    <SelectItem key={source} value={source!}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={fetchLeads}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedLeads.length > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {selectedLeads.length} lead{selectedLeads.length > 1 ? "s" : ""} selected
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setBulkCallDialogOpen(true)}
                    disabled={agents.length === 0}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Make Calls
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedLeads([])}>
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeads.length === leads.length && leads.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Last Call</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No leads found. Upload a CSV or add leads manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleViewDetails(lead)}
                          className="font-medium hover:underline text-left"
                        >
                          {lead.name || "Unknown"}
                        </button>
                        {lead.email && (
                          <p className="text-xs text-muted-foreground">{lead.email}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{lead.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.source || "—"}</Badge>
                      </TableCell>
                      <TableCell>{lead.projects?.name || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={lead.stage}
                          onValueChange={(value) => handleStageChange(lead.id, value as LeadStage)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <Badge className={stageConfig[lead.stage].color}>
                              {stageConfig[lead.stage].label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(stageConfig).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <Badge className={config.color}>{config.label}</Badge>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {lead.interest_score !== null ? (
                          <Badge variant={lead.interest_score >= 70 ? "default" : lead.interest_score >= 40 ? "secondary" : "outline"}>
                            {lead.interest_score}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {lead.last_call_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(lead.last_call_at), "MMM d, h:mm a")}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(lead)}>
                              <User className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScheduleVisit(lead)}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Schedule Visit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedLeads([lead.id]);
                                setBulkCallDialogOpen(true);
                              }}
                              disabled={agents.length === 0}
                            >
                              <Phone className="h-4 w-4 mr-2" />
                              Make Call
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <RELeadUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        projects={projects}
        onSuccess={fetchLeads}
      />

      <REAddLeadDialog
        open={addLeadDialogOpen}
        onOpenChange={setAddLeadDialogOpen}
        projects={projects}
        onSuccess={fetchLeads}
      />

      <REBulkCallDialog
        open={bulkCallDialogOpen}
        onOpenChange={setBulkCallDialogOpen}
        selectedLeadIds={selectedLeads}
        agents={agents}
        onSuccess={() => {
          setSelectedLeads([]);
          fetchLeads();
        }}
      />

      {selectedLead && (
        <>
          <RELeadDetailsDialog
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            lead={selectedLead}
            onUpdate={fetchLeads}
          />

          <REScheduleVisitDialog
            open={scheduleVisitDialogOpen}
            onOpenChange={setScheduleVisitDialogOpen}
            lead={selectedLead}
            onSuccess={fetchLeads}
          />
        </>
      )}
    </DashboardLayout>
  );
}
