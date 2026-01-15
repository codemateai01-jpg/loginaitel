import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Clock,
  CheckCircle,
  Star,
  Flame,
  Crown,
  Eye,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoreBreakdownModal } from "@/components/engineer/ScoreBreakdownModal";
interface EngineerRanking {
  engineer_id: string;
  total_points: number;
  profile?: {
    email: string;
    full_name: string | null;
  };
  rank: number;
  tasks_completed?: number;
}

interface CompletedTask {
  id: string;
  title: string;
  points: number;
  completed_at: string;
  description: string | null;
  final_score: number | null;
  score_breakdown: {
    speed_score?: number;
    quality_score?: number;
    efficiency_score?: number;
    earned_points?: number;
    base_points?: number;
    total_minutes?: number;
    prompt_edits?: number;
    demo_edits?: number;
    prompt_rejections?: number;
    demo_rejections?: number;
  } | null;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-chart-4/20 border-2 border-chart-4">
        <Trophy className="h-5 w-5 text-chart-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-muted border-2 border-muted-foreground">
        <Medal className="h-5 w-5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-chart-5/20 border-2 border-chart-5">
        <Award className="h-5 w-5 text-chart-5" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 flex items-center justify-center border-2 border-border font-bold">
      {rank}
    </div>
  );
}

function getRankBadgeIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-chart-4" />;
  if (rank <= 3) return <Flame className="h-4 w-4 text-chart-5" />;
  if (rank <= 5) return <Star className="h-4 w-4 text-chart-1" />;
  return null;
}

export default function EngineerLeaderboard() {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<CompletedTask | null>(null);

  // Fetch all-time leaderboard
  const { data: allTimeRankings, isLoading: allTimeLoading } = useQuery({
    queryKey: ["engineer-leaderboard-all-time"],
    queryFn: async () => {
      const { data: points, error } = await supabase
        .from("engineer_points")
        .select("*")
        .order("total_points", { ascending: false });

      if (error) throw error;

      // Get profiles
      const engineerIds = points?.map((p) => p.engineer_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", engineerIds);

      // Get completed task counts
      const { data: taskCounts } = await supabase
        .from("tasks")
        .select("assigned_to")
        .eq("status", "completed")
        .in("assigned_to", engineerIds);

      const countByEngineer: Record<string, number> = {};
      taskCounts?.forEach((t) => {
        if (t.assigned_to) {
          countByEngineer[t.assigned_to] = (countByEngineer[t.assigned_to] || 0) + 1;
        }
      });

      const rankings: EngineerRanking[] = (points || []).map((p, index) => ({
        ...p,
        rank: index + 1,
        profile: profiles?.find((pr) => pr.user_id === p.engineer_id),
        tasks_completed: countByEngineer[p.engineer_id] || 0,
      }));

      return rankings;
    },
  });

  // Fetch weekly points from point_transactions
  const { data: weeklyRankings } = useQuery({
    queryKey: ["engineer-leaderboard-weekly"],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();

      const { data: transactions, error } = await supabase
        .from("point_transactions")
        .select("engineer_id, points")
        .gte("created_at", weekStart);

      if (error) throw error;

      // Aggregate points by engineer
      const pointsByEngineer: Record<string, number> = {};
      transactions?.forEach((t) => {
        pointsByEngineer[t.engineer_id] = (pointsByEngineer[t.engineer_id] || 0) + t.points;
      });

      // Get profiles
      const engineerIds = Object.keys(pointsByEngineer);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", engineerIds);

      // Sort and rank
      const rankings: EngineerRanking[] = Object.entries(pointsByEngineer)
        .sort(([, a], [, b]) => b - a)
        .map(([engineer_id, total_points], index) => ({
          engineer_id,
          total_points,
          rank: index + 1,
          profile: profiles?.find((p) => p.user_id === engineer_id),
        }));

      return rankings;
    },
  });

  // Fetch monthly rankings
  const { data: monthlyRankings } = useQuery({
    queryKey: ["engineer-leaderboard-monthly"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();

      const { data: transactions, error } = await supabase
        .from("point_transactions")
        .select("engineer_id, points")
        .gte("created_at", monthStart);

      if (error) throw error;

      const pointsByEngineer: Record<string, number> = {};
      transactions?.forEach((t) => {
        pointsByEngineer[t.engineer_id] = (pointsByEngineer[t.engineer_id] || 0) + t.points;
      });

      const engineerIds = Object.keys(pointsByEngineer);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", engineerIds);

      const rankings: EngineerRanking[] = Object.entries(pointsByEngineer)
        .sort(([, a], [, b]) => b - a)
        .map(([engineer_id, total_points], index) => ({
          engineer_id,
          total_points,
          rank: index + 1,
          profile: profiles?.find((p) => p.user_id === engineer_id),
        }));

      return rankings;
    },
  });

  // Fetch current user's stats
  const { data: myStats } = useQuery({
    queryKey: ["engineer-my-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get total points
      const { data: points } = await supabase
        .from("engineer_points")
        .select("total_points")
        .eq("engineer_id", user!.id)
        .maybeSingle();

      // Get weekly points
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const { data: weeklyTx } = await supabase
        .from("point_transactions")
        .select("points")
        .eq("engineer_id", user!.id)
        .gte("created_at", weekStart);

      const weeklyPoints = weeklyTx?.reduce((sum, t) => sum + t.points, 0) || 0;

      // Get last week's points for comparison
      const lastWeekStart = subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7).toISOString();
      const lastWeekEnd = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const { data: lastWeekTx } = await supabase
        .from("point_transactions")
        .select("points")
        .eq("engineer_id", user!.id)
        .gte("created_at", lastWeekStart)
        .lt("created_at", lastWeekEnd);

      const lastWeekPoints = lastWeekTx?.reduce((sum, t) => sum + t.points, 0) || 0;

      // Get completed tasks count
      const { count: completedTasks } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", user!.id)
        .eq("status", "completed");

      // Get weekly rank
      const weeklyRank = weeklyRankings?.find((r) => r.engineer_id === user!.id)?.rank || 0;

      // Calculate change percentage
      const changePercent = lastWeekPoints > 0 
        ? Math.round(((weeklyPoints - lastWeekPoints) / lastWeekPoints) * 100)
        : weeklyPoints > 0 ? 100 : 0;

      return {
        totalPoints: points?.total_points || 0,
        weeklyPoints,
        weeklyRank,
        completedTasks: completedTasks || 0,
        changePercent,
      };
    },
  });

  // Fetch user's completed tasks history
  const { data: taskHistory } = useQuery({
    queryKey: ["engineer-task-history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, points, completed_at, description, final_score, score_breakdown")
        .eq("assigned_to", user!.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as CompletedTask[];
    },
  });

  const renderLeaderboard = (rankings: EngineerRanking[] | undefined, loading: boolean) => {
    if (loading) {
      return (
        <div className="p-8 text-center text-muted-foreground">
          Loading rankings...
        </div>
      );
    }

    if (!rankings || rankings.length === 0) {
      return (
        <div className="p-8 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No rankings yet</p>
          <p className="text-sm text-muted-foreground">Complete tasks to earn points!</p>
        </div>
      );
    }

    return (
      <div className="divide-y-2 divide-border">
        {rankings.map((engineer) => {
          const isCurrentUser = engineer.engineer_id === user?.id;
          return (
            <div
              key={engineer.engineer_id}
              className={`p-4 flex items-center justify-between ${
                isCurrentUser ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <RankBadge rank={engineer.rank} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isCurrentUser ? "font-bold" : ""}`}>
                      {engineer.profile?.full_name || engineer.profile?.email || "Unknown"}
                    </span>
                    {getRankBadgeIcon(engineer.rank)}
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground">(You)</span>
                    )}
                  </div>
                  {engineer.tasks_completed !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      {engineer.tasks_completed} tasks completed
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-lg">{engineer.total_points.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
          <p className="text-muted-foreground">
            See how you rank against other prompt engineers
          </p>
        </div>

        {/* Your Stats */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5" />
            <h2 className="font-bold">Your Performance</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold">
                {myStats?.weeklyRank ? `#${myStats.weeklyRank}` : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Weekly Rank</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{myStats?.weeklyPoints?.toLocaleString() || 0}</p>
              <p className="text-sm text-muted-foreground">Weekly Points</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{myStats?.totalPoints?.toLocaleString() || 0}</p>
              <p className="text-sm text-muted-foreground">Total Points</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{myStats?.completedTasks || 0}</p>
              <p className="text-sm text-muted-foreground">Tasks Completed</p>
            </div>
            <div>
              <p className={`text-3xl font-bold ${
                (myStats?.changePercent || 0) >= 0 ? "text-chart-2" : "text-destructive"
              }`}>
                {(myStats?.changePercent || 0) >= 0 ? "+" : ""}
                {myStats?.changePercent || 0}%
              </p>
              <p className="text-sm text-muted-foreground">vs Last Week</p>
            </div>
          </div>
        </div>

        {/* Leaderboard Tabs */}
        <Tabs defaultValue="weekly" className="space-y-6">
          <TabsList className="border-2 border-border bg-card p-1">
            <TabsTrigger 
              value="weekly" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Clock className="h-4 w-4" />
              Weekly
            </TabsTrigger>
            <TabsTrigger 
              value="monthly" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Star className="h-4 w-4" />
              Monthly
            </TabsTrigger>
            <TabsTrigger 
              value="all-time" 
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Trophy className="h-4 w-4" />
              All Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            <div className="border-2 border-border bg-card">
              <div className="p-4 border-b-2 border-border">
                <h3 className="font-bold">Weekly Rankings</h3>
                <p className="text-sm text-muted-foreground">Points earned this week</p>
              </div>
              {renderLeaderboard(weeklyRankings, false)}
            </div>
          </TabsContent>

          <TabsContent value="monthly">
            <div className="border-2 border-border bg-card">
              <div className="p-4 border-b-2 border-border">
                <h3 className="font-bold">Monthly Rankings</h3>
                <p className="text-sm text-muted-foreground">Points earned this month</p>
              </div>
              {renderLeaderboard(monthlyRankings, false)}
            </div>
          </TabsContent>

          <TabsContent value="all-time">
            <div className="border-2 border-border bg-card">
              <div className="p-4 border-b-2 border-border">
                <h3 className="font-bold">All-Time Rankings</h3>
                <p className="text-sm text-muted-foreground">Lifetime points accumulated</p>
              </div>
              {renderLeaderboard(allTimeRankings, allTimeLoading)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Task History */}
        <div className="border-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-chart-2" />
            <h2 className="font-bold">Your Completed Tasks</h2>
          </div>
          {taskHistory && taskHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Task</TableHead>
                  <TableHead className="font-bold text-center">Score</TableHead>
                  <TableHead className="font-bold text-right">Points Earned</TableHead>
                  <TableHead className="font-bold">Completed</TableHead>
                  <TableHead className="font-bold text-center">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskHistory.map((task) => {
                  const breakdown = task.score_breakdown as CompletedTask['score_breakdown'];
                  const earnedPoints = breakdown?.earned_points || task.points;
                  const basePoints = breakdown?.base_points || task.points;
                  
                  return (
                    <TableRow key={task.id} className="border-b-2 border-border">
                      <TableCell>
                        <div>
                          <p className="font-medium">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {task.final_score !== null ? (
                          <div className="inline-flex items-center gap-1">
                            <span className={`font-mono font-bold ${
                              task.final_score >= 90 ? "text-chart-2" :
                              task.final_score >= 70 ? "text-chart-4" :
                              task.final_score >= 50 ? "text-chart-5" :
                              "text-destructive"
                            }`}>
                              {task.final_score}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <span className="font-mono font-bold text-chart-2">+{earnedPoints}</span>
                          {earnedPoints !== basePoints && (
                            <span className="text-xs text-muted-foreground ml-1">
                              / {basePoints}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.completed_at
                          ? format(new Date(task.completed_at), "MMM d, yyyy HH:mm")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTask(task)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No completed tasks yet</p>
              <p className="text-sm text-muted-foreground">Complete tasks to see them here</p>
            </div>
          )}
        </div>

        {/* Score Breakdown Modal */}
        <ScoreBreakdownModal
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          taskTitle={selectedTask?.title || ""}
          finalScore={selectedTask?.final_score ?? null}
          breakdown={selectedTask?.score_breakdown ?? null}
          basePoints={selectedTask?.points || 0}
        />
      </div>
    </DashboardLayout>
  );
}
