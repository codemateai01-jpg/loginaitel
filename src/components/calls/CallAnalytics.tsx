import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  TrendingUp,
  Clock,
  CheckCircle,
  Bot,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export function CallAnalytics() {
  const { user } = useAuth();

  // Fetch call statistics
  const { data: stats } = useQuery({
    queryKey: ["call-analytics-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Total calls
      const { count: totalCalls } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user!.id);

      // Connected calls
      const { count: connectedCalls } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("client_id", user!.id)
        .eq("connected", true);

      // Get average duration
      const { data: durationData } = await supabase
        .from("calls")
        .select("duration_seconds")
        .eq("client_id", user!.id)
        .not("duration_seconds", "is", null);

      const avgDuration = durationData?.length
        ? Math.round(
            durationData.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) /
              durationData.length
          )
        : 0;

      return {
        totalCalls: totalCalls || 0,
        connectedCalls: connectedCalls || 0,
        connectionRate: totalCalls
          ? Math.round(((connectedCalls || 0) / totalCalls) * 100)
          : 0,
        avgDuration,
      };
    },
  });

  // Fetch hourly distribution
  const { data: hourlyData } = useQuery({
    queryKey: ["call-analytics-hourly", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("calls")
        .select("created_at")
        .eq("client_id", user!.id)
        .gte("created_at", subDays(new Date(), 7).toISOString());

      const hourCounts: Record<number, number> = {};
      data?.forEach((call) => {
        const hour = new Date(call.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      return Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour.toString().padStart(2, "0")}:00`,
        calls: hourCounts[hour] || 0,
      }));
    },
  });

  // Fetch agent performance
  const { data: agentPerformance } = useQuery({
    queryKey: ["call-analytics-agents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name")
        .eq("client_id", user!.id);

      if (!agents?.length) return [];

      const performance = await Promise.all(
        agents.map(async (agent) => {
          const { count: total } = await supabase
            .from("calls")
            .select("*", { count: "exact", head: true })
            .eq("agent_id", agent.id);

          const { count: connected } = await supabase
            .from("calls")
            .select("*", { count: "exact", head: true })
            .eq("agent_id", agent.id)
            .eq("connected", true);

          return {
            name: agent.name,
            total: total || 0,
            connected: connected || 0,
            rate: total ? Math.round(((connected || 0) / total) * 100) : 0,
          };
        })
      );

      return performance.sort((a, b) => b.total - a.total);
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="h-5 w-5 text-chart-1" />
            <span className="text-sm text-muted-foreground">Total Calls</span>
          </div>
          <p className="text-3xl font-bold">{stats?.totalCalls || 0}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-chart-2" />
            <span className="text-sm text-muted-foreground">Connected</span>
          </div>
          <p className="text-3xl font-bold text-chart-2">
            {stats?.connectedCalls || 0}
          </p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-chart-4" />
            <span className="text-sm text-muted-foreground">Connection Rate</span>
          </div>
          <p className="text-3xl font-bold">{stats?.connectionRate || 0}%</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-chart-3" />
            <span className="text-sm text-muted-foreground">Avg Duration</span>
          </div>
          <p className="text-3xl font-bold font-mono">
            {formatDuration(stats?.avgDuration || 0)}
          </p>
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="border-2 border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5" />
          <h3 className="font-bold">Hourly Call Distribution</h3>
        </div>
        <div className="h-[200px]">
          {hourlyData && hourlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  interval={2}
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
                <Bar dataKey="calls" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Agent Performance */}
      <div className="border-2 border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Bot className="h-5 w-5" />
          <h3 className="font-bold">Agent Performance</h3>
        </div>
        {agentPerformance && agentPerformance.length > 0 ? (
          <div className="space-y-4">
            {agentPerformance.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between p-4 border-2 border-border"
              >
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {agent.total} calls • {agent.connected} connected
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{agent.rate}%</p>
                  <p className="text-xs text-muted-foreground">connection rate</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2" />
            <p>No agent data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
