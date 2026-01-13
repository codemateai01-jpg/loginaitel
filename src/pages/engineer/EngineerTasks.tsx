import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Clock,
  Play,
  CheckCircle,
  AlertCircle,
  Send,
  XCircle,
  Timer,
  Trophy,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";

type TaskStatus = "pending" | "in_progress" | "submitted" | "approved" | "rejected" | "completed";

interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  status: string;
  deadline: string | null;
  assigned_to: string | null;
  created_at: string;
  rejection_reason: string | null;
  completed_at: string | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-muted text-muted-foreground";
    case "in_progress":
      return "bg-chart-4/20 text-chart-4 border-chart-4";
    case "submitted":
      return "bg-chart-3/20 text-chart-3 border-chart-3";
    case "approved":
    case "completed":
      return "bg-chart-2/20 text-chart-2 border-chart-2";
    case "rejected":
      return "bg-destructive/20 text-destructive border-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "Available";
    case "in_progress":
      return "In Progress";
    case "submitted":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    case "rejected":
      return "Needs Revision";
    default:
      return status;
  }
};

export default function EngineerTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showPickDialog, setShowPickDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");

  // Fetch available tasks (pending, not assigned)
  const { data: availableTasks = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "pending")
        .is("assigned_to", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
  });

  // Fetch my tasks (assigned to current user)
  const { data: myTasks = [], isLoading: loadingMyTasks } = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });

  // Pick task mutation
  const pickTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          assigned_to: user?.id,
          status: "in_progress",
        })
        .eq("id", taskId)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      setShowPickDialog(false);
      setSelectedTask(null);
      toast({
        title: "Task Picked!",
        description: "You've started working on this task. Good luck!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to pick task. It may have been taken by someone else.",
        variant: "destructive",
      });
    },
  });

  // Submit task mutation
  const submitTaskMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "submitted",
          description: notes ? `${selectedTask?.description || ""}\n\n---\nSubmission Notes: ${notes}` : selectedTask?.description,
        })
        .eq("id", taskId)
        .eq("assigned_to", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      setShowSubmitDialog(false);
      setSelectedTask(null);
      setSubmissionNotes("");
      toast({
        title: "Task Submitted!",
        description: "Your task has been submitted for admin review.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit task. Please try again.",
        variant: "destructive",
      });
    },
  });

  const activeTasks = myTasks.filter((t) => t.status === "in_progress");
  const submittedTasks = myTasks.filter((t) => t.status === "submitted");
  const completedTasks = myTasks.filter((t) => ["approved", "completed"].includes(t.status));
  const rejectedTasks = myTasks.filter((t) => t.status === "rejected");

  const handlePickTask = (task: Task) => {
    setSelectedTask(task);
    setShowPickDialog(true);
  };

  const handleSubmitTask = (task: Task) => {
    setSelectedTask(task);
    setShowSubmitDialog(true);
  };

  const getTimeRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diff = differenceInMinutes(deadlineDate, now);
    
    if (diff < 0) return "Overdue";
    if (diff < 60) return `${diff}m remaining`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h remaining`;
    return formatDistanceToNow(deadlineDate, { addSuffix: true });
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Tasks</h1>
            <p className="text-muted-foreground">
              Pick tasks, track progress, and submit for review
            </p>
          </div>
          <div className="flex gap-3">
            <div className="border-2 border-border bg-card px-4 py-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-chart-4" />
              <span className="font-mono font-bold">
                {completedTasks.reduce((sum, t) => sum + t.points, 0)} pts earned
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm">Available</span>
            </div>
            <p className="text-2xl font-bold">{availableTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-4 mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">In Progress</span>
            </div>
            <p className="text-2xl font-bold">{activeTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-3 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending Review</span>
            </div>
            <p className="text-2xl font-bold">{submittedTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-2 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold">{completedTasks.length}</p>
          </div>
        </div>

        {/* Rejected Tasks Alert */}
        {rejectedTasks.length > 0 && (
          <div className="border-2 border-destructive bg-destructive/10 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-bold text-destructive">Tasks Need Revision</p>
              <p className="text-sm text-muted-foreground">
                {rejectedTasks.length} task(s) have been sent back for revision. Check the "Needs Revision" tab.
              </p>
            </div>
          </div>
        )}

        {/* Main Content with Tabs */}
        <Tabs defaultValue="available" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="available" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Available</span>
              {availableTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{availableTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Active</span>
              {activeTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{activeTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="review" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">In Review</span>
              {submittedTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{submittedTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Done</span>
            </TabsTrigger>
          </TabsList>

          {/* Available Tasks */}
          <TabsContent value="available" className="space-y-4">
            {loadingAvailable ? (
              <div className="border-2 border-border bg-card p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Available Tasks</p>
                <p className="text-sm text-muted-foreground">
                  Check back later for new tasks from admins.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {availableTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-2 border-border bg-card p-4 hover:border-primary transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-chart-4" />
                            {task.points} points
                          </span>
                          {task.deadline && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-4 w-4" />
                              {getTimeRemaining(task.deadline)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Posted {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button onClick={() => handlePickTask(task)} className="shrink-0">
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Pick Task
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Tasks */}
          <TabsContent value="active" className="space-y-4">
            {rejectedTasks.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-destructive flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Needs Revision ({rejectedTasks.length})
                </h3>
                {rejectedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-2 border-destructive bg-card p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{task.title}</h3>
                            {task.rejection_reason && (
                              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20">
                                <p className="text-sm font-medium text-destructive">Rejection Reason:</p>
                                <p className="text-sm text-muted-foreground mt-1">{task.rejection_reason}</p>
                              </div>
                            )}
                          </div>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-chart-4" />
                            {task.points} points
                          </span>
                        </div>
                      </div>
                      <Button onClick={() => handleSubmitTask(task)} className="shrink-0">
                        <Send className="h-4 w-4 mr-2" />
                        Re-submit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {loadingMyTasks ? (
              <div className="border-2 border-border bg-card p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : activeTasks.length === 0 && rejectedTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <Play className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Active Tasks</p>
                <p className="text-sm text-muted-foreground">
                  Pick a task from the "Available" tab to get started.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-2 border-chart-4 bg-card p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-chart-4" />
                            {task.points} points
                          </span>
                          {task.deadline && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-4 w-4" />
                              {getTimeRemaining(task.deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button onClick={() => handleSubmitTask(task)} className="shrink-0">
                        <Send className="h-4 w-4 mr-2" />
                        Submit for Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* In Review */}
          <TabsContent value="review" className="space-y-4">
            {submittedTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Tasks In Review</p>
                <p className="text-sm text-muted-foreground">
                  Submit your active tasks to see them here.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {submittedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-2 border-chart-3 bg-card p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-4 w-4 text-chart-4" />
                            {task.points} points
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Awaiting admin review
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-chart-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">Pending</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Completed */}
          <TabsContent value="completed" className="space-y-4">
            {completedTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Completed Tasks Yet</p>
                <p className="text-sm text-muted-foreground">
                  Complete tasks to earn points and climb the leaderboard!
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-2 border-chart-2 bg-card p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{task.title}</h3>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <Badge className={getStatusColor(task.status)}>
                            {getStatusLabel(task.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 text-chart-2 font-medium">
                            <Trophy className="h-4 w-4" />
                            +{task.points} points earned
                          </span>
                          {task.completed_at && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Pick Task Dialog */}
      <Dialog open={showPickDialog} onOpenChange={setShowPickDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick This Task?</DialogTitle>
            <DialogDescription>
              Once you pick this task, you'll have 10 minutes to start working on it.
              Make sure you're ready before proceeding.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="border-2 border-border p-4">
                <h4 className="font-bold">{selectedTask.title}</h4>
                {selectedTask.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {selectedTask.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1 text-chart-4 font-medium">
                    <Trophy className="h-4 w-4" />
                    {selectedTask.points} points
                  </span>
                  {selectedTask.deadline && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Timer className="h-4 w-4" />
                      {getTimeRemaining(selectedTask.deadline)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPickDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedTask && pickTaskMutation.mutate(selectedTask.id)}
              disabled={pickTaskMutation.isPending}
            >
              {pickTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Working
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Task Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Task for Review</DialogTitle>
            <DialogDescription>
              Your task will be reviewed by an admin. Add any notes about your work.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="border-2 border-border p-4">
                <h4 className="font-bold">{selectedTask.title}</h4>
                <div className="flex items-center gap-2 mt-2 text-sm text-chart-4">
                  <Trophy className="h-4 w-4" />
                  {selectedTask.points} points on completion
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Submission Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about your work, challenges faced, or things to consider during review..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTask &&
                submitTaskMutation.mutate({
                  taskId: selectedTask.id,
                  notes: submissionNotes,
                })
              }
              disabled={submitTaskMutation.isPending}
            >
              {submitTaskMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
