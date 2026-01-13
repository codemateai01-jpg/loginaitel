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
  Play,
  Loader2,
  ArrowLeft,
  RotateCcw,
  ClipboardList,
  Trophy,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { TestCallDialog } from "@/components/agent-builder/TestCallDialog";
import { useAuth } from "@/contexts/AuthContext";

interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  status: string;
  bolna_agent_id: string | null;
}

interface BolnaAgentRecord {
  id: string;
  bolna_agent_id: string;
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
  const [testDialogOpen, setTestDialogOpen] = useState(false);
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
    queryKey: ["bolna-agent", task?.bolna_agent_id],
    queryFn: async () => {
      if (!task?.bolna_agent_id) return null;
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("*")
        .eq("id", task.bolna_agent_id)
        .maybeSingle();

      if (error) throw error;
      return data as BolnaAgentRecord | null;
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

  // Save prompt
  const handleSave = async () => {
    if (!agent || !task) return;

    setIsSaving(true);
    try {
      // Update in Bolna
      const { error: bolnaError } = await updateBolnaAgent(agent.bolna_agent_id, {
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
        .from("bolna_agents")
        .update({ current_system_prompt: systemPrompt })
        .eq("id", agent.id);

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["bolna-agent", task.bolna_agent_id] });

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

  // Test call handler
  const handleTestCall = async (phoneNumber: string) => {
    if (!agent) {
      return { success: false, message: "No agent found" };
    }

    try {
      // Make test call via proxy
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bolna-proxy?action=make-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            agent_id: agent.bolna_agent_id,
            recipient_phone_number: phoneNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Call failed" };
      }

      return {
        success: true,
        message: `Test call initiated! Execution ID: ${data.execution_id}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Call failed",
      };
    }
  };

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
                <div className="flex items-center gap-2">
                  <span className="font-bold">Editing Agent for Task</span>
                  <Badge className="bg-chart-4/20 text-chart-4 border-chart-4">
                    <Trophy className="h-3 w-3 mr-1" />
                    {task.points} pts
                  </Badge>
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
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setTestDialogOpen(true)}
            >
              <Play className="h-4 w-4 mr-2" />
              Test Agent
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
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
            <p className="text-sm text-muted-foreground">Agent ID</p>
            <code className="text-sm font-mono">{agent.bolna_agent_id}</code>
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
              disabled={systemPrompt === agent.original_system_prompt}
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

        {/* Test Call Dialog */}
        <TestCallDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          agentName={agent.agent_name}
          onTestCall={handleTestCall}
        />
      </div>
    </DashboardLayout>
  );
}
