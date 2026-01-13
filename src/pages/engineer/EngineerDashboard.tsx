import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import {
  ClipboardList,
  Trophy,
  Clock,
  CheckCircle,
  Play,
  Timer,
  Target,
  Loader2,
  Coffee,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { differenceInSeconds, differenceInMinutes } from "date-fns";

export default function EngineerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Engineer";
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch my points
  const { data: pointsData } = useQuery({
    queryKey: ["my-points", user?.id],
    queryFn: async () => {
      if (!user?.id) return { total_points: 0 };
      const { data, error } = await supabase
        .from("engineer_points")
        .select("total_points")
        .eq("engineer_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data || { total_points: 0 };
    },
    enabled: !!user?.id,
  });

  // Fetch my tasks
  const { data: myTasks = [] } = useQuery({
    queryKey: ["my-dashboard-tasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch active time entry
  const { data: activeTimeEntry } = useQuery({
    queryKey: ["active-time-entry-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("engineer_id", user.id)
        .gte("check_in_time", today.toISOString())
        .in("status", ["active", "on_break"])
        .order("check_in_time", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  // Fetch leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data: points, error } = await supabase
        .from("engineer_points")
        .select("engineer_id, total_points")
        .order("total_points", { ascending: false })
        .limit(5);
      if (error) throw error;

      const engineerIds = points?.map((p) => p.engineer_id) || [];
      if (engineerIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", engineerIds);

      return (points || []).map((p, index) => {
        const profile = profiles?.find((pr) => pr.user_id === p.engineer_id);
        return {
          rank: index + 1,
          name: profile?.full_name || profile?.email?.split("@")[0] || "Unknown",
          points: p.total_points,
          isCurrentUser: p.engineer_id === user?.id,
        };
      });
    },
  });

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("time_entries").insert({
        engineer_id: user?.id,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry-dashboard"] });
      toast({ title: "Checked In!", description: "Your work session has started." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to check in.", variant: "destructive" });
    },
  });

  // Start break mutation
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      if (!activeTimeEntry) throw new Error("No active entry");
      const { error } = await supabase
        .from("time_entries")
        .update({ status: "on_break", break_start_time: new Date().toISOString() })
        .eq("id", activeTimeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry-dashboard"] });
      toast({ title: "Break Started", description: "Enjoy your break!" });
    },
  });

  // End break mutation
  const endBreakMutation = useMutation({
    mutationFn: async () => {
      if (!activeTimeEntry?.break_start_time) throw new Error("No active break");
      const breakMinutes = differenceInMinutes(new Date(), new Date(activeTimeEntry.break_start_time));
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "active",
          break_end_time: new Date().toISOString(),
          total_break_minutes: (activeTimeEntry.total_break_minutes || 0) + breakMinutes,
        })
        .eq("id", activeTimeEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry-dashboard"] });
      toast({ title: "Break Ended", description: "Welcome back!" });
    },
  });

  // Calculate working time
  const getWorkingTime = () => {
    if (!activeTimeEntry) return "0h 0m";
    const checkIn = new Date(activeTimeEntry.check_in_time);
    let totalSeconds = differenceInSeconds(currentTime, checkIn);
    let breakSeconds = (activeTimeEntry.total_break_minutes || 0) * 60;
    if (activeTimeEntry.status === "on_break" && activeTimeEntry.break_start_time) {
      breakSeconds += differenceInSeconds(currentTime, new Date(activeTimeEntry.break_start_time));
    }
    totalSeconds -= breakSeconds;
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const activeTasks = myTasks.filter((t) => ["in_progress", "assigned", "pending"].includes(t.status) && t.assigned_to);
  const completedTasks = myTasks.filter((t) => ["approved", "completed"].includes(t.status));
  const pendingReviewTasks = myTasks.filter((t) => t.status === "submitted");
  const isOnBreak = activeTimeEntry?.status === "on_break";

  const stats = [
    {
      title: "My Points",
      value: pointsData?.total_points || 0,
      icon: <Trophy className="h-5 w-5" />,
      description: leaderboard.find((l) => l.isCurrentUser)?.rank
        ? `Rank #${leaderboard.find((l) => l.isCurrentUser)?.rank}`
        : "Keep earning!",
    },
    {
      title: "Tasks Completed",
      value: completedTasks.length,
      icon: <CheckCircle className="h-5 w-5" />,
      description: `${pendingReviewTasks.length} pending review`,
    },
    {
      title: "Active Tasks",
      value: activeTasks.length,
      icon: <ClipboardList className="h-5 w-5" />,
      description: "In progress",
    },
    {
      title: "Time Today",
      value: getWorkingTime(),
      icon: <Clock className="h-5 w-5" />,
      description: activeTimeEntry
        ? isOnBreak
          ? "On break"
          : "Working"
        : "Not checked in",
    },
  ];

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h1>
            <p className="text-muted-foreground">
              You're doing great. Keep it up!
            </p>
          </div>
          <div className="flex gap-3">
            {!activeTimeEntry ? (
              <Button
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
                className="shadow-sm"
              >
                <Play className="h-4 w-4 mr-2" />
                Check In
              </Button>
            ) : isOnBreak ? (
              <Button
                variant="outline"
                onClick={() => endBreakMutation.mutate()}
                disabled={endBreakMutation.isPending}
                className="shadow-xs"
              >
                <Play className="h-4 w-4 mr-2" />
                End Break
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => startBreakMutation.mutate()}
                disabled={startBreakMutation.isPending}
                className="shadow-xs"
              >
                <Coffee className="h-4 w-4 mr-2" />
                Start Break
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Tasks */}
          <div className="lg:col-span-2 border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                <h2 className="font-bold">Active Tasks</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/engineer/tasks")}>
                View All
              </Button>
            </div>
            <div className="divide-y-2 divide-border">
              {activeTasks.length === 0 ? (
                <div className="p-8 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium mb-2">No Active Tasks</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pick a task to start working
                  </p>
                  <Button onClick={() => navigate("/engineer/tasks")}>
                    Browse Tasks
                  </Button>
                </div>
              ) : (
                activeTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.points} points
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {task.status === "in_progress" ? "In Progress" : "Assigned"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="shadow-xs"
                      onClick={() => navigate("/engineer/tasks")}
                    >
                      Continue Working
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <h2 className="font-bold">Leaderboard</h2>
            </div>
            <div className="divide-y-2 divide-border">
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No rankings yet</p>
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`p-4 flex items-center justify-between ${
                      entry.isCurrentUser ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 flex items-center justify-center font-bold border-2 ${
                          entry.rank === 1
                            ? "bg-chart-4/20 border-chart-4"
                            : entry.rank === 2
                            ? "bg-muted border-muted-foreground"
                            : entry.rank === 3
                            ? "bg-chart-5/20 border-chart-5"
                            : "border-border"
                        }`}
                      >
                        {entry.rank}
                      </span>
                      <span className={entry.isCurrentUser ? "font-bold" : ""}>
                        {entry.isCurrentUser ? "You" : entry.name}
                      </span>
                    </div>
                    <span className="font-mono">{entry.points} pts</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5" />
            <h2 className="font-bold">Quick Actions</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/engineer/tasks")}
            >
              <ClipboardList className="h-6 w-6" />
              <span>Browse Tasks</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/engineer/agents")}
            >
              <Target className="h-6 w-6" />
              <span>My Workspace</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate("/engineer/time")}
            >
              <Clock className="h-6 w-6" />
              <span>Time Tracker</span>
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
