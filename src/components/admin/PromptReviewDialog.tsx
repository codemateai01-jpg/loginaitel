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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { CheckCircle, XCircle, Bot, User, Trophy, FileText } from "lucide-react";

interface PromptReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: {
    id: string;
    title: string;
    description: string | null;
    points: number;
    assigned_to: string | null;
    bolna_agent_id: string | null;
    bolna_agents?: {
      agent_name: string;
      current_system_prompt: string | null;
      original_system_prompt: string | null;
    } | null;
  } | null;
  engineerName: string;
}

export function PromptReviewDialog({
  open,
  onOpenChange,
  task,
  engineerName,
}: PromptReviewDialogProps) {
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Fetch prompt edit history
  const { data: editHistory = [] } = useQuery({
    queryKey: ["prompt-history", task?.id],
    queryFn: async () => {
      if (!task?.id) return [];
      const { data, error } = await supabase
        .from("prompt_edit_history")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!task?.id && open,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "prompt_approved",
          prompt_approved_at: new Date().toISOString(),
          demo_started_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success("Prompt approved! Engineer can now make demo calls.");
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
          status: "in_progress",
          rejection_reason: rejectionReason,
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success("Prompt rejected. Engineer will revise.");
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
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Review Prompt Submission</DialogTitle>
          <DialogDescription>
            Review the engineer's prompt and approve for demo testing
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pt-4 pr-4">
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
                {task.bolna_agents && (
                  <div className="flex items-center gap-1">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span>{task.bolna_agents.agent_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-chart-4" />
                  <span className="font-mono">{task.points} pts</span>
                </div>
              </div>
            </div>

            {/* Current Prompt */}
            {task.bolna_agents?.current_system_prompt && (
              <div className="border-2 border-chart-2 bg-chart-2/5 p-4 space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Current System Prompt
                </h4>
                <pre className="text-sm whitespace-pre-wrap bg-background/50 p-3 max-h-60 overflow-auto border">
                  {task.bolna_agents.current_system_prompt}
                </pre>
              </div>
            )}

            {/* Original Prompt for comparison */}
            {task.bolna_agents?.original_system_prompt && (
              <div className="border-2 border-dashed border-border p-4 space-y-2">
                <h4 className="font-medium text-muted-foreground">
                  Original Prompt (Reference)
                </h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
                  {task.bolna_agents.original_system_prompt}
                </pre>
              </div>
            )}

            {/* Edit History */}
            {editHistory.length > 0 && (
              <div className="border-2 border-border p-4 space-y-2">
                <h4 className="font-medium">Recent Edit History</h4>
                <div className="space-y-2">
                  {editHistory.map((edit, idx) => (
                    <div
                      key={edit.id}
                      className="text-xs text-muted-foreground border-l-2 border-border pl-2"
                    >
                      Edit #{editHistory.length - idx} -{" "}
                      {new Date(edit.created_at).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reject Form */}
            {showRejectForm ? (
              <div className="space-y-3">
                <Label htmlFor="rejection">Rejection Reason *</Label>
                <Textarea
                  id="rejection"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain what needs to be fixed in the prompt..."
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
                    {rejectMutation.isPending ? "Rejecting..." : "Reject Prompt"}
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
                  {approveMutation.isPending ? "Approving..." : "Approve for Demo"}
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
