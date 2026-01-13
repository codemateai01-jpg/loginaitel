import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { WebCallTester } from "@/components/agent-builder/WebCallTester";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone,
  Bot,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Settings,
  FileText,
  Mic,
  Save,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface BolnaAgentRecord {
  id: string;
  bolna_agent_id: string;
  agent_name: string;
  original_system_prompt: string | null;
  current_system_prompt: string | null;
  agent_config: Record<string, unknown>;
}

export default function WebCallTest() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get("agentId");
  const taskId = searchParams.get("taskId");

  const [customPrompt, setCustomPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Hello! How can I help you today?");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  // Fetch agent
  const { data: agent, isLoading } = useQuery({
    queryKey: ["bolna-agent-test", agentId],
    queryFn: async () => {
      if (!agentId) return null;
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("*")
        .eq("id", agentId)
        .maybeSingle();

      if (error) throw error;
      return data as BolnaAgentRecord | null;
    },
    enabled: !!agentId,
  });

  // Fetch task info if taskId provided
  const { data: task } = useQuery({
    queryKey: ["task-info", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  // Initialize custom prompt from agent
  useEffect(() => {
    if (agent?.current_system_prompt) {
      setCustomPrompt(agent.current_system_prompt);
    }
  }, [agent]);

  // Get welcome message from agent config
  useEffect(() => {
    if (agent?.agent_config) {
      const config = agent.agent_config as { agent_welcome_message?: string };
      if (config.agent_welcome_message) {
        setWelcomeMessage(config.agent_welcome_message);
      }
    }
  }, [agent]);

  if (isLoading) {
    return (
      <DashboardLayout role="engineer">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout role="engineer">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Agent not found</p>
          <Button onClick={() => navigate("/engineer/tasks")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tasks
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const effectivePrompt = useCustomPrompt ? customPrompt : (agent.current_system_prompt || "");

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => taskId ? navigate(`/engineer/agent?taskId=${taskId}`) : navigate("/engineer/tasks")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="p-3 bg-chart-2/20 border-2 border-chart-2">
              <Phone className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Web Call Test</h1>
              <p className="text-sm text-muted-foreground">
                Test {agent.agent_name} in your browser
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-chart-2 border-chart-2">
            <Mic className="h-3 w-3 mr-1" />
            Browser Testing Mode
          </Badge>
        </div>

        {/* Task Context */}
        {task && (
          <Card className="border-2 border-chart-4 bg-chart-4/10 p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-chart-4" />
              <div>
                <p className="font-medium">Testing for Task: {task.title}</p>
                <p className="text-sm text-muted-foreground">
                  {task.description || "No description"}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Settings */}
          <div className="space-y-6">
            {/* Agent Info */}
            <Card className="border-2 border-border p-4">
              <div className="flex items-center gap-3 mb-4">
                <Bot className="h-5 w-5" />
                <h3 className="font-bold">Agent Configuration</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Agent Name</span>
                  <span className="font-mono">{agent.agent_name}</span>
                </div>
              </div>
            </Card>

            {/* Welcome Message */}
            <Card className="border-2 border-border p-4">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="h-5 w-5" />
                <h3 className="font-bold">Test Settings</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="welcome">Welcome Message</Label>
                  <Input
                    id="welcome"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    placeholder="Agent's opening message..."
                    className="border-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    The first message the agent will say when the call starts
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Use Custom Prompt</Label>
                    <Button
                      variant={useCustomPrompt ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseCustomPrompt(!useCustomPrompt)}
                    >
                      {useCustomPrompt ? "Using Custom" : "Using Agent Prompt"}
                    </Button>
                  </div>
                </div>

                {useCustomPrompt && (
                  <div className="space-y-2">
                    <Label htmlFor="customPrompt">Custom System Prompt</Label>
                    <Textarea
                      id="customPrompt"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Enter a custom system prompt for testing..."
                      className="min-h-[200px] border-2 font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Test with a different prompt without saving changes to the agent
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Current Prompt Preview */}
            {!useCustomPrompt && agent.current_system_prompt && (
              <Card className="border-2 border-dashed border-border p-4">
                <h4 className="font-medium mb-2 text-sm">Current Agent Prompt</h4>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                  {agent.current_system_prompt}
                </pre>
              </Card>
            )}

            {/* Instructions */}
            <Card className="border-2 border-border bg-muted/30 p-4">
              <h4 className="font-bold mb-3">How to Test</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  Click "Start Test Call" to begin the session
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  Grant microphone access when prompted
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  Press and hold the microphone button while speaking
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">4.</span>
                  Release the button to send your message to the agent
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">5.</span>
                  Listen to the agent's response through your speakers
                </li>
              </ol>
            </Card>
          </div>

          {/* Right: Call Tester */}
          <div>
            <WebCallTester
              agentId={agent.id}
              agentName={agent.agent_name}
              systemPrompt={effectivePrompt}
              welcomeMessage={welcomeMessage}
            />

            {/* Quick Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => taskId ? navigate(`/engineer/agent?taskId=${taskId}`) : navigate("/engineer/tasks")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Editor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
