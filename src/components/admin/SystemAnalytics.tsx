import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Phone,
  Users,
  Bot,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export function SystemAnalytics() {
  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["admin-analytics-stats"],
    queryFn: async () => {
      // Get total clients
      const { count: clientCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "client");

      // Get total engineers
      const { count: engineerCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "engineer");

      // Get total agents
      const { count: agentCount } = await supabase
        .from("aitel_agents" as any)
        .select("*", { count: "exact", head: true });

      // Get total calls
      const { count: callCount } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true });

      // Get connected calls - count completed calls with duration > 0 as "connected"
      // This is more reliable than the connected boolean flag
      const { count: connectedByStatus } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed")
        .gt("duration_seconds", 0);

      // Also count calls explicitly marked as connected
      const { count: connectedByFlag } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("connected", true);

      // Use the higher of the two counts (in case data is inconsistent)
      const connectedCount = Math.max(connectedByStatus || 0, connectedByFlag || 0);

      // Get total credits
      const { data: credits } = await supabase
        .from("client_credits")
        .select("balance");
      
      const totalCredits = credits?.reduce((sum, c) => sum + c.balance, 0) || 0;

      // Get completed tasks
      const { count: completedTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      return {
        clients: clientCount || 0,
        engineers: engineerCount || 0,
        agents: agentCount || 0,
        totalCalls: callCount || 0,
        connectedCalls: connectedCount,
        totalCredits,
        completedTasks: completedTasks || 0,
        connectionRate: callCount ? Math.round((connectedCount / callCount) * 100) : 0,
      };
    },
  });

  // Fetch call trends (last 7 days)
  const { data: callTrends } = useQuery({
    queryKey: ["admin-call-trends"],
    queryFn: async () => {
      const days = 7;
      const trends = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        const { count } = await supabase
          .from("calls")
          .select("*", { count: "exact", head: true })
          .gte("created_at", start)
          .lte("created_at", end);

        trends.push({
          date: format(date, "MMM d"),
          calls: count || 0,
        });
      }

      return trends;
    },
  });

  // Fetch call status distribution
  const { data: callDistribution } = useQuery({
    queryKey: ["admin-call-distribution"],
    queryFn: async () => {
      const { data } = await supabase.from("calls").select("status");

      const distribution: Record<string, number> = {};
      data?.forEach((call) => {
        distribution[call.status] = (distribution[call.status] || 0) + 1;
      });

      return Object.entries(distribution).map(([name, value]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        value,
      }));
    },
  });

  // Fetch task completion trends
  const { data: taskTrends } = useQuery({
    queryKey: ["admin-task-trends"],
    queryFn: async () => {
      const days = 7;
      const trends = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        const { count: completed } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("completed_at", start)
          .lte("completed_at", end);

        const { count: created } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .gte("created_at", start)
          .lte("created_at", end);

        trends.push({
          date: format(date, "MMM d"),
          completed: completed || 0,
          created: created || 0,
        });
      }

      return trends;
    },
  });

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-chart-1" />
            <span className="text-sm text-muted-foreground">Clients</span>
          </div>
          <p className="text-3xl font-bold">{stats?.clients || 0}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-chart-2" />
            <span className="text-sm text-muted-foreground">Engineers</span>
          </div>
          <p className="text-3xl font-bold">{stats?.engineers || 0}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-5 w-5 text-chart-3" />
            <span className="text-sm text-muted-foreground">Agents</span>
          </div>
          <p className="text-3xl font-bold">{stats?.agents || 0}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="h-5 w-5 text-chart-4" />
            <span className="text-sm text-muted-foreground">Total Calls</span>
          </div>
          <p className="text-3xl font-bold">{stats?.totalCalls || 0}</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-chart-2" />
            <span className="text-sm text-muted-foreground">Connection Rate</span>
          </div>
          <p className="text-3xl font-bold">{stats?.connectionRate || 0}%</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="h-5 w-5 text-chart-2" />
            <span className="text-sm text-muted-foreground">Connected Calls</span>
          </div>
          <p className="text-3xl font-bold">{stats?.connectedCalls || 0}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-5 w-5 text-chart-1" />
            <span className="text-sm text-muted-foreground">Total Credits</span>
          </div>
          <p className="text-3xl font-bold">{stats?.totalCredits?.toLocaleString() || 0}</p>
        </div>
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-chart-2" />
            <span className="text-sm text-muted-foreground">Tasks Completed</span>
          </div>
          <p className="text-3xl font-bold">{stats?.completedTasks || 0}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call Trends Chart */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5" />
            <h3 className="font-bold">Call Volume (Last 7 Days)</h3>
          </div>
          <div className="h-[250px]">
            {callTrends && callTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callTrends}>
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
                No call data available
              </div>
            )}
          </div>
        </div>

        {/* Call Status Distribution */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Phone className="h-5 w-5" />
            <h3 className="font-bold">Call Status Distribution</h3>
          </div>
          <div className="h-[250px]">
            {callDistribution && callDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={callDistribution}
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
                    {callDistribution.map((_, index) => (
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
                No call data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Trends */}
      <div className="border-2 border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="h-5 w-5" />
          <h3 className="font-bold">Task Activity (Last 7 Days)</h3>
        </div>
        <div className="h-[250px]">
          {taskTrends && taskTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={taskTrends}>
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
                <Line
                  type="monotone"
                  dataKey="created"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={false}
                  name="Created"
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  name="Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No task data available
            </div>
          )}
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-chart-1" />
            <span className="text-sm text-muted-foreground">Created</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-chart-2" />
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
