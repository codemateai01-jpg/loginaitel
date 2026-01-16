import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { CheckCircle, XCircle, Bot, User, Trophy } from "lucide-react";

interface TaskReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    title: string;
    description: string | null;
    points: number;
    assigned_to: string | null;
    aitel_agents?: {
      agent_name: string;
    } | null;
  } | null;
  engineerName: string;
}

export function TaskReviewDialog({
  open,
  onOpenChange,
  task,
  engineerName,
}: TaskReviewDialogProps) {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success(`Task approved! ${task?.points} points awarded to ${engineerName}`);
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
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success("Task rejected and sent back to engineer");
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
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        setShowRejectForm(false);
        setRejectionReason("");
      }
    }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Task Submission</DialogTitle>
          <DialogDescription>
            Review the engineer's work and approve or reject the task
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-4">
          {/* Task Info */}
          <div className="border-2 border-border p-4 space-y-3">
            <h3 className="font-bold text-lg">{task.title}</h3>
            {task.description && (
              <p className="text-sm text-muted-foreground">{task.description}</p>
            )}
            
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
              <div className="flex items-center gap-1">
                <Trophy className="h-4 w-4 text-chart-4" />
                <span className="font-mono">{task.points} pts</span>
              </div>
            </div>
          </div>

          {/* Reject Form */}
          {showRejectForm ? (
            <div className="space-y-3">
              <Label htmlFor="rejection">Rejection Reason *</Label>
              <Textarea
                id="rejection"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the task is being rejected and what needs to be fixed..."
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
                  {rejectMutation.isPending ? "Rejecting..." : "Confirm Reject"}
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
                Reject
              </Button>
              <Button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="flex-1 bg-chart-2 hover:bg-chart-2/90"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {approveMutation.isPending ? "Approving..." : "Approve"}
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
