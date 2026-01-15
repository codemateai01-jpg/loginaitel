import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Bot,
  User,
  Trophy,
  Clock,
  Phone,
  Edit,
  Play,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DemoReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    title: string;
    description: string | null;
    points: number;
    assigned_to: string | null;
    selected_demo_call_id: string | null;
    picked_at: string | null;
    prompt_started_at: string | null;
    prompt_approved_at: string | null;
    demo_started_at: string | null;
    demo_edit_count: number | null;
    aitel_agents?: {
      agent_name: string;
    } | null;
  } | null;
  engineerName: string;
}

export function DemoReviewDialog({
  open,
  onOpenChange,
  task,
  engineerName,
}: DemoReviewDialogProps) {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [qualityScore, setQualityScore] = useState([30]);

  // Fetch the selected demo call
  const { data: demoCall } = useQuery({
    queryKey: ["demo-call", task?.selected_demo_call_id],
    queryFn: async () => {
      if (!task?.selected_demo_call_id) return null;
      const { data, error } = await supabase
        .from("demo_calls")
        .select("*")
        .eq("id", task.selected_demo_call_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!task?.selected_demo_call_id,
  });

  // Calculate score breakdown
  const calculateScore = () => {
    if (!task) return null;

    const promptTime = task.prompt_started_at && task.prompt_approved_at
      ? Math.floor(
          (new Date(task.prompt_approved_at).getTime() -
            new Date(task.prompt_started_at).getTime()) /
            60000
        )
      : 0;

    const totalTime = task.picked_at
      ? Math.floor(
          (Date.now() - new Date(task.picked_at).getTime()) / 60000
        )
      : 0;

    const demoEditCount = task.demo_edit_count || 0;

    // Time score (max 40) - faster = more points
    const timeScore = Math.max(0, 40 - Math.max(0, Math.floor((totalTime - 30) / 10)));

    // Edit score (max 30) - fewer demo edits = more points
    const editScore = Math.max(0, 30 - demoEditCount * 5);

    // Quality score from slider (max 30)
    const quality = qualityScore[0];

    return {
      timeScore,
      editScore,
      qualityScore: quality,
      totalScore: timeScore + editScore + quality,
      promptTime,
      totalTime,
      demoEditCount,
    };
  };

  const scoreBreakdown = calculateScore();

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!task || !scoreBreakdown) return;

      const breakdown = {
        time_score: scoreBreakdown.timeScore,
        edit_score: scoreBreakdown.editScore,
        demo_quality_score: scoreBreakdown.qualityScore,
        prompt_time_minutes: scoreBreakdown.promptTime,
        total_time_minutes: scoreBreakdown.totalTime,
        demo_edit_count: scoreBreakdown.demoEditCount,
        max_possible: 100,
      };

      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          final_score: scoreBreakdown.totalScore,
          score_breakdown: breakdown,
        })
        .eq("id", task.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success(
        `Task approved! ${engineerName} earned ${scoreBreakdown?.totalScore || 0}/100 points`
      );
      onOpenChange(false);
      setShowRejectForm(false);
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      
      // Get current rejection count
      const { data: currentTask } = await supabase
        .from("tasks")
        .select("demo_rejection_count")
        .eq("id", task.id)
        .single();
      
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "prompt_approved", // Send back to demo phase
          rejection_reason: rejectionReason,
          demo_edit_count: (task.demo_edit_count || 0) + 1,
          demo_rejection_count: ((currentTask?.demo_rejection_count as number) || 0) + 1,
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success("Task rejected and sent back for more demo testing");
      onOpenChange(false);
      setRejectionReason("");
      setShowRejectForm(false);
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  if (!task) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          setShowRejectForm(false);
          setRejectionReason("");
          setQualityScore([30]);
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Demo Submission</DialogTitle>
          <DialogDescription>
            Review the engineer's demo call and approve or request changes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Task Info */}
          <div className="border-2 border-border p-4 space-y-3">
            <h3 className="font-bold text-lg">{task.title}</h3>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{engineerName}</span>
              </div>
              {task.aitel_agents && (
                <div className="flex items-center gap-1">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <span>{task.aitel_agents.agent_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Demo Call Info */}
          {demoCall && (
            <div className="border-2 border-chart-2 bg-chart-2/10 p-4 space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Submitted Demo Call
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  <span className="font-mono">{demoCall.phone_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  <span className="font-mono">{demoCall.duration_seconds}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <span>{demoCall.status}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Made:</span>{" "}
                  <span>
                    {formatDistanceToNow(new Date(demoCall.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Score Preview */}
          {scoreBreakdown && (
            <div className="border-2 border-border p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-chart-4" />
                Score Breakdown
              </h4>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Time Score (faster = better)
                  </span>
                  <span className="font-mono">
                    {scoreBreakdown.timeScore}/40
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Edit className="h-3 w-3" />
                    Edit Score (fewer edits = better)
                  </span>
                  <span className="font-mono">
                    {scoreBreakdown.editScore}/30
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      Demo Quality Score
                    </span>
                    <span className="font-mono">{qualityScore[0]}/30</span>
                  </div>
                  <Slider
                    value={qualityScore}
                    onValueChange={setQualityScore}
                    max={30}
                    min={0}
                    step={1}
                    className="py-2"
                  />
                </div>

                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Score</span>
                  <span className="font-mono text-chart-4">
                    {scoreBreakdown.totalScore}/100
                  </span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Total time: {scoreBreakdown.totalTime} min | Prompt time:{" "}
                  {scoreBreakdown.promptTime} min
                </p>
                <p>Demo phase edits: {scoreBreakdown.demoEditCount}</p>
              </div>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm ? (
            <div className="space-y-3">
              <Label htmlFor="rejection">Changes Required *</Label>
              <Textarea
                id="rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain what needs to be fixed in the demo..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate()}
                  disabled={!rejectionReason.trim() || rejectMutation.isPending}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {rejectMutation.isPending ? "Rejecting..." : "Request Changes"}
                </Button>
              </div>
            </div>
          ) : (
            /* Action Buttons */
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 bg-chart-2 hover:bg-chart-2/90"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {approveMutation.isPending
                  ? "Approving..."
                  : `Approve (${scoreBreakdown?.totalScore || 0} pts)`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
