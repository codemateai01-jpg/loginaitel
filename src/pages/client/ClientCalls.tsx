import { useState, useMemo } from "react";
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
  Loader2,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
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
import { listAgentExecutions, type CallExecution } from "@/lib/aitel";

// Map Bolna execution to our display format
interface CallDisplay {
  id: string;
  phone_number: string;
  agent_id: string;
  agent_name: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean;
  created_at: string;
  transcript: string | null;
  recording_url: string | null;
  sentiment: string | null;
  external_call_id: string | null;
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

export default function ClientCalls() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState<CallDisplay | null>(null);
  const [dateRange, setDateRange] = useState("7");

  // Fetch agents for this client (to get external Bolna agent IDs)
  const { data: agents } = useQuery({
    queryKey: ["client-agents-bolna", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, agent_name, external_agent_id")
        .eq("client_id", user!.id);

      if (error) throw error;
      return data || [];
    },
  });

  // Create agent lookup maps
  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    agents?.forEach((a) => {
      map[a.external_agent_id] = a.agent_name;
    });
    return map;
  }, [agents]);

  // Fetch call executions from Bolna API for each agent
  const { data: calls, isLoading } = useQuery({
    queryKey: ["client-calls-bolna", user?.id, dateRange, agents?.length],
    enabled: !!user?.id && !!agents && agents.length > 0,
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(dateRange));
      const allCalls: CallDisplay[] = [];

      // Fetch executions for each agent
      for (const agent of agents!) {
        if (!agent.external_agent_id) continue;

        const result = await listAgentExecutions({
          agent_id: agent.external_agent_id,
          page_size: 50,
          from: startDate.toISOString(),
        });

        if (result.data?.data) {
          // Map Bolna execution to our display format
          const mappedCalls = result.data.data.map((exec: CallExecution): CallDisplay => ({
            id: exec.id,
            phone_number: exec.telephony_data?.to_number || "Unknown",
            agent_id: exec.agent_id,
            agent_name: agent.agent_name,
            status: exec.status,
            duration_seconds: exec.conversation_time || null,
            connected: (exec.conversation_time || 0) >= 45,
            created_at: exec.created_at,
            transcript: exec.transcript || null,
            recording_url: exec.telephony_data?.recording_url || null,
            sentiment: null, // Bolna doesn't provide sentiment
            external_call_id: exec.id,
          }));
          allCalls.push(...mappedCalls);
        }
      }

      // Sort by created_at descending
      allCalls.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allCalls;
    },
  });

  // Filter calls
  const filteredCalls = calls?.filter((call) => {
    const matchesSearch = call.phone_number?.toLowerCase().includes(search.toLowerCase()) || 
                          call.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || call.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: calls?.length || 0,
    completed: calls?.filter((c) => c.status === "completed" || c.status === "call-disconnected").length || 0,
    connected: calls?.filter((c) => c.connected).length || 0,
    avgDuration: calls?.length
      ? Math.round(
          calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length
        )
      : 0,
    connectionRate: calls?.length
      ? Math.round((calls.filter((c) => c.connected).length / calls.length) * 100)
      : 0,
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
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const exportCalls = () => {
    if (!filteredCalls) return;
    
    const csv = [
      ["Date", "Phone Number", "Agent", "Status", "Duration", "Connected", "Sentiment"].join(","),
      ...filteredCalls.map((call) =>
        [
          format(new Date(call.created_at), "yyyy-MM-dd HH:mm"),
          call.phone_number || "",
          call.agent_name || "",
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
    a.download = `call-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Call Analytics</h1>
            <p className="text-muted-foreground">
              View call history, transcripts, and recordings
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
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
                    <TableHead className="font-bold">Phone Number</TableHead>
                    <TableHead className="font-bold">Agent</TableHead>
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
                            <p className="font-mono text-sm">{call.phone_number || "—"}</p>
                          </TableCell>
                          <TableCell>{call.agent_name || "—"}</TableCell>
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
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "2px solid hsl(var(--border))",
                            borderRadius: "0",
                          }}
                        />
                        <Bar
                          dataKey="calls"
                          fill="hsl(var(--chart-1))"
                          radius={[0, 0, 0, 0]}
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
                  <Phone className="h-5 w-5" />
                  <h3 className="font-bold">Call Status Distribution</h3>
                </div>
                <div className="h-[250px]">
                  {statusDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
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
                            backgroundColor: "hsl(var(--card))",
                            border: "2px solid hsl(var(--border))",
                            borderRadius: "0",
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

            {/* Sentiment Distribution */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="h-5 w-5" />
                <h3 className="font-bold">Sentiment Analysis</h3>
              </div>
              <div className="grid sm:grid-cols-3 gap-6 text-center">
                {sentimentDistribution.map((item) => (
                  <div key={item.name} className="p-4 border-2 border-border">
                    <p
                      className={`text-3xl font-bold ${
                        item.name.toLowerCase() === "positive"
                          ? "text-chart-2"
                          : item.name.toLowerCase() === "negative"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Call Details Dialog */}
      <CallDetailsDialog
        call={selectedCall}
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
      />
    </DashboardLayout>
  );
}
