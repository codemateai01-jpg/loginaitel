import { useState, useEffect } from "react";
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
  Users,
  TrendingUp,
  Zap,
  Radio,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface LiveCall {
  id: string;
  lead_id: string;
  agent_id: string;
  client_id: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean | null;
  started_at: string | null;
  created_at: string;
  lead?: {
    name: string | null;
    phone_number_masked: string | null;
  };
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
  const [recentEvents, setRecentEvents] = useState<
    Array<{ id: string; type: string; call: LiveCall; timestamp: Date }>
  >([]);

  // Fetch active calls (initiated or in_progress)
  const { data: activeCalls, isLoading: activeLoading } = useQuery({
    queryKey: ["admin-active-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select(
          `
          *,
          lead:leads_admin_view(name, phone_number_masked)
        `
        )
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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <Radio className="h-8 w-8 text-chart-2" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-chart-2 rounded-full animate-pulse" />
              </div>
              <h1 className="text-3xl font-bold">Real-Time Monitor</h1>
            </div>
            <p className="text-muted-foreground">
              Live call monitoring across all clients
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-lg px-4 py-2 border-2 border-chart-2 text-chart-2"
          >
            <Zap className="h-4 w-4 mr-2" />
            {activeCalls?.length || 0} Active Calls
          </Badge>
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
                {activeCalls?.length || 0} calls
              </span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {activeLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading active calls...
                </div>
              ) : activeCalls?.length === 0 ? (
                <div className="p-8 text-center">
                  <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No active calls</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Calls will appear here in real-time
                  </p>
                </div>
              ) : (
                <div className="divide-y-2 divide-border">
                  {activeCalls?.map((call) => {
                    const status = statusConfig[call.status] || statusConfig.initiated;
                    const StatusIcon = status.icon;
                    const duration = getCallDuration(call);

                    return (
                      <div
                        key={call.id}
                        className={`p-4 ${status.pulse ? "animate-pulse" : ""}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">
                              {call.lead?.name || "Unknown Lead"}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {call.lead?.phone_number_masked}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
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
                {recentEvents.length} events
              </span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {recentEvents.length === 0 ? (
                <div className="p-8 text-center">
                  <Radio className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Waiting for events...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Call updates will appear here in real-time
                  </p>
                </div>
              ) : (
                <div className="divide-y-2 divide-border">
                  {recentEvents.map((event) => {
                    const status =
                      statusConfig[event.call.status] || statusConfig.initiated;
                    const StatusIcon = status.icon;

                    return (
                      <div key={event.id} className="p-4">
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
                          <span className="text-xs text-muted-foreground">
                            {format(event.timestamp, "HH:mm:ss")}
                          </span>
                        </div>
                        <p className="text-sm">
                          Call to{" "}
                          <span className="font-medium">
                            {event.call.lead?.name || "Unknown"}
                          </span>
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
      </div>
    </DashboardLayout>
  );
}
