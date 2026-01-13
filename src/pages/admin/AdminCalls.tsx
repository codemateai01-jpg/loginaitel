import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  Search,
  Play,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  PhoneOff,
  TrendingUp,
  Calendar,
  BarChart3,
  Download,
  Users,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { CallDetailsDialog } from "@/components/calls/CallDetailsDialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Call {
  id: string;
  lead_id: string;
  agent_id: string;
  client_id: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  sentiment: string | null;
  metadata: unknown;
  external_call_id: string | null;
  lead?: {
    name: string | null;
    phone_number_masked: string | null;
  };
  agent?: {
    name: string;
  };
}

const statusConfig: Record<string, { label: string; icon: typeof Phone; className: string }> = {
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-chart-2/10 border-chart-2 text-chart-2",
  },
  initiated: {
    label: "Initiated",
    icon: Phone,
    className: "bg-chart-1/10 border-chart-1 text-chart-1",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-chart-4/10 border-chart-4 text-chart-4",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/10 border-destructive text-destructive",
  },
  no_answer: {
    label: "No Answer",
    icon: PhoneOff,
    className: "bg-muted border-border text-muted-foreground",
  },
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function AdminCalls() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [dateRange, setDateRange] = useState("7");

  // Fetch all calls (admin sees all)
  const { data: calls, isLoading } = useQuery({
    queryKey: ["admin-calls", dateRange],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange)).toISOString();
      
      // Admin uses leads_admin_view which masks phone numbers
      const { data, error } = await supabase
        .from("calls")
        .select(`
          *,
          lead:leads_admin_view(name, phone_number_masked)
        `)
        .gte("created_at", startDate)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data?.map(d => ({ 
        ...d, 
        agent: { name: 'Agent' },
        lead: d.lead ? { ...d.lead, phone_number: d.lead.phone_number_masked } : undefined
      })) as Call[];
    },
  });

  // Fetch all agents
  const { data: agents } = useQuery({
    queryKey: ["admin-agents-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("id, agent_name, client_id");

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch clients for filter
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");

      if (error) throw error;
      return data || [];
    },
  });

  // Filter calls
  const filteredCalls = calls?.filter((call) => {
    const matchesSearch =
      call.lead?.name?.toLowerCase().includes(search.toLowerCase()) ||
      call.lead?.phone_number_masked?.includes(search);
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    const matchesClient = clientFilter === "all" || call.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  // Calculate stats
  const stats = {
    total: calls?.length || 0,
    completed: calls?.filter((c) => c.status === "completed").length || 0,
    connected: calls?.filter((c) => c.connected).length || 0,
    avgDuration: calls?.length
      ? Math.round(
          calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length
        )
      : 0,
    connectionRate: calls?.length
      ? Math.round((calls.filter((c) => c.connected).length / calls.length) * 100)
      : 0,
    uniqueClients: new Set(calls?.map(c => c.client_id)).size,
  };

  // Prepare chart data
  const statusDistribution = calls
    ? Object.entries(
        calls.reduce((acc, call) => {
          acc[call.status] = (acc[call.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({
        name: statusConfig[name]?.label || name,
        value,
      }))
    : [];

  const sentimentDistribution = calls
    ? Object.entries(
        calls.reduce((acc, call) => {
          const sentiment = call.sentiment || "neutral";
          acc[sentiment] = (acc[sentiment] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }))
    : [];

  // Daily call volume
  const dailyVolume = calls
    ? Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const count = calls.filter((c) => {
          const callDate = new Date(c.created_at);
          return callDate >= dayStart && callDate <= dayEnd;
        }).length;
        return {
          date: format(date, "MMM d"),
          calls: count,
        };
      })
    : [];

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getClientName = (clientId: string) => {
    const client = clients?.find(c => c.user_id === clientId);
    return client?.full_name || client?.email || "Unknown";
  };

  const exportCalls = () => {
    if (!filteredCalls) return;
    
    const csv = [
      ["Date", "Client", "Lead", "Phone (Masked)", "Agent", "Status", "Duration", "Connected", "Sentiment"].join(","),
      ...filteredCalls.map((call) =>
        [
          format(new Date(call.created_at), "yyyy-MM-dd HH:mm"),
          getClientName(call.client_id),
          call.lead?.name || "Unknown",
          call.lead?.phone_number_masked || "",
          call.agent?.name || "",
          call.status,
          formatDuration(call.duration_seconds),
          call.connected ? "Yes" : "No",
          call.sentiment || "neutral",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-call-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  // Transform for dialog (use masked phone as phone_number)
  const getCallForDialog = (call: Call) => ({
    ...call,
    lead: call.lead ? {
      name: call.lead.name,
      phone_number: call.lead.phone_number_masked || ""
    } : undefined
  });

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">All Calls</h1>
            <p className="text-muted-foreground">
              View call history across all clients (phone numbers masked)
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px] border-2">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCalls} className="shadow-xs">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Calls</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-1">{stats.connected}</p>
            <p className="text-sm text-muted-foreground">Connected</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
            <p className="text-sm text-muted-foreground">Avg Duration</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{stats.connectionRate}%</p>
            <p className="text-sm text-muted-foreground">Connection Rate</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">{stats.uniqueClients}</p>
            <p className="text-sm text-muted-foreground">Active Clients</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="history" className="space-y-6">
          <TabsList className="border-2 border-border bg-card p-1">
            <TabsTrigger
              value="history"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Phone className="h-4 w-4" />
              Call History
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-2"
                />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[200px] border-2">
                  <Users className="h-4 w-4 mr-2" />
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] border-2">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="initiated">Initiated</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calls Table */}
            <div className="border-2 border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-border hover:bg-transparent">
                    <TableHead className="font-bold">Client</TableHead>
                    <TableHead className="font-bold">Lead</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold">Duration</TableHead>
                    <TableHead className="font-bold">Sentiment</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading calls...
                      </TableCell>
                    </TableRow>
                  ) : filteredCalls?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Phone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">No calls found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCalls?.map((call) => {
                      const status = statusConfig[call.status] || statusConfig.initiated;
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={call.id} className="border-b-2 border-border">
                          <TableCell>
                            <p className="font-medium text-sm">{getClientName(call.client_id)}</p>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{call.lead?.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {call.lead?.phone_number_masked}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono">
                            {formatDuration(call.duration_seconds)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-xs font-medium capitalize ${
                                call.sentiment === "positive"
                                  ? "text-chart-2"
                                  : call.sentiment === "negative"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {call.sentiment || "neutral"}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(call.created_at), "MMM d, HH:mm")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedCall(call)}
                                title="View Details"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              {call.recording_url && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Play Recording"
                                  onClick={() => setSelectedCall(call)}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Daily Call Volume */}
              <div className="border-2 border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="font-bold">Daily Call Volume</h3>
                </div>
                <div className="h-[250px]">
                  {dailyVolume.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyVolume}>
                        <XAxis
                          dataKey="date"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            border: "2px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                        />
                        <Bar
                          dataKey="calls"
                          fill="hsl(var(--chart-1))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Status Distribution */}
              <div className="border-2 border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="h-5 w-5" />
                  <h3 className="font-bold">Status Distribution</h3>
                </div>
                <div className="h-[250px]">
                  {statusDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {statusDistribution.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            border: "2px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Sentiment Distribution */}
              <div className="border-2 border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="font-bold">Sentiment Distribution</h3>
                </div>
                <div className="h-[250px]">
                  {sentimentDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {sentimentDistribution.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            border: "2px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Call Details Dialog */}
        <CallDetailsDialog
          call={selectedCall ? getCallForDialog(selectedCall) : null}
          open={!!selectedCall}
          onOpenChange={(open) => !open && setSelectedCall(null)}
        />
      </div>
    </DashboardLayout>
  );
}
