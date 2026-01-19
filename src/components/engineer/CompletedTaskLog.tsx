import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  FileText, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Star,
  Trophy,
  Timer,
  Edit3,
  History,
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import { format, differenceInMinutes } from "date-fns";

interface ScoreBreakdown {
  speed_score?: number;
  quality_score?: number;
  efficiency_score?: number;
  earned_points?: number;
  base_points?: number;
  total_time_minutes?: number;
  prompt_time_minutes?: number;
  demo_time_minutes?: number;
  waiting_minutes?: number;
  prompt_edit_count?: number;
  demo_edit_count?: number;
  prompt_rejection_count?: number;
  demo_rejection_count?: number;
}

interface Task {
  id: string;
  title: string;
  points: number;
  final_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  picked_at: string | null;
  prompt_started_at: string | null;
  prompt_submitted_at: string | null;
  prompt_approved_at: string | null;
  demo_started_at: string | null;
  demo_completed_at: string | null;
  completed_at: string | null;
  prompt_edit_count: number | null;
  demo_edit_count: number | null;
  prompt_rejection_count: number | null;
  demo_rejection_count: number | null;
}

interface CompletedTaskLogProps {
  task: Task;
}

export function CompletedTaskLog({ task }: CompletedTaskLogProps) {
  const breakdown = task.score_breakdown || {};
  
  // Fetch prompt edit history for this task
  const { data: editHistory = [] } = useQuery({
    queryKey: ["task-edit-history", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prompt_edit_history")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Calculate time durations
  const promptDuration = task.prompt_started_at && task.prompt_approved_at
    ? differenceInMinutes(new Date(task.prompt_approved_at), new Date(task.prompt_started_at))
    : breakdown.prompt_time_minutes || 0;

  const demoDuration = task.demo_started_at && task.demo_completed_at
    ? differenceInMinutes(new Date(task.demo_completed_at), new Date(task.demo_started_at))
    : breakdown.demo_time_minutes || 0;

  const totalDuration = task.picked_at && task.completed_at
    ? differenceInMinutes(new Date(task.completed_at), new Date(task.picked_at))
    : breakdown.total_time_minutes || 0;

  const waitingTime = breakdown.waiting_minutes || 0;

  // Get actual scores from breakdown
  const speedScore = breakdown.speed_score ?? 0;
  const qualityScore = breakdown.quality_score ?? 0;
  const efficiencyScore = breakdown.efficiency_score ?? 0;
  const earnedPoints = breakdown.earned_points ?? task.points;

  const getScoreGrade = (score: number) => {
    if (score >= 90) return { grade: "A+", color: "text-chart-2" };
    if (score >= 80) return { grade: "A", color: "text-chart-2" };
    if (score >= 70) return { grade: "B", color: "text-chart-4" };
    if (score >= 60) return { grade: "C", color: "text-chart-3" };
    if (score >= 50) return { grade: "D", color: "text-destructive" };
    return { grade: "F", color: "text-destructive" };
  };

  const scoreGrade = task.final_score ? getScoreGrade(task.final_score) : null;

  return (
    <div className="space-y-4">
      {/* Score Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border-2 border-chart-2 bg-chart-2/10 p-3 text-center">
          <Trophy className="h-5 w-5 mx-auto mb-1 text-chart-2" />
          <p className="text-2xl font-bold text-chart-2">+{earnedPoints}</p>
          <p className="text-xs text-muted-foreground">Points Earned</p>
        </div>
        <div className="border-2 border-chart-4 bg-chart-4/10 p-3 text-center">
          <Star className="h-5 w-5 mx-auto mb-1 text-chart-4" />
          <p className="text-2xl font-bold text-chart-4">
            {task.final_score ?? 0}%
            {scoreGrade && <span className="text-sm ml-1">({scoreGrade.grade})</span>}
          </p>
          <p className="text-xs text-muted-foreground">Final Score</p>
        </div>
        <div className="border-2 border-border bg-muted/50 p-3 text-center">
          <Timer className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold">{totalDuration}m</p>
          <p className="text-xs text-muted-foreground">Total Time</p>
        </div>
        <div className="border-2 border-border bg-muted/50 p-3 text-center">
          <Edit3 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold">{editHistory.length}</p>
          <p className="text-xs text-muted-foreground">Total Edits</p>
        </div>
      </div>

      {/* Score Breakdown Details */}
      <div className="border-2 border-border p-4 space-y-3">
        <h4 className="font-bold flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Score Analysis
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Speed</span>
              <span className="font-mono font-bold">{speedScore}/40</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-chart-4 transition-all"
                style={{ width: `${(speedScore / 40) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Efficiency</span>
              <span className="font-mono font-bold">{efficiencyScore}/30</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-chart-3 transition-all"
                style={{ width: `${(efficiencyScore / 30) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Quality</span>
              <span className="font-mono font-bold">{qualityScore}/30</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-chart-2 transition-all"
                style={{ width: `${(qualityScore / 30) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Time Breakdown */}
      <div className="border-2 border-border p-4 space-y-3">
        <h4 className="font-bold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Breakdown
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-chart-4" />
            <div>
              <p className="font-medium">{promptDuration}m</p>
              <p className="text-xs text-muted-foreground">Prompt Phase</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-chart-5" />
            <div>
              <p className="font-medium">{demoDuration}m</p>
              <p className="text-xs text-muted-foreground">Demo Phase</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{waitingTime}m</p>
              <p className="text-xs text-muted-foreground">Waiting for Approval</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-chart-2" />
            <div>
              <p className="font-medium">{totalDuration}m</p>
              <p className="text-xs text-muted-foreground">Total Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Edit & Rejection Stats */}
      <div className="border-2 border-border p-4 space-y-3">
        <h4 className="font-bold flex items-center gap-2">
          <History className="h-4 w-4" />
          Edit & Revision History
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-chart-4" />
            <div>
              <p className="font-medium">{task.prompt_edit_count || 0}</p>
              <p className="text-xs text-muted-foreground">Prompt Edits</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-chart-5" />
            <div>
              <p className="font-medium">{task.demo_edit_count || 0}</p>
              <p className="text-xs text-muted-foreground">Demo Edits</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium">{task.prompt_rejection_count || 0}</p>
              <p className="text-xs text-muted-foreground">Prompt Rejections</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium">{task.demo_rejection_count || 0}</p>
              <p className="text-xs text-muted-foreground">Demo Rejections</p>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Edit Timeline */}
      {editHistory.length > 0 && (
        <div className="border-2 border-border p-4 space-y-3">
          <h4 className="font-bold flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Prompt Changes Timeline
          </h4>
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {editHistory.map((edit, idx) => (
                <div
                  key={edit.id}
                  className="border-l-2 border-chart-4 pl-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Edit #{idx + 1}</span>
                    <Badge variant="outline" className="text-xs">
                      {edit.edit_phase || "development"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(edit.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {edit.previous_prompt && edit.new_prompt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Changed {Math.abs(edit.new_prompt.length - edit.previous_prompt.length)} characters
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Timestamps */}
      <div className="border-2 border-dashed border-border p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground mb-2">Task Timeline</p>
        {task.picked_at && (
          <p>📋 Picked: {format(new Date(task.picked_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
        {task.prompt_started_at && (
          <p>✏️ Prompt Started: {format(new Date(task.prompt_started_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
        {task.prompt_submitted_at && (
          <p>📤 Prompt Submitted: {format(new Date(task.prompt_submitted_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
        {task.prompt_approved_at && (
          <p>✅ Prompt Approved: {format(new Date(task.prompt_approved_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
        {task.demo_started_at && (
          <p>📞 Demo Started: {format(new Date(task.demo_started_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
        {task.demo_completed_at && (
          <p>🎙️ Demo Completed: {format(new Date(task.demo_completed_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
        {task.completed_at && (
          <p>🏆 Task Completed: {format(new Date(task.completed_at), "MMM d, yyyy 'at' h:mm a")}</p>
        )}
      </div>
    </div>
  );
}