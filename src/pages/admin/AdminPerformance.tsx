import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Trophy,
  TrendingUp,
  Users,
  Target,
  CheckCircle,
  AlertCircle,
  Eye,
  Zap,
  Edit3,
  RefreshCw,
  Calendar,
  Coffee,
} from "lucide-react";
import { format, startOfWeek, startOfMonth, subDays, differenceInMinutes } from "date-fns";

interface EngineerPerformance {
  engineer_id: string;
  email: string;
  full_name: string | null;
  total_points: number;
  tasks_completed: number;
  avg_score: number;
  avg_speed_score: number;
  avg_quality_score: number;
  avg_efficiency_score: number;
  total_work_hours: number;
  total_break_hours: number;
  productive_hours: number;
  days_worked: number;
  avg_hours_per_day: number;
  total_rejections: number;
  total_edits: number;
}

interface TaskDetail {
  id: string;
  title: string;
  completed_at: string;
  final_score: number | null;
  points: number;
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

interface TimeEntryDetail {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  total_break_minutes: number | null;
  productive_minutes: number | null;
  status: string;
}

const TARGET_HOURS_PER_DAY = 8;

export default function AdminPerformance() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("week");
  const [selectedEngineer, setSelectedEngineer] = useState<EngineerPerformance | null>(null);
  const [detailsTab, setDetailsTab] = useState<"tasks" | "time">("tasks");

  const getPeriodStart = () => {
    if (period === "week") return startOfWeek(new Date(), { weekStartsOn: 1 });
    if (period === "month") return startOfMonth(new Date());
    return subDays(new Date(), 365);
  };

  // Fetch all engineers' performance data
  const { data: engineers = [], isLoading } = useQuery({
    queryKey: ["admin-performance", period],
    queryFn: async () => {
      const periodStart = getPeriodStart().toISOString();

      // Get all engineers
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "engineer");

      const engineerIds = roles?.map((r) => r.user_id) || [];
      if (engineerIds.length === 0) return [];

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .in("user_id", engineerIds);

      // Get points
      const { data: points } = await supabase
        .from("engineer_points")
        .select("engineer_id, total_points")
        .in("engineer_id", engineerIds);

      // Get completed tasks in period
      const { data: tasks } = await supabase
        .from("tasks")
        .select("assigned_to, final_score, points, score_breakdown, prompt_edit_count, demo_edit_count, prompt_rejection_count, demo_rejection_count")
        .in("assigned_to", engineerIds)
        .eq("status", "completed")
        .gte("completed_at", periodStart);

      // Get time entries in period
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("*")
        .in("engineer_id", engineerIds)
        .gte("check_in_time", periodStart);

      // Aggregate data per engineer
      const engineerData: EngineerPerformance[] = (profiles || []).map((profile) => {
        const pointsRecord = points?.find((p) => p.engineer_id === profile.user_id);
        const userTasks = tasks?.filter((t) => t.assigned_to === profile.user_id) || [];
        const userTimeEntries = timeEntries?.filter((te) => te.engineer_id === profile.user_id) || [];

        // Calculate task stats
        const tasksWithScores = userTasks.filter((t) => t.final_score !== null);
        const avgScore = tasksWithScores.length > 0
          ? tasksWithScores.reduce((sum, t) => sum + (t.final_score || 0), 0) / tasksWithScores.length
          : 0;

        let totalSpeedScore = 0;
        let totalQualityScore = 0;
        let totalEfficiencyScore = 0;
        let totalRejections = 0;
        let totalEdits = 0;

        userTasks.forEach((t) => {
          const breakdown = t.score_breakdown as TaskDetail["score_breakdown"];
          if (breakdown) {
            totalSpeedScore += breakdown.speed_score || 0;
            totalQualityScore += breakdown.quality_score || 0;
            totalEfficiencyScore += breakdown.efficiency_score || 0;
          }
          totalRejections += (t.prompt_rejection_count || 0) + (t.demo_rejection_count || 0);
          totalEdits += (t.prompt_edit_count || 0) + (t.demo_edit_count || 0);
        });

        // Calculate time stats
        let totalWorkMinutes = 0;
        let totalBreakMinutes = 0;
        const uniqueDays = new Set<string>();

        userTimeEntries.forEach((entry) => {
          const checkIn = new Date(entry.check_in_time);
          const checkOut = entry.check_out_time ? new Date(entry.check_out_time) : null;
          
          if (checkOut) {
            const workMinutes = differenceInMinutes(checkOut, checkIn);
            totalWorkMinutes += workMinutes;
            totalBreakMinutes += entry.total_break_minutes || 0;
          }
          
          uniqueDays.add(format(checkIn, "yyyy-MM-dd"));
        });

        const productiveMinutes = totalWorkMinutes - totalBreakMinutes;
        const daysWorked = uniqueDays.size;

        return {
          engineer_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          total_points: pointsRecord?.total_points || 0,
          tasks_completed: userTasks.length,
          avg_score: Math.round(avgScore),
          avg_speed_score: tasksWithScores.length > 0 ? Math.round(totalSpeedScore / tasksWithScores.length) : 0,
          avg_quality_score: tasksWithScores.length > 0 ? Math.round(totalQualityScore / tasksWithScores.length) : 0,
          avg_efficiency_score: tasksWithScores.length > 0 ? Math.round(totalEfficiencyScore / tasksWithScores.length) : 0,
          total_work_hours: Math.round((totalWorkMinutes / 60) * 10) / 10,
          total_break_hours: Math.round((totalBreakMinutes / 60) * 10) / 10,
          productive_hours: Math.round((productiveMinutes / 60) * 10) / 10,
          days_worked: daysWorked,
          avg_hours_per_day: daysWorked > 0 ? Math.round((productiveMinutes / 60 / daysWorked) * 10) / 10 : 0,
          total_rejections: totalRejections,
          total_edits: totalEdits,
        };
      });

      return engineerData.sort((a, b) => b.avg_score - a.avg_score);
    },
  });

  // Fetch selected engineer's detailed tasks
  const { data: engineerTasks = [] } = useQuery({
    queryKey: ["engineer-tasks-detail", selectedEngineer?.engineer_id, period],
    enabled: !!selectedEngineer,
    queryFn: async () => {
      const periodStart = getPeriodStart().toISOString();
      const { data } = await supabase
        .from("tasks")
        .select("id, title, completed_at, final_score, points, score_breakdown")
        .eq("assigned_to", selectedEngineer!.engineer_id)
        .eq("status", "completed")
        .gte("completed_at", periodStart)
        .order("completed_at", { ascending: false });

      return (data || []) as TaskDetail[];
    },
  });

  // Fetch selected engineer's time entries
  const { data: engineerTimeEntries = [] } = useQuery({
    queryKey: ["engineer-time-detail", selectedEngineer?.engineer_id, period],
    enabled: !!selectedEngineer,
    queryFn: async () => {
      const periodStart = getPeriodStart().toISOString();
      const { data } = await supabase
        .from("time_entries")
        .select("id, check_in_time, check_out_time, total_break_minutes, productive_minutes, status")
        .eq("engineer_id", selectedEngineer!.engineer_id)
        .gte("check_in_time", periodStart)
        .order("check_in_time", { ascending: false });

      return (data || []) as TimeEntryDetail[];
    },
  });

  // Calculate team totals
  const teamStats = {
    totalEngineers: engineers.length,
    totalTasks: engineers.reduce((sum, e) => sum + e.tasks_completed, 0),
    totalPoints: engineers.reduce((sum, e) => sum + e.total_points, 0),
    avgScore: engineers.length > 0
      ? Math.round(engineers.reduce((sum, e) => sum + e.avg_score, 0) / engineers.length)
      : 0,
    totalProductiveHours: engineers.reduce((sum, e) => sum + e.productive_hours, 0),
    avgHoursPerEngineer: engineers.length > 0
      ? Math.round((engineers.reduce((sum, e) => sum + e.productive_hours, 0) / engineers.length) * 10) / 10
      : 0,
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-chart-2";
    if (score >= 60) return "text-chart-4";
    if (score >= 40) return "text-chart-1";
    return "text-destructive";
  };

  const getProductivityColor = (hours: number, target: number) => {
    const ratio = hours / target;
    if (ratio >= 0.9) return "bg-chart-2";
    if (ratio >= 0.7) return "bg-chart-4";
    if (ratio >= 0.5) return "bg-chart-1";
    return "bg-destructive";
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Team Performance</h1>
            <p className="text-muted-foreground">
              Monitor engineer productivity and quality metrics
            </p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-40 border-2">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Engineers</span>
            </div>
            <p className="text-2xl font-bold">{teamStats.totalEngineers}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Tasks Done</span>
            </div>
            <p className="text-2xl font-bold">{teamStats.totalTasks}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              <span className="text-xs">Total Points</span>
            </div>
            <p className="text-2xl font-bold">{teamStats.totalPoints.toLocaleString()}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs">Avg Score</span>
            </div>
            <p className={`text-2xl font-bold ${getScoreColor(teamStats.avgScore)}`}>
              {teamStats.avgScore}%
            </p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Total Hours</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(teamStats.totalProductiveHours)}h</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Avg Hours/Eng</span>
            </div>
            <p className="text-2xl font-bold">{teamStats.avgHoursPerEngineer}h</p>
          </div>
        </div>

        {/* Performance Table */}
        <div className="border-2 border-border bg-card">
          <div className="p-4 border-b-2 border-border">
            <h2 className="font-bold">Individual Performance</h2>
            <p className="text-sm text-muted-foreground">Click on an engineer to see detailed breakdown</p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading performance data...</div>
          ) : engineers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-bold">No Engineers Found</p>
              <p className="text-sm text-muted-foreground">Add engineers to see performance metrics</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-bold">Engineer</TableHead>
                  <TableHead className="font-bold text-center">Score</TableHead>
                  <TableHead className="font-bold text-center">Tasks</TableHead>
                  <TableHead className="font-bold text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="h-3 w-3" /> Speed
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Edit3 className="h-3 w-3" /> Quality
                    </div>
                  </TableHead>
                  <TableHead className="font-bold text-center">
                    <div className="flex items-center justify-center gap-1">
                      <RefreshCw className="h-3 w-3" /> Efficiency
                    </div>
                  </TableHead>
                  <TableHead className="font-bold">Productivity</TableHead>
                  <TableHead className="font-bold text-center">Days</TableHead>
                  <TableHead className="font-bold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engineers.map((engineer) => {
                  const productivityPercent = engineer.days_worked > 0
                    ? Math.min((engineer.avg_hours_per_day / TARGET_HOURS_PER_DAY) * 100, 100)
                    : 0;

                  return (
                    <TableRow key={engineer.engineer_id} className="border-b-2 border-border">
                      <TableCell>
                        <div>
                          <p className="font-medium">{engineer.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{engineer.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`font-mono ${getScoreColor(engineer.avg_score)}`}
                        >
                          {engineer.avg_score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono">{engineer.tasks_completed}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono ${getScoreColor((engineer.avg_speed_score / 35) * 100)}`}>
                          {engineer.avg_speed_score}/35
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono ${getScoreColor((engineer.avg_quality_score / 35) * 100)}`}>
                          {engineer.avg_quality_score}/35
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-mono ${getScoreColor((engineer.avg_efficiency_score / 30) * 100)}`}>
                          {engineer.avg_efficiency_score}/30
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-xs">
                            <span>{engineer.productive_hours}h</span>
                            <span className="text-muted-foreground">
                              avg {engineer.avg_hours_per_day}h/day
                            </span>
                          </div>
                          <div className="h-2 bg-muted border border-border overflow-hidden">
                            <div
                              className={`h-full ${getProductivityColor(engineer.avg_hours_per_day, TARGET_HOURS_PER_DAY)}`}
                              style={{ width: `${productivityPercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono">{engineer.days_worked}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEngineer(engineer)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Legend */}
        <div className="border-2 border-border bg-card p-4">
          <h3 className="font-bold mb-3">Scoring Guide</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Speed (35 pts max)</p>
                <p className="text-muted-foreground text-xs">Based on time from task pickup to completion</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Edit3 className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Quality (35 pts max)</p>
                <p className="text-muted-foreground text-xs">-5 pts per edit (prompt or demo)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RefreshCw className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Efficiency (30 pts max)</p>
                <p className="text-muted-foreground text-xs">-10 pts per rejection</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engineer Details Dialog */}
      <Dialog open={!!selectedEngineer} onOpenChange={(open) => !open && setSelectedEngineer(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedEngineer?.full_name || selectedEngineer?.email} - Detailed View
            </DialogTitle>
          </DialogHeader>

          {selectedEngineer && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="border-2 border-border p-3 text-center">
                  <p className={`text-2xl font-bold ${getScoreColor(selectedEngineer.avg_score)}`}>
                    {selectedEngineer.avg_score}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
                <div className="border-2 border-border p-3 text-center">
                  <p className="text-2xl font-bold">{selectedEngineer.tasks_completed}</p>
                  <p className="text-xs text-muted-foreground">Tasks</p>
                </div>
                <div className="border-2 border-border p-3 text-center">
                  <p className="text-2xl font-bold">{selectedEngineer.productive_hours}h</p>
                  <p className="text-xs text-muted-foreground">Productive</p>
                </div>
                <div className="border-2 border-border p-3 text-center">
                  <p className="text-2xl font-bold text-chart-4">{selectedEngineer.total_points}</p>
                  <p className="text-xs text-muted-foreground">Total Points</p>
                </div>
              </div>

              {/* Issues Summary */}
              <div className="flex gap-4 p-3 bg-muted border border-border">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">{selectedEngineer.total_rejections} rejections</span>
                </div>
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-chart-1" />
                  <span className="text-sm">{selectedEngineer.total_edits} edits</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedEngineer.total_break_hours}h breaks</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b-2 border-border">
                <Button
                  variant={detailsTab === "tasks" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDetailsTab("tasks")}
                >
                  Completed Tasks
                </Button>
                <Button
                  variant={detailsTab === "time" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDetailsTab("time")}
                >
                  Time Entries
                </Button>
              </div>

              {/* Tasks Tab */}
              {detailsTab === "tasks" && (
                <div className="border-2 border-border max-h-64 overflow-y-auto">
                  {engineerTasks.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No completed tasks in this period
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-border">
                          <TableHead className="font-bold">Task</TableHead>
                          <TableHead className="font-bold text-center">Score</TableHead>
                          <TableHead className="font-bold text-right">Points</TableHead>
                          <TableHead className="font-bold">Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {engineerTasks.map((task) => {
                          const breakdown = task.score_breakdown;
                          const earnedPoints = breakdown?.earned_points || task.points;

                          return (
                            <TableRow key={task.id} className="border-b border-border">
                              <TableCell className="font-medium">{task.title}</TableCell>
                              <TableCell className="text-center">
                                {task.final_score !== null ? (
                                  <span className={`font-mono ${getScoreColor(task.final_score)}`}>
                                    {task.final_score}%
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-chart-2">
                                +{earnedPoints}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(task.completed_at), "MMM d, HH:mm")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}

              {/* Time Tab */}
              {detailsTab === "time" && (
                <div className="border-2 border-border max-h-64 overflow-y-auto">
                  {engineerTimeEntries.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">
                      No time entries in this period
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-border">
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="font-bold">Check In</TableHead>
                          <TableHead className="font-bold">Check Out</TableHead>
                          <TableHead className="font-bold text-center">Break</TableHead>
                          <TableHead className="font-bold text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {engineerTimeEntries.map((entry) => {
                          const checkIn = new Date(entry.check_in_time);
                          const checkOut = entry.check_out_time ? new Date(entry.check_out_time) : null;

                          return (
                            <TableRow key={entry.id} className="border-b border-border">
                              <TableCell className="font-medium">
                                {format(checkIn, "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>{format(checkIn, "HH:mm")}</TableCell>
                              <TableCell>
                                {checkOut ? format(checkOut, "HH:mm") : "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                {entry.total_break_minutes || 0}m
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={entry.status === "active" ? "default" : "outline"}
                                >
                                  {entry.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
