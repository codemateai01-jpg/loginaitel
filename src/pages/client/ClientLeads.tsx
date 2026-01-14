import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Upload,
  Download,
  Search,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  Loader2,
  PhoneOff,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CSVUploadDialog } from "@/components/leads/CSVUploadDialog";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { TriggerCallDialog } from "@/components/leads/TriggerCallDialog";
import { LeadActions } from "@/components/leads/LeadActions";

interface LeadsPageProps {
  role?: "admin" | "engineer" | "client";
}

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: unknown;
  client_id: string;
}

interface Agent {
  id: string;
  name: string;
}

interface CallCount {
  lead_id: string;
  count: number;
  last_call: string | null;
}

// Statuses that allow call testing (prompt approved or later)
const CALL_ALLOWED_STATUSES = [
  'prompt_approved',
  'demo_in_progress', 
  'demo_submitted',
  'completed'
];

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-muted border-border text-muted-foreground",
  },
  interested: {
    label: "Interested",
    icon: CheckCircle,
    className: "bg-chart-2/10 border-chart-2 text-chart-2",
  },
  callback: {
    label: "Callback",
    icon: Clock,
    className: "bg-chart-4/10 border-chart-4 text-chart-4",
  },
  not_interested: {
    label: "Not Interested",
    icon: XCircle,
    className: "bg-muted border-border text-muted-foreground",
  },
  no_answer: {
    label: "No Answer",
    icon: PhoneOff,
    className: "bg-muted border-border text-muted-foreground",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-primary/10 border-primary text-primary",
  },
};

export default function ClientLeads({ role = "client" }: LeadsPageProps) {
  const { user, role: userRole } = useAuth();
  const effectiveRole = role || userRole || "client";
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [callCounts, setCallCounts] = useState<Map<string, CallCount>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Dialog states
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [addLeadDialogOpen, setAddLeadDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    interested: 0,
    callbacks: 0,
    completed: 0,
  });

  // Track if engineer has any approved prompts (for call restriction)
  const [hasApprovedPrompts, setHasApprovedPrompts] = useState(false);

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch leads - query differs based on role
      let query = supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter based on role
      if (effectiveRole === "client") {
        query = query.eq("client_id", user.id);
      } else if (effectiveRole === "admin" || effectiveRole === "engineer") {
        // Admin and engineers only see leads they created (for testing)
        query = query.eq("uploaded_by", user.id);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`);
      }

      const { data: leadsData, error: leadsError } = await query.limit(100);

      if (leadsError) throw leadsError;

      setLeads(leadsData || []);

      // Fetch call counts for leads
      if (leadsData && leadsData.length > 0) {
        const leadIds = leadsData.map((l) => l.id);
        const { data: callsData } = await supabase
          .from("calls")
          .select("lead_id, created_at")
          .in("lead_id", leadIds)
          .order("created_at", { ascending: false });

        if (callsData) {
          const counts = new Map<string, CallCount>();
          callsData.forEach((call) => {
            const existing = counts.get(call.lead_id);
            if (existing) {
              existing.count++;
            } else {
              counts.set(call.lead_id, {
                lead_id: call.lead_id,
                count: 1,
                last_call: call.created_at,
              });
            }
          });
          setCallCounts(counts);
        }
      }

      // Fetch stats - based on role
      let statsQuery = supabase.from("leads").select("status");
      if (effectiveRole === "client") {
        statsQuery = statsQuery.eq("client_id", user.id);
      } else if (effectiveRole === "admin" || effectiveRole === "engineer") {
        // Admin and engineers only count their own test leads
        statsQuery = statsQuery.eq("uploaded_by", user.id);
      }
      const { data: allLeads } = await statsQuery;

      if (allLeads) {
        setStats({
          total: allLeads.length,
          interested: allLeads.filter((l) => l.status === "interested").length,
          callbacks: allLeads.filter((l) => l.status === "callback").length,
          completed: allLeads.filter((l) => l.status === "completed").length,
        });
      }
    } catch (err) {
      console.error("Fetch leads error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch leads",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, effectiveRole, statusFilter, searchQuery, toast]);

  const fetchAgents = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase
        .from("aitel_agents")
        .select("id, agent_name, client_id")
        .eq("status", "active");

      // Filter based on role
      if (effectiveRole === "client") {
        query = query.eq("client_id", user.id);
      } else if (effectiveRole === "engineer") {
        query = query.eq("engineer_id", user.id);
      }
      // Admin can see all agents

      const { data, error } = await query;

      if (error) throw error;
      setAgents(data?.map(a => ({ id: a.id, name: a.agent_name })) || []);
    } catch (err) {
      console.error("Fetch agents error:", err);
    }
  }, [user, effectiveRole]);

  // Check if engineer has approved prompts for call testing
  const checkApprovedPrompts = useCallback(async () => {
    if (!user || effectiveRole !== "engineer") {
      setHasApprovedPrompts(true); // Admins and clients can always make calls
      return;
    }

    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id")
        .eq("assigned_to", user.id)
        .in("status", CALL_ALLOWED_STATUSES)
        .limit(1);

      if (error) throw error;
      setHasApprovedPrompts(data && data.length > 0);
    } catch (err) {
      console.error("Check approved prompts error:", err);
      setHasApprovedPrompts(false);
    }
  }, [user, effectiveRole]);

  useEffect(() => {
    fetchLeads();
    fetchAgents();
    checkApprovedPrompts();
  }, [fetchLeads, fetchAgents, checkApprovedPrompts]);

  const handleTriggerCall = (lead: Lead) => {
    setSelectedLead(lead);
    setCallDialogOpen(true);
  };

  const handleExport = () => {
    if (leads.length === 0) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "No leads to export",
      });
      return;
    }

    const headers = ["Name", "Phone", "Email", "Status", "Created At"];
    const csvContent = [
      headers.join(","),
      ...leads.map((lead) =>
        [
          `"${lead.name || ""}"`,
          `"${lead.phone_number}"`,
          `"${lead.email || ""}"`,
          `"${lead.status}"`,
          `"${new Date(lead.created_at).toLocaleDateString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `${leads.length} leads exported`,
    });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <DashboardLayout role={effectiveRole}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Lead Management</h1>
            <p className="text-muted-foreground">
              Upload, track, and manage your campaign leads
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" className="shadow-xs" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" className="shadow-xs" onClick={() => setAddLeadDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
            <Button className="shadow-sm" onClick={() => setCsvDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Leads</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{stats.interested}</p>
            <p className="text-sm text-muted-foreground">Interested</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">{stats.callbacks}</p>
            <p className="text-sm text-muted-foreground">Callbacks</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads by name or phone..."
              className="pl-10 border-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-2">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="callback">Callback</SelectItem>
              <SelectItem value="not_interested">Not Interested</SelectItem>
              <SelectItem value="no_answer">No Answer</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchLeads} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Phone className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">No leads yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload a CSV or add leads manually to get started.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setAddLeadDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
                <Button onClick={() => setCsvDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Name</TableHead>
                  <TableHead className="font-bold">Phone</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Calls</TableHead>
                  <TableHead className="font-bold">Last Call</TableHead>
                  <TableHead className="font-bold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const status = statusConfig[lead.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  const callInfo = callCounts.get(lead.id);

                  return (
                    <TableRow key={lead.id} className="border-b-2 border-border">
                      <TableCell className="font-medium">
                        {lead.name || <span className="text-muted-foreground">Unknown</span>}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{lead.phone_number}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell>{callInfo?.count || 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(callInfo?.last_call || null)}
                      </TableCell>
                      <TableCell>
                        <LeadActions
                          leadId={lead.id}
                          currentStatus={lead.status}
                          onTriggerCall={() => handleTriggerCall(lead)}
                          onRefresh={fetchLeads}
                          canMakeCalls={hasApprovedPrompts}
                          role={effectiveRole}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Info */}
        {leads.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {leads.length} of {stats.total} leads
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CSVUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        onSuccess={fetchLeads}
      />
      <AddLeadDialog
        open={addLeadDialogOpen}
        onOpenChange={setAddLeadDialogOpen}
        onSuccess={fetchLeads}
      />
      <TriggerCallDialog
        open={callDialogOpen}
        onOpenChange={setCallDialogOpen}
        lead={selectedLead}
        agents={agents}
        onSuccess={fetchLeads}
      />
    </DashboardLayout>
  );
}
