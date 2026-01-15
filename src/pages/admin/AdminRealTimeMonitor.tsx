import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Phone,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  PhoneOff,
  Eye,
  Zap,
  Radio,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CallDetailsDialog } from "@/components/calls/CallDetailsDialog";

interface LiveCall {
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
}

interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: LiveCall;
  old: LiveCall | null;
}

const statusConfig: Record<
  string,
  { label: string; icon: typeof Phone; className: string; pulse?: boolean }
> = {
  initiated: {
    label: "Initiating",
    icon: Phone,
    className: "bg-chart-1/10 border-chart-1 text-chart-1",
    pulse: true,
  },
  in_progress: {
    label: "In Progress",
    icon: Activity,
    className: "bg-chart-4/10 border-chart-4 text-chart-4",
    pulse: true,
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-chart-2/10 border-chart-2 text-chart-2",
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

export default function AdminRealTimeMonitor() {
  const queryClient = useQueryClient();
  const [selectedCall, setSelectedCall] = useState<LiveCall | null>(null);
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [recentEvents, setRecentEvents] = useState<
    Array<{ id: string; type: string; call: LiveCall; timestamp: Date }>
  >([]);

  // Fetch active calls (initiated or in_progress)
  const { data: activeCalls, isLoading: activeLoading } = useQuery({
    queryKey: ["admin-active-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .in("status", ["initiated", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LiveCall[];
    },
    refetchInterval: 5000, // Backup polling every 5 seconds
  });

  // Fetch today's stats
  const { data: todayStats } = useQuery({
    queryKey: ["admin-today-stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayCalls, error } = await supabase
        .from("calls")
        .select("status, connected, duration_seconds")
        .gte("created_at", today.toISOString());

      if (error) throw error;

      const total = todayCalls?.length || 0;
      const completed =
        todayCalls?.filter((c) => c.status === "completed").length || 0;
      const connected = todayCalls?.filter((c) => c.connected).length || 0;
      const failed = todayCalls?.filter((c) => c.status === "failed").length || 0;
      const inProgress =
        todayCalls?.filter((c) =>
          ["initiated", "in_progress"].includes(c.status)
        ).length || 0;
      const totalDuration = todayCalls?.reduce(
        (sum, c) => sum + (c.duration_seconds || 0),
        0
      );

      return {
        total,
        completed,
        connected,
        failed,
        inProgress,
        connectionRate: total > 0 ? Math.round((connected / total) * 100) : 0,
        avgDuration: total > 0 ? Math.round((totalDuration || 0) / total) : 0,
      };
    },
    refetchInterval: 10000, // Refresh stats every 10 seconds
  });

  // Fetch client names for display
  const { data: clients } = useQuery({
    queryKey: ["admin-clients-realtime"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");

      if (error) throw error;
      return data || [];
    },
  });

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-calls-realtime")
      .on(
        "postgres_changes" as const,
        {
          event: "*",
          schema: "public",
          table: "calls",
        },
        (payload) => {
          console.log("Realtime call update:", payload);
          const realtimePayload = payload as unknown as RealtimePayload;

          // Add to recent events
          setRecentEvents((prev) => {
            const newEvent = {
              id: crypto.randomUUID(),
              type: realtimePayload.eventType,
              call: realtimePayload.new,
              timestamp: new Date(),
            };
            return [newEvent, ...prev].slice(0, 20); // Keep last 20 events
          });

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["admin-active-calls"] });
          queryClient.invalidateQueries({ queryKey: ["admin-today-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.user_id === clientId);
    return client?.full_name || client?.email?.split("@")[0] || "Unknown";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getCallDuration = (call: LiveCall) => {
    if (call.started_at) {
      const startTime = new Date(call.started_at).getTime();
      const now = Date.now();
      return Math.floor((now - startTime) / 1000);
    }
    return call.duration_seconds || 0;
  };

  // Filter calls based on selected client
  const filteredActiveCalls = useMemo(() => {
    if (clientFilter === "all") return activeCalls;
    return activeCalls?.filter((call) => call.client_id === clientFilter);
  }, [activeCalls, clientFilter]);

  const filteredEvents = useMemo(() => {
    if (clientFilter === "all") return recentEvents;
    return recentEvents.filter((event) => event.call.client_id === clientFilter);
  }, [recentEvents, clientFilter]);

  // Get selected client name for display
  const selectedClientName = useMemo(() => {
    if (clientFilter === "all") return null;
    return getClientName(clientFilter);
  }, [clientFilter, clients]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <Radio className="h-8 w-8 text-chart-2" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-chart-2 rounded-full animate-pulse" />
              </div>
              <h1 className="text-3xl font-bold">Real-Time Monitor</h1>
            </div>
            <p className="text-muted-foreground">
              Live call monitoring {selectedClientName ? `for ${selectedClientName}` : "across all clients"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Client Filter */}
            <div className="flex items-center gap-2">
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
              {clientFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setClientFilter("all")}
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Badge
              variant="outline"
              className="text-lg px-4 py-2 border-2 border-chart-2 text-chart-2"
            >
              <Zap className="h-4 w-4 mr-2" />
              {filteredActiveCalls?.length || 0} Active Calls
            </Badge>
          </div>
        </div>

        {/* Today's Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{todayStats?.total || 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Today's Calls
            </p>
          </div>
          <div className="border-2 border-chart-4 bg-chart-4/5 p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">
              {todayStats?.inProgress || 0}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              In Progress
            </p>
          </div>
          <div className="border-2 border-chart-2 bg-chart-2/5 p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">
              {todayStats?.completed || 0}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Completed
            </p>
          </div>
          <div className="border-2 border-chart-1 bg-chart-1/5 p-4 text-center">
            <p className="text-2xl font-bold text-chart-1">
              {todayStats?.connected || 0}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Connected
            </p>
          </div>
          <div className="border-2 border-destructive bg-destructive/5 p-4 text-center">
            <p className="text-2xl font-bold text-destructive">
              {todayStats?.failed || 0}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Failed
            </p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">
              {todayStats?.connectionRate || 0}%
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Connection Rate
            </p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold font-mono">
              {formatDuration(todayStats?.avgDuration || 0)}
            </p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Avg Duration
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Active Calls */}
          <div className="border-2 border-border bg-card">
            <div className="flex items-center justify-between p-4 border-b-2 border-border">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-chart-4" />
                <h2 className="font-bold">Active Calls</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredActiveCalls?.length || 0} calls
              </span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {activeLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading active calls...
                </div>
              ) : filteredActiveCalls?.length === 0 ? (
                <div className="p-8 text-center">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active calls</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clientFilter !== "all" 
                      ? "No active calls for this client" 
                      : "Calls will appear here in real-time"}
                  </p>
                </div>
              ) : (
                <div className="divide-y-2 divide-border">
                  {filteredActiveCalls?.map((call) => {
                    const status = statusConfig[call.status] || statusConfig.initiated;
                    const StatusIcon = status.icon;
                    const duration = getCallDuration(call);

                    return (
                      <div
                        key={call.id}
                        className={`p-4 cursor-pointer hover:bg-accent/50 transition-colors ${status.pulse ? "animate-pulse" : ""}`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">
                              Call #{call.id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Client: {getClientName(call.client_id)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCall(call);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Client: {getClientName(call.client_id)}
                          </span>
                          <span className="font-mono text-chart-4">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDuration(duration)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min((duration / 300) * 100, 100)}
                          className="mt-2 h-1"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Live Event Feed */}
          <div className="border-2 border-border bg-card">
            <div className="flex items-center justify-between p-4 border-b-2 border-border">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-chart-1" />
                <h2 className="font-bold">Live Event Feed</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredEvents.length} events
              </span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center">
                  <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Waiting for events...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clientFilter !== "all" 
                      ? "No events for this client yet" 
                      : "Call updates will appear here in real-time"}
                  </p>
                </div>
              ) : (
                <div className="divide-y-2 divide-border">
                  {filteredEvents.map((event) => {
                    const status =
                      statusConfig[event.call.status] || statusConfig.initiated;
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={event.id}
                        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setSelectedCall(event.call)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                event.type === "INSERT"
                                  ? "border-chart-2 text-chart-2"
                                  : event.type === "UPDATE"
                                  ? "border-chart-4 text-chart-4"
                                  : "border-destructive text-destructive"
                              }`}
                            >
                              {event.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {format(event.timestamp, "HH:mm:ss")}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCall(event.call);
                              }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm">
                          Call #{event.call.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Client: {getClientName(event.call.client_id)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Connection Status Indicator */}
        <div className="fixed bottom-4 right-4 flex items-center gap-2 bg-card border-2 border-border px-4 py-2 shadow-md">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-2 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-chart-2"></span>
          </span>
          <span className="text-sm font-medium">Live</span>
        </div>

        {/* Call Details Dialog */}
        <CallDetailsDialog
          call={selectedCall}
          open={!!selectedCall}
          onOpenChange={(open) => !open && setSelectedCall(null)}
        />
      </div>
    </DashboardLayout>
  );
}
