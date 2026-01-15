import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TaskTimer } from "@/components/tasks/TaskTimer";
import { DemoCallDialog } from "@/components/engineer/DemoCallDialog";
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
  Bot,
  Phone,
  FileText,
  PhoneCall,
  Star,
  Upload,
  Music,
  X,
} from "lucide-react";
import { formatDistanceToNow, format, differenceInMinutes } from "date-fns";

type TaskStatus = "pending" | "in_progress" | "prompt_submitted" | "prompt_approved" | "demo_submitted" | "completed" | "rejected";

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
  picked_at: string | null;
  aitel_agent_id: string | null;
  prompt_started_at: string | null;
  prompt_submitted_at: string | null;
  prompt_approved_at: string | null;
  demo_started_at: string | null;
  demo_completed_at: string | null;
  prompt_edit_count: number | null;
  demo_edit_count: number | null;
  selected_demo_call_id: string | null;
  final_score: number | null;
  score_breakdown: any;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-muted text-muted-foreground";
    case "in_progress":
      return "bg-chart-4/20 text-chart-4 border-chart-4";
    case "prompt_submitted":
      return "bg-chart-3/20 text-chart-3 border-chart-3";
    case "prompt_approved":
      return "bg-chart-5/20 text-chart-5 border-chart-5";
    case "demo_submitted":
      return "bg-chart-1/20 text-chart-1 border-chart-1";
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
      return "Prompt Phase";
    case "prompt_submitted":
      return "Prompt Review";
    case "prompt_approved":
      return "Demo Phase";
    case "demo_submitted":
      return "Demo Review";
    case "completed":
      return "Completed";
    case "rejected":
      return "Needs Revision";
    default:
      return status;
  }
};

const getPhaseInfo = (status: string) => {
  switch (status) {
    case "in_progress":
      return { phase: 1, label: "Prompt Phase", description: "Edit the agent prompt and submit for approval" };
    case "prompt_submitted":
      return { phase: 1, label: "Awaiting Approval", description: "Waiting for admin to approve your prompt" };
    case "prompt_approved":
      return { phase: 2, label: "Demo Phase", description: "Make demo calls and submit the best one" };
    case "demo_submitted":
      return { phase: 2, label: "Demo Review", description: "Admin is reviewing your demo call" };
    default:
      return null;
  }
};

export default function EngineerTasks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showPickDialog, setShowPickDialog] = useState(false);
  const [showSubmitPromptDialog, setShowSubmitPromptDialog] = useState(false);
  const [showDemoCallDialog, setShowDemoCallDialog] = useState(false);
  const [showSubmitDemoDialog, setShowSubmitDemoDialog] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [selectedDemoCallId, setSelectedDemoCallId] = useState<string | null>(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Fetch available tasks (pending - unassigned OR assigned to current user)
  const { data: availableTasks = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-tasks", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get unassigned pending tasks
      const { data: unassigned, error: err1 } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "pending")
        .is("assigned_to", null)
        .order("created_at", { ascending: false });

      if (err1) throw err1;

      // Get pending tasks assigned specifically to this engineer
      const { data: assigned, error: err2 } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "pending")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      if (err2) throw err2;

      return [...(assigned || []), ...(unassigned || [])] as Task[];
    },
    enabled: !!user?.id,
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

  // Fetch demo calls for selected task
  const { data: demoCalls = [] } = useQuery({
    queryKey: ["demo-calls", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from("demo_calls")
        .select("*")
        .eq("task_id", selectedTask.id)
        .eq("engineer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedTask?.id && !!user?.id,
  });

  // Fetch agent details for selected task (to get external_agent_id)
  const { data: selectedAgent } = useQuery({
    queryKey: ["agent-for-task", selectedTask?.aitel_agent_id],
    queryFn: async () => {
      if (!selectedTask?.aitel_agent_id) return null;
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, external_agent_id, agent_name")
        .eq("id", selectedTask.aitel_agent_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedTask?.aitel_agent_id,
  });

  // Real-time subscription for tasks
  useEffect(() => {
    const channel = supabase
      .channel('engineer-tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
          queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Pick task mutation
  const pickTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          assigned_to: user?.id,
          status: "in_progress",
          picked_at: new Date().toISOString(),
          prompt_started_at: new Date().toISOString(),
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
        description: "You've started working on this task. Edit the prompt and submit for approval.",
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

  // Submit prompt for approval
  const submitPromptMutation = useMutation({
    mutationFn: async ({ taskId, notes }: { taskId: string; notes: string }) => {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: "prompt_submitted",
          prompt_submitted_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .eq("assigned_to", user?.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Task update failed. You may not have permission.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      setShowSubmitPromptDialog(false);
      setSelectedTask(null);
      setSubmissionNotes("");
      toast({
        title: "Prompt Submitted!",
        description: "Your prompt has been submitted for admin approval.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit prompt.",
        variant: "destructive",
      });
    },
  });

  // Submit demo call for final review
  const submitDemoMutation = useMutation({
    mutationFn: async ({ taskId, demoCallId, audioFile }: { taskId: string; demoCallId?: string; audioFile?: File }) => {
      let uploadedAudioUrl: string | null = null;
      let finalDemoCallId = demoCallId;

      // If audio file is provided, upload it first
      if (audioFile && user?.id) {
        setIsUploadingAudio(true);
        const fileExt = audioFile.name.split('.').pop();
        const fileName = `${user.id}/${taskId}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('demo-audio')
          .upload(fileName, audioFile, {
            contentType: audioFile.type,
            upsert: true,
          });

        if (uploadError) {
          setIsUploadingAudio(false);
          throw new Error(`Failed to upload audio: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('demo-audio')
          .getPublicUrl(fileName);

        uploadedAudioUrl = publicUrl;

        // Create a demo call record for the uploaded audio
        const { data: newDemoCall, error: demoError } = await supabase
          .from("demo_calls")
          .insert({
            task_id: taskId,
            engineer_id: user.id,
            agent_id: selectedTask?.aitel_agent_id || '',
            phone_number: 'uploaded',
            status: 'completed',
            uploaded_audio_url: uploadedAudioUrl,
          })
          .select()
          .single();

        if (demoError) {
          setIsUploadingAudio(false);
          throw new Error(`Failed to create demo call record: ${demoError.message}`);
        }

        finalDemoCallId = newDemoCall.id;
        setIsUploadingAudio(false);
      }

      if (!finalDemoCallId) {
        throw new Error("Please select a demo call or upload an audio file.");
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({
          status: "demo_submitted",
          demo_completed_at: new Date().toISOString(),
          selected_demo_call_id: finalDemoCallId,
        })
        .eq("id", taskId)
        .eq("assigned_to", user?.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Task update failed. You may not have permission.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
      setShowSubmitDemoDialog(false);
      setSelectedTask(null);
      setSelectedDemoCallId(null);
      setUploadedAudioFile(null);
      toast({
        title: "Demo Submitted!",
        description: "Your demo call has been submitted for final review.",
      });
    },
    onError: (error: Error) => {
      setIsUploadingAudio(false);
      toast({
        title: "Error",
        description: error.message || "Failed to submit demo.",
        variant: "destructive",
      });
    },
  });

  // Filter tasks by status
  const promptPhaseTasks = myTasks.filter((t) => ["in_progress", "prompt_submitted"].includes(t.status));
  const demoPhaseTasks = myTasks.filter((t) => ["prompt_approved", "demo_submitted"].includes(t.status));
  const completedTasks = myTasks.filter((t) => t.status === "completed");
  const rejectedTasks = myTasks.filter((t) => t.status === "rejected");
  const activeTasks = [...promptPhaseTasks, ...demoPhaseTasks];

  const handlePickTask = (task: Task) => {
    setSelectedTask(task);
    setShowPickDialog(true);
  };

  const handleEditPrompt = (task: Task) => {
    navigate(`/engineer/agent-editor?taskId=${task.id}&agentId=${task.aitel_agent_id}`);
  };

  const handleSubmitPrompt = (task: Task) => {
    setSelectedTask(task);
    setShowSubmitPromptDialog(true);
  };

  const handleMakeDemoCall = (task: Task) => {
    setSelectedTask(task);
    setShowDemoCallDialog(true);
  };

  const handleSubmitDemo = (task: Task) => {
    setSelectedTask(task);
    setShowSubmitDemoDialog(true);
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

  const renderTaskCard = (task: Task, actions: React.ReactNode) => {
    const phaseInfo = getPhaseInfo(task.status);
    
    return (
      <div
        key={task.id}
        className="border-2 border-border bg-card overflow-hidden hover:border-primary transition-colors"
      >
        {/* Phase Progress Indicator */}
        {phaseInfo && (
          <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${phaseInfo.phase >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  1
                </div>
                <span className="text-xs text-muted-foreground">Prompt</span>
              </div>
              <div className="w-8 h-0.5 bg-muted">
                <div className={`h-full transition-all ${phaseInfo.phase >= 2 ? 'bg-primary w-full' : 'w-0'}`} />
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${phaseInfo.phase >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  2
                </div>
                <span className="text-xs text-muted-foreground">Demo</span>
              </div>
            </div>
            <span className="text-sm font-medium">{phaseInfo.label}</span>
          </div>
        )}

        {/* Timer for active tasks - only show if picked but not yet started working */}
        {task.status === "in_progress" && task.picked_at && !task.prompt_started_at && (
          <TaskTimer pickedAt={task.picked_at} />
        )}
        
        <div className="p-4">
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
                  {phaseInfo && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {phaseInfo.description}
                    </p>
                  )}
                </div>
                <Badge className={getStatusColor(task.status)}>
                  {getStatusLabel(task.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                {task.prompt_edit_count !== null && task.prompt_edit_count > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {task.prompt_edit_count} prompt edits
                  </span>
                )}
                {task.demo_edit_count !== null && task.demo_edit_count > 0 && (
                  <span className="flex items-center gap-1">
                    <PhoneCall className="h-4 w-4" />
                    {task.demo_edit_count} demo edits
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {actions}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Tasks</h1>
            <p className="text-muted-foreground">
              Pick tasks, edit prompts, make demo calls, and submit for review
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm">Available</span>
            </div>
            <p className="text-2xl font-bold">{availableTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-4 mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Prompt Phase</span>
            </div>
            <p className="text-2xl font-bold">{promptPhaseTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-5 mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Demo Phase</span>
            </div>
            <p className="text-2xl font-bold">{demoPhaseTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Rejected</span>
            </div>
            <p className="text-2xl font-bold">{rejectedTasks.length}</p>
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
                {rejectedTasks.length} task(s) have been sent back for revision. Check the rejection reason and make changes.
              </p>
            </div>
          </div>
        )}

        {/* Main Content with Tabs */}
        <Tabs defaultValue="available" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="available" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Available</span>
              {availableTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{availableTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Prompt</span>
              {promptPhaseTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{promptPhaseTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="demo" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Demo</span>
              {demoPhaseTasks.length > 0 && (
                <Badge variant="secondary" className="ml-1">{demoPhaseTasks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Rejected</span>
              {rejectedTasks.length > 0 && (
                <Badge variant="destructive" className="ml-1">{rejectedTasks.length}</Badge>
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

          {/* Prompt Phase Tasks */}
          <TabsContent value="prompt" className="space-y-4">
            {loadingMyTasks ? (
              <div className="border-2 border-border bg-card p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : promptPhaseTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Tasks in Prompt Phase</p>
                <p className="text-sm text-muted-foreground">
                  Pick a task to start working on the prompt.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {promptPhaseTasks.map((task) => 
                  renderTaskCard(task, (
                    <>
                      {task.status === "in_progress" && (
                        <>
                          <Button variant="outline" onClick={() => handleEditPrompt(task)}>
                            <Bot className="h-4 w-4 mr-2" />
                            Edit Prompt
                          </Button>
                          <Button onClick={() => handleSubmitPrompt(task)}>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Prompt
                          </Button>
                        </>
                      )}
                      {task.status === "prompt_submitted" && (
                        <div className="flex items-center gap-2 text-chart-3">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm font-medium">Awaiting Approval</span>
                        </div>
                      )}
                    </>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          {/* Demo Phase Tasks */}
          <TabsContent value="demo" className="space-y-4">
            {demoPhaseTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Tasks in Demo Phase</p>
                <p className="text-sm text-muted-foreground">
                  Tasks move here after prompt approval.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {demoPhaseTasks.map((task) => 
                  renderTaskCard(task, (
                    <>
                      {task.status === "prompt_approved" && (
                        <>
                          <Button variant="outline" onClick={() => handleEditPrompt(task)}>
                            <Bot className="h-4 w-4 mr-2" />
                            Edit Prompt
                          </Button>
                          <Button variant="outline" onClick={() => handleMakeDemoCall(task)}>
                            <Phone className="h-4 w-4 mr-2" />
                            Make Demo Call
                          </Button>
                          <Button onClick={() => handleSubmitDemo(task)}>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Demo
                          </Button>
                        </>
                      )}
                      {task.status === "demo_submitted" && (
                        <div className="flex items-center gap-2 text-chart-1">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm font-medium">Awaiting Review</span>
                        </div>
                      )}
                    </>
                  ))
                )}
              </div>
            )}
          </TabsContent>

          {/* Rejected Tasks */}
          <TabsContent value="rejected" className="space-y-4">
            {rejectedTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <XCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Rejected Tasks</p>
                <p className="text-sm text-muted-foreground">
                  Great job! No tasks need revision.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
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
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" onClick={() => handleEditPrompt(task)}>
                          <Bot className="h-4 w-4 mr-2" />
                          Edit Prompt
                        </Button>
                        <Button onClick={() => handleSubmitPrompt(task)}>
                          <Send className="h-4 w-4 mr-2" />
                          Re-submit
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Completed Tasks */}
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
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 text-chart-2 font-medium">
                            <Trophy className="h-4 w-4" />
                            +{task.points} points earned
                          </span>
                          {task.final_score !== null && (
                            <span className="flex items-center gap-1 text-chart-4 font-medium">
                              <Star className="h-4 w-4" />
                              Score: {task.final_score}/100
                            </span>
                          )}
                          {task.completed_at && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              Completed {format(new Date(task.completed_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        {task.score_breakdown && (
                          <div className="mt-2 p-3 bg-muted/50 text-xs space-y-1">
                            <p className="font-medium">Score Breakdown:</p>
                            <div className="grid grid-cols-3 gap-2">
                              <span>Time: {task.score_breakdown.time_score}/40</span>
                              <span>Edits: {task.score_breakdown.edit_score}/30</span>
                              <span>Quality: {task.score_breakdown.demo_quality_score}/30</span>
                            </div>
                          </div>
                        )}
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
              Once you pick this task, you'll start the prompt phase. Edit the agent's prompt and submit for admin approval.
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
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>Workflow:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Edit the agent prompt</li>
                  <li>Submit for admin approval</li>
                  <li>After approval, make demo calls</li>
                  <li>Submit best demo call for final review</li>
                </ol>
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

      {/* Submit Prompt Dialog */}
      <Dialog open={showSubmitPromptDialog} onOpenChange={setShowSubmitPromptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Prompt for Approval</DialogTitle>
            <DialogDescription>
              Your prompt will be reviewed by an admin. Once approved, you'll enter the demo phase.
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
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                  placeholder="Add any notes about your prompt changes..."
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitPromptDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTask &&
                submitPromptMutation.mutate({
                  taskId: selectedTask.id,
                  notes: submissionNotes,
                })
              }
              disabled={submitPromptMutation.isPending}
            >
              {submitPromptMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Demo Dialog */}
      <Dialog open={showSubmitDemoDialog} onOpenChange={(open) => {
        setShowSubmitDemoDialog(open);
        if (!open) {
          setUploadedAudioFile(null);
          setSelectedDemoCallId(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Demo Call for Final Review</DialogTitle>
            <DialogDescription>
              Select a demo call from below or upload an audio file.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="border-2 border-border p-4">
                <h4 className="font-bold">{selectedTask.title}</h4>
              </div>

              {/* Audio Upload Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Audio File
                </Label>
                <div className="border-2 border-dashed border-border p-4 rounded-lg">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadedAudioFile(file);
                        setSelectedDemoCallId(null);
                      }
                    }}
                  />
                  
                  {uploadedAudioFile ? (
                    <div className="flex items-center justify-between bg-primary/10 p-3 border border-primary">
                      <div className="flex items-center gap-3">
                        <Music className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-sm">{uploadedAudioFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedAudioFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedAudioFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="text-center cursor-pointer py-4"
                      onClick={() => audioInputRef.current?.click()}
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload audio file (MP3, WAV, M4A)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">OR select from existing calls</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              
              {/* Existing Demo Calls */}
              {demoCalls.filter(call => call.status === 'completed').length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No completed demo calls yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {demoCalls.filter(call => call.status === 'completed').map((call) => (
                    <div
                      key={call.id}
                      className={`border-2 p-3 cursor-pointer transition-colors ${
                        selectedDemoCallId === call.id && !uploadedAudioFile
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedDemoCallId(call.id);
                        setUploadedAudioFile(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{call.phone_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Duration: {call.duration_seconds || 0}s • {format(new Date(call.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                        {selectedDemoCallId === call.id && !uploadedAudioFile && (
                          <CheckCircle className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDemoDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedTask &&
                submitDemoMutation.mutate({
                  taskId: selectedTask.id,
                  demoCallId: uploadedAudioFile ? undefined : selectedDemoCallId || undefined,
                  audioFile: uploadedAudioFile || undefined,
                })
              }
              disabled={submitDemoMutation.isPending || isUploadingAudio || (!selectedDemoCallId && !uploadedAudioFile)}
            >
              {submitDemoMutation.isPending || isUploadingAudio ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isUploadingAudio ? "Uploading..." : "Submitting..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit for Final Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demo Call Dialog */}
      {selectedTask && selectedTask.aitel_agent_id && selectedAgent && (
        <DemoCallDialog
          open={showDemoCallDialog}
          onOpenChange={setShowDemoCallDialog}
          taskId={selectedTask.id}
          agentId={selectedTask.aitel_agent_id}
          externalAgentId={selectedAgent.external_agent_id}
          agentName={selectedAgent.agent_name || selectedTask.title}
        />
      )}
    </DashboardLayout>
  );
}
