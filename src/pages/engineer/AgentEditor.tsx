import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { updateBolnaAgent } from "@/lib/bolna";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Bot,
  Save,
  Phone,
  Loader2,
  ArrowLeft,
  RotateCcw,
  ClipboardList,
  Trophy,
  CheckCircle2,
  Send,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DemoCallDialog } from "@/components/engineer/DemoCallDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  status: string;
  bolna_agent_id: string | null;
  prompt_started_at: string | null;
  prompt_approved_at: string | null;
  demo_edit_count: number | null;
}

interface AitelAgentRecord {
  id: string;
  external_agent_id: string;
  agent_name: string;
  original_system_prompt: string | null;
  current_system_prompt: string | null;
  agent_config: Record<string, unknown>;
  client_id: string | null;
}

export default function AgentEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get("taskId");

  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch task with agent
  const { data: task, isLoading: loadingTask } = useQuery({
    queryKey: ["task-with-agent", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();

      if (error) throw error;
      return data as Task | null;
    },
    enabled: !!taskId,
  });

  // Fetch agent details
  const { data: agent, isLoading: loadingAgent } = useQuery({
    queryKey: ["aitel-agent", task?.bolna_agent_id],
    queryFn: async () => {
      if (!task?.bolna_agent_id) return null;
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("*")
        .eq("id", task.bolna_agent_id)
        .maybeSingle();

      if (error) throw error;
      return data as AitelAgentRecord | null;
    },
    enabled: !!task?.bolna_agent_id,
  });

  // Initialize prompt from agent
  useEffect(() => {
    if (agent?.current_system_prompt) {
      setSystemPrompt(agent.current_system_prompt);
    }
  }, [agent]);

  // Track changes
  useEffect(() => {
    if (agent) {
      setHasChanges(systemPrompt !== agent.current_system_prompt);
    }
  }, [systemPrompt, agent]);

  // Start prompt editing (set prompt_started_at if not set)
  useEffect(() => {
    const startPromptEditing = async () => {
      if (task && !task.prompt_started_at && task.status === "in_progress") {
        await supabase
          .from("tasks")
          .update({ prompt_started_at: new Date().toISOString() })
          .eq("id", task.id);
        queryClient.invalidateQueries({ queryKey: ["task-with-agent", taskId] });
      }
    };
    startPromptEditing();
  }, [task, taskId, queryClient]);

  // Save prompt with history tracking
  const handleSave = async () => {
    if (!agent || !task || !user) return;

    setIsSaving(true);
    try {
      // Log prompt edit
      const editPhase = task.prompt_approved_at ? "demo" : "development";
      await supabase.from("prompt_edit_history").insert({
        task_id: task.id,
        agent_id: agent.id,
        engineer_id: user.id,
        previous_prompt: agent.current_system_prompt,
        new_prompt: systemPrompt,
        edit_phase: editPhase,
      });

      // If editing during demo phase, increment edit count
      if (editPhase === "demo") {
        await supabase
          .from("tasks")
          .update({ demo_edit_count: (task.demo_edit_count || 0) + 1 })
          .eq("id", task.id);
      }

      // Update in Aitel
      const { error: bolnaError } = await updateBolnaAgent(agent.external_agent_id, {
        agent_prompts: {
          task_1: {
            system_prompt: systemPrompt,
          },
        },
      });

      if (bolnaError) {
        throw new Error(bolnaError);
      }

      // Update in our database
      const { error: dbError } = await supabase
        .from("aitel_agents")
        .update({ current_system_prompt: systemPrompt })
        .eq("id", agent.id);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["aitel-agent", task.bolna_agent_id] });
      queryClient.invalidateQueries({ queryKey: ["task-with-agent", taskId] });

      toast({
        title: "Prompt Saved",
        description: "System prompt has been updated successfully.",
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original
  const handleReset = () => {
    if (agent?.original_system_prompt) {
      setSystemPrompt(agent.original_system_prompt);
    }
  };

  // Submit prompt for approval
  const submitPromptMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "prompt_submitted",
          prompt_submitted_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-with-agent", taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      toast({
        title: "Prompt Submitted!",
        description: "Your prompt has been submitted for admin review.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Submit Failed",
        description: error.message,
      });
    },
  });

  // Determine task phase
  const isPromptPhase = task?.status === "in_progress" || task?.status === "rejected";
  const isDemoPhase = task?.status === "prompt_approved";
  const isAwaitingPromptReview = task?.status === "prompt_submitted";
  const isDemoSubmitted = task?.status === "demo_submitted";

  if (loadingTask || loadingAgent) {
    return (
      <DashboardLayout role="engineer">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout role="engineer">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <ClipboardList className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Task not found</p>
          <Button onClick={() => navigate("/engineer/tasks")}>
            Go to Tasks
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout role="engineer">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Bot className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            No agent assigned to this task
          </p>
          <Button onClick={() => navigate("/engineer/tasks")}>
            Go to Tasks
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Task Banner */}
        <div className="border-2 border-chart-4 bg-chart-4/10 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ClipboardList className="h-5 w-5 text-chart-4 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">Editing Agent for Task</span>
                  <Badge className="bg-chart-4/20 text-chart-4 border-chart-4">
                    <Trophy className="h-3 w-3 mr-1" />
                    {task.points} pts
                  </Badge>
                  {isDemoPhase && (
                    <Badge className="bg-chart-2/20 text-chart-2 border-chart-2">
                      Demo Phase
                    </Badge>
                  )}
                  {isAwaitingPromptReview && (
                    <Badge className="bg-chart-3/20 text-chart-3 border-chart-3">
                      Awaiting Prompt Review
                    </Badge>
                  )}
                  {isDemoSubmitted && (
                    <Badge className="bg-chart-3/20 text-chart-3 border-chart-3">
                      Demo Submitted
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {task.title}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/engineer/tasks")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tasks
            </Button>
          </div>
        </div>

        {/* Demo phase notice */}
        {isDemoPhase && (
          <div className="border-2 border-chart-2 bg-chart-2/10 p-4">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-chart-2" />
              <div>
                <p className="font-bold text-chart-2">Demo Phase Active</p>
                <p className="text-sm text-muted-foreground">
                  Your prompt has been approved. Make demo calls to test the agent.
                  Edits during this phase will affect your score.
                  {task.demo_edit_count ? ` (${task.demo_edit_count} edits so far)` : ""}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent border-2 border-border">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{agent.agent_name}</h1>
              <p className="text-sm text-muted-foreground">
                Edit system prompt only
              </p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Demo call button - only visible after prompt approval */}
            {isDemoPhase && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDemoDialogOpen(true)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Make Demo Call
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/engineer/demo-calls?taskId=${task.id}`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Demo Logs
                </Button>
              </>
            )}
            {/* Submit prompt button - only in prompt phase */}
            {isPromptPhase && !hasChanges && (
              <Button
                onClick={() => submitPromptMutation.mutate()}
                disabled={submitPromptMutation.isPending}
                className="bg-chart-3 hover:bg-chart-3/90"
              >
                {submitPromptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit for Approval
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || isAwaitingPromptReview || isDemoSubmitted}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Prompt
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Agent Name</p>
            <code className="text-sm font-mono">{agent.agent_name}</code>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="flex items-center gap-2">
              {hasChanges ? (
                <Badge variant="outline" className="text-chart-3">
                  Unsaved Changes
                </Badge>
              ) : (
                <Badge variant="default" className="bg-chart-2">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Synced
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* System Prompt Editor */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">System Prompt</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={systemPrompt === agent.original_system_prompt || isAwaitingPromptReview || isDemoSubmitted}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Original
            </Button>
          </div>
          <Textarea
            placeholder="Enter the system prompt for this agent..."
            className="min-h-[300px] border-2 font-mono text-sm"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            disabled={isAwaitingPromptReview || isDemoSubmitted}
          />
          <p className="text-xs text-muted-foreground mt-2">
            {systemPrompt.length} characters
          </p>
        </div>

        {/* Original Prompt Reference */}
        {agent.original_system_prompt && (
          <div className="border-2 border-dashed border-border bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">Original Prompt (Read-only)</p>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
              {agent.original_system_prompt}
            </pre>
          </div>
        )}

        {/* Demo Call Dialog */}
        {agent && task && (
          <DemoCallDialog
            open={demoDialogOpen}
            onOpenChange={setDemoDialogOpen}
            taskId={task.id}
            agentId={agent.id}
            bolnaAgentId={agent.external_agent_id}
            agentName={agent.agent_name}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
