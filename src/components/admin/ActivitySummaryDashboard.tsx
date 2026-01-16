import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from "recharts";
import { 
  Activity, 
  LogIn, 
  TrendingUp, 
  Users, 
  Crown,
  RefreshCw,
  Calendar
} from "lucide-react";

interface ActivityLog {
  id: string;
  sub_user_id: string;
  action_type: string;
  description: string;
  created_at: string;
}

interface SubUser {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
}

interface ActivitySummaryDashboardProps {
  clientId: string;
}

export function ActivitySummaryDashboard({ clientId }: ActivitySummaryDashboardProps) {
  // Fetch all activity logs for this client
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["client-activity-summary", clientId],
    queryFn: async () => {
      const result = await (supabase as any)
        .from("sub_user_activity_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      
      if (result.error) throw result.error;
      return (result.data || []) as ActivityLog[];
    },
    enabled: !!clientId,
  });

  // Fetch sub-users for name mapping
  const { data: subUsers } = useQuery({
    queryKey: ["client-sub-users-map", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sub_users")
        .select("id, full_name, phone, role")
        .eq("client_id", clientId);
      if (error) throw error;
      return (data || []) as unknown as SubUser[];
    },
    enabled: !!clientId,
  });

  // Calculate statistics
  const stats = {
    totalLogins: activities?.filter(a => a.action_type === "login" || a.action_type === "first_login").length || 0,
    totalActivities: activities?.length || 0,
    uniqueActiveUsers: new Set(activities?.map(a => a.sub_user_id) || []).size,
    todayLogins: activities?.filter(a => {
      const today = startOfDay(new Date());
      return (a.action_type === "login" || a.action_type === "first_login") && 
             new Date(a.created_at) >= today;
    }).length || 0,
  };

  // Calculate most active users
  const userActivityCounts = activities?.reduce((acc, activity) => {
    acc[activity.sub_user_id] = (acc[activity.sub_user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const mostActiveUsers = Object.entries(userActivityCounts)
    .map(([userId, count]) => {
      const user = subUsers?.find(u => u.id === userId);
      return {
        userId,
        name: user?.full_name || user?.phone || "Unknown",
        role: user?.role || "unknown",
        count: count as number,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate activity trends (last 7 days)
  const last7Days = eachDayOfInterval({
    start: subDays(new Date(), 6),
    end: new Date(),
  });

  const activityTrends = last7Days.map(day => {
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    const dayActivities = activities?.filter(a => {
      const actDate = new Date(a.created_at);
      return actDate >= dayStart && actDate < dayEnd;
    }) || [];

    const logins = dayActivities.filter(a => 
      a.action_type === "login" || a.action_type === "first_login"
    ).length;

    return {
      date: format(day, "EEE"),
      fullDate: format(day, "MMM d"),
      logins,
      total: dayActivities.length,
    };
  });

  // Activity by type
  const activityByType = activities?.reduce((acc, activity) => {
    acc[activity.action_type] = (acc[activity.action_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const activityTypeData = Object.entries(activityByType)
    .map(([type, count]) => ({
      type: type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      count: count as number,
    }))
    .sort((a, b) => b.count - a.count);

  const chartConfig = {
    logins: {
      label: "Logins",
      color: "hsl(var(--primary))",
    },
    total: {
      label: "Total Activities",
      color: "hsl(var(--muted-foreground))",
    },
  };

  if (activitiesLoading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <LogIn className="h-3 w-3" /> Total Logins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogins}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Today's Logins
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.todayLogins}</div>
            <p className="text-xs text-muted-foreground">Since midnight</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Activity className="h-3 w-3" /> Total Activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActivities}</div>
            <p className="text-xs text-muted-foreground">All actions tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-3 w-3" /> Active Users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueActiveUsers}</div>
            <p className="text-xs text-muted-foreground">With recorded activity</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Activity Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Activity Trends (Last 7 Days)
            </CardTitle>
            <CardDescription>Daily login and activity counts</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <LineChart data={activityTrends}>
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="logins" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "hsl(var(--muted-foreground))" }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Most Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4" />
              Most Active Team Members
            </CardTitle>
            <CardDescription>By total activity count</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {mostActiveUsers.length > 0 ? (
                <div className="space-y-3">
                  {mostActiveUsers.map((user, index) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? "bg-yellow-500 text-white" :
                          index === 1 ? "bg-gray-400 text-white" :
                          index === 2 ? "bg-orange-600 text-white" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{user.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {user.role.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{user.count}</span>
                        <p className="text-xs text-muted-foreground">activities</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Activity by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Activity Breakdown
          </CardTitle>
          <CardDescription>Distribution by action type</CardDescription>
        </CardHeader>
        <CardContent>
          {activityTypeData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[150px]">
              <BarChart data={activityTypeData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="type" 
                  tickLine={false} 
                  axisLine={false}
                  width={100}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No activities to display</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
