import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Search,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  History,
  TrendingUp,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { CallDetailsDialog } from "@/components/calls/CallDetailsDialog";

interface Call {
  id: string;
  batch_id: string | null;
  agent_id: string;
  client_id: string;
  lead_id: string;
  status: string;
  connected: boolean | null;
  duration_seconds: number | null;
  sentiment: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  transcript: string | null;
  summary: string | null;
  recording_url: string | null;
  metadata: Record<string, unknown> | null;
  leads?: {
    name: string | null;
    phone_number: string;
    email: string | null;
  };
  bolna_agents?: {
    agent_name: string;
  };
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

const statusConfig = {
  completed: { icon: CheckCircle, className: "bg-chart-2/10 border-chart-2 text-chart-2" },
  connected: { icon: PhoneCall, className: "bg-chart-1/10 border-chart-1 text-chart-1" },
  answered: { icon: PhoneIncoming, className: "bg-chart-3/10 border-chart-3 text-chart-3" },
  failed: { icon: XCircle, className: "bg-destructive/10 border-destructive text-destructive" },
  initiated: { icon: Phone, className: "bg-muted border-border text-muted-foreground" },
  ringing: { icon: Phone, className: "bg-chart-4/10 border-chart-4 text-chart-4" },
  busy: { icon: PhoneOff, className: "bg-chart-5/10 border-chart-5 text-chart-5" },
  no_answer: { icon: PhoneOff, className: "bg-muted border-border text-muted-foreground" },
};

export default function BatchCallHistory() {
  const [search, setSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-history"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "client");
      if (rolesError) throw rolesError;

      const userIds = roles.map((r) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return profiles;
    },
  });

  // Fetch agents for mapping
  const { data: agents } = useQuery({
    queryKey: ["agents-for-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents" as any)
        .select("id, agent_name");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Fetch all calls with batch info
  const { data: calls, isLoading, refetch } = useQuery({
    queryKey: ["batch-call-history", selectedBatch, selectedClient],
    queryFn: async () => {
      let query = supabase
        .from("calls")
        .select(`
          *,
          leads (name, phone_number, email)
        `)
        .order("created_at", { ascending: false });

      if (selectedBatch !== "all") {
        query = query.eq("batch_id", selectedBatch);
      }

      if (selectedClient !== "all") {
        query = query.eq("client_id", selectedClient);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Map agent names
      return data.map((call) => ({
        ...call,
        aitel_agents: agents?.find((a: any) => a.id === call.agent_id) || null,
      })) as Call[];
    },
    enabled: !!agents,
  });

  // Get unique batch IDs
  const uniqueBatches = [...new Set(calls?.filter(c => c.batch_id).map(c => c.batch_id) || [])];

  // Filter calls
  const filteredCalls = calls?.filter((call) => {
    const searchLower = search.toLowerCase();
    return (
      call.leads?.name?.toLowerCase().includes(searchLower) ||
      call.leads?.phone_number?.includes(searchLower) ||
      call.batch_id?.toLowerCase().includes(searchLower) ||
      call.bolna_agents?.agent_name?.toLowerCase().includes(searchLower)
    );
  });

  // Stats
  const stats = {
    total: filteredCalls?.length || 0,
    answered: filteredCalls?.filter((c) => 
      c.status === "answered" || c.status === "connected" || c.status === "completed"
    ).length || 0,
    connected: filteredCalls?.filter((c) => 
      (c.connected || (c.duration_seconds && c.duration_seconds > 45))
    ).length || 0,
    successful: filteredCalls?.filter((c) => {
      const metadata = c.metadata as Record<string, unknown> | null;
      return metadata?.lead_interested === true || c.sentiment === "positive";
    }).length || 0,
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.user_id === clientId);
    return client?.full_name || client?.email || "Unknown";
  };

  const handleViewDetails = (call: Call) => {
    setSelectedCall(call);
    setDetailsDialogOpen(true);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Batch Call History</h1>
            <p className="text-muted-foreground">
              View all batch calls made by clients
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <p className="text-sm text-muted-foreground">Total Dialed</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <PhoneIncoming className="h-5 w-5 text-chart-3" />
              <p className="text-2xl font-bold text-chart-3">{stats.answered}</p>
            </div>
            <p className="text-sm text-muted-foreground">Answered</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <PhoneCall className="h-5 w-5 text-chart-1" />
              <p className="text-2xl font-bold text-chart-1">{stats.connected}</p>
            </div>
            <p className="text-sm text-muted-foreground">Connected (45s+)</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-chart-2" />
              <p className="text-2xl font-bold text-chart-2">{stats.successful}</p>
            </div>
            <p className="text-sm text-muted-foreground">Successful</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by lead name, phone, batch ID, or agent..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 border-2"
            />
          </div>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px] border-2">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients?.map((client) => (
                <SelectItem key={client.user_id} value={client.user_id}>
                  {client.full_name || client.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className="w-[200px] border-2">
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {uniqueBatches.map((batchId) => (
                <SelectItem key={batchId} value={batchId!}>
                  {batchId?.slice(0, 12)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCalls && filteredCalls.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Lead</TableHead>
                  <TableHead className="font-bold">Client</TableHead>
                  <TableHead className="font-bold">Agent</TableHead>
                  <TableHead className="font-bold">Batch ID</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold">Duration</TableHead>
                  <TableHead className="font-bold">Sentiment</TableHead>
                  <TableHead className="font-bold">Date</TableHead>
                  <TableHead className="font-bold w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => {
                  const status = statusConfig[call.status as keyof typeof statusConfig] || statusConfig.initiated;
                  const StatusIcon = status.icon;
                  const isConnected = call.connected || (call.duration_seconds && call.duration_seconds > 45);

                  return (
                    <TableRow key={call.id} className="border-b-2 border-border">
                      <TableCell>
                        <div>
                          <p className="font-medium">{call.leads?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {call.leads?.phone_number?.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getClientName(call.client_id)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {call.bolna_agents?.agent_name || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {call.batch_id ? `${call.batch_id.slice(0, 8)}...` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {call.status}
                          </span>
                          {isConnected && (
                            <Badge variant="outline" className="text-xs border-chart-2 text-chart-2">
                              Connected
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatDuration(call.duration_seconds)}
                      </TableCell>
                      <TableCell>
                        {call.sentiment ? (
                          <Badge
                            variant="outline"
                            className={
                              call.sentiment === "positive"
                                ? "border-chart-2 text-chart-2"
                                : call.sentiment === "negative"
                                ? "border-destructive text-destructive"
                                : "border-muted-foreground text-muted-foreground"
                            }
                          >
                            {call.sentiment}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(call)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <History className="h-12 w-12 mb-4" />
              <h3 className="font-medium text-lg mb-1">No calls found</h3>
              <p className="text-sm">Batch call history will appear here</p>
            </div>
          )}
        </div>
      </div>

      {selectedCall && (
        <CallDetailsDialog
          call={selectedCall}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />
      )}
    </DashboardLayout>
  );
}
