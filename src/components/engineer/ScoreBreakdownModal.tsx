import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Clock, Edit3, RefreshCw, Trophy, Zap, Target, CheckCircle } from "lucide-react";

interface ScoreBreakdown {
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
}

interface ScoreBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  finalScore: number | null;
  breakdown: ScoreBreakdown | null;
  basePoints: number;
}

function ScoreBar({ 
  label, 
  score, 
  maxScore, 
  icon: Icon,
  description 
}: { 
  label: string; 
  score: number; 
  maxScore: number;
  icon: React.ElementType;
  description: string;
}) {
  const percentage = (score / maxScore) * 100;
  const getColor = () => {
    if (percentage >= 80) return "bg-chart-2";
    if (percentage >= 60) return "bg-chart-4";
    if (percentage >= 40) return "bg-chart-1";
    return "bg-destructive";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{label}</span>
        </div>
        <span className="font-mono font-bold">{score}/{maxScore}</span>
      </div>
      <div className="h-3 bg-muted border border-border overflow-hidden">
        <div 
          className={`h-full ${getColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function ScoreBreakdownModal({
  open,
  onOpenChange,
  taskTitle,
  finalScore,
  breakdown,
  basePoints,
}: ScoreBreakdownModalProps) {
  const speedScore = breakdown?.speed_score ?? 0;
  const qualityScore = breakdown?.quality_score ?? 0;
  const efficiencyScore = breakdown?.efficiency_score ?? 0;
  const earnedPoints = breakdown?.earned_points ?? basePoints;
  const totalMinutes = breakdown?.total_minutes ?? 0;
  const promptEdits = breakdown?.prompt_edits ?? 0;
  const demoEdits = breakdown?.demo_edits ?? 0;
  const promptRejections = breakdown?.prompt_rejections ?? 0;
  const demoRejections = breakdown?.demo_rejections ?? 0;

  const totalEdits = promptEdits + demoEdits;
  const totalRejections = promptRejections + demoRejections;

  const getOverallGrade = () => {
    if (finalScore === null) return { grade: "N/A", color: "text-muted-foreground" };
    if (finalScore >= 90) return { grade: "A+", color: "text-chart-2" };
    if (finalScore >= 80) return { grade: "A", color: "text-chart-2" };
    if (finalScore >= 70) return { grade: "B", color: "text-chart-4" };
    if (finalScore >= 60) return { grade: "C", color: "text-chart-1" };
    if (finalScore >= 50) return { grade: "D", color: "text-orange-500" };
    return { grade: "F", color: "text-destructive" };
  };

  const grade = getOverallGrade();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-chart-4" />
            Score Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Title */}
          <div className="p-3 bg-muted border-2 border-border">
            <p className="font-medium truncate">{taskTitle}</p>
          </div>

          {/* Overall Score */}
          <div className="text-center p-4 border-2 border-border bg-card">
            <div className="flex items-center justify-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Final Score</p>
                <p className={`text-4xl font-bold ${grade.color}`}>
                  {finalScore ?? 0}%
                </p>
              </div>
              <div className="h-16 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Grade</p>
                <p className={`text-4xl font-bold ${grade.color}`}>
                  {grade.grade}
                </p>
              </div>
            </div>
          </div>

          {/* Score Components */}
          <div className="space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Score Components
            </h3>

            <ScoreBar
              label="Speed"
              score={speedScore}
              maxScore={35}
              icon={Zap}
              description={`Completed in ${totalMinutes} minutes. Faster completion = higher score.`}
            />

            <ScoreBar
              label="Quality"
              score={qualityScore}
              maxScore={35}
              icon={Edit3}
              description={`${totalEdits} total edits (${promptEdits} prompt, ${demoEdits} demo). Fewer edits = higher score.`}
            />

            <ScoreBar
              label="Efficiency"
              score={efficiencyScore}
              maxScore={30}
              icon={RefreshCw}
              description={`${totalRejections} rejections (${promptRejections} prompt, ${demoRejections} demo). Fewer rejections = higher score.`}
            />
          </div>

          {/* Points Earned */}
          <div className="p-4 bg-primary/10 border-2 border-primary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-bold">Points Earned</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono">{earnedPoints}</span>
                {earnedPoints !== basePoints && (
                  <span className="text-sm text-muted-foreground ml-1">
                    / {basePoints}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Points = Base Points × (Final Score / 100)
            </p>
          </div>

          {/* Calculation Formula */}
          <div className="p-3 bg-muted border border-border text-xs text-muted-foreground">
            <p className="font-medium mb-1">How it's calculated:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Speed (35 pts): Based on total time from pick to completion</li>
              <li>Quality (35 pts): -5 pts per edit (prompt or demo)</li>
              <li>Efficiency (30 pts): -10 pts per rejection</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
