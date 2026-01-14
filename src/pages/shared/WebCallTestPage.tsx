import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WebCallTester } from "@/components/agent-builder/WebCallTester";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Phone,
  Bot,
  Loader2,
  AlertCircle,
  Settings,
  Mic,
} from "lucide-react";
import { useState, useEffect } from "react";

interface AitelAgentRecord {
  id: string;
  external_agent_id: string;
  agent_name: string;
  original_system_prompt: string | null;
  current_system_prompt: string | null;
  agent_config: Record<string, unknown>;
  client_id: string | null;
}

interface WebCallTestPageProps {
  role: "admin" | "engineer" | "client";
}

export default function WebCallTestPage({ role }: WebCallTestPageProps) {
  const { user } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Hello! How can I help you today?");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);

  // Fetch agents based on role
  const { data: agents, isLoading } = useQuery({
    queryKey: ["agents-for-testing", role, user?.id],
    queryFn: async () => {
      let query = supabase.from("aitel_agents").select("*");

      // For clients, only show their assigned agents
      if (role === "client" && user?.id) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query.order("agent_name");

      if (error) throw error;
      return data as AitelAgentRecord[];
    },
    enabled: !!user,
  });

  // Get selected agent
  const selectedAgent = agents?.find((a) => a.id === selectedAgentId);

  // Initialize custom prompt from selected agent
  useEffect(() => {
    if (selectedAgent?.current_system_prompt) {
      setCustomPrompt(selectedAgent.current_system_prompt);
    }
  }, [selectedAgent]);

  // Get welcome message from agent config
  useEffect(() => {
    if (selectedAgent?.agent_config) {
      const config = selectedAgent.agent_config as { agent_welcome_message?: string };
      if (config.agent_welcome_message) {
        setWelcomeMessage(config.agent_welcome_message);
      }
    }
  }, [selectedAgent]);

  const effectivePrompt = useCustomPrompt ? customPrompt : (selectedAgent?.current_system_prompt || "");

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-chart-2/20 border-2 border-chart-2">
              <Phone className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Web Call Test</h1>
              <p className="text-sm text-muted-foreground">
                Test voice agents directly in your browser
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-chart-2 border-chart-2">
            <Mic className="h-3 w-3 mr-1" />
            Browser Testing Mode
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !agents || agents.length === 0 ? (
          <Card className="border-2 border-dashed border-border p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-bold text-lg mb-2">No Agents Available</h3>
              <p className="text-muted-foreground">
                {role === "client"
                  ? "You don't have any agents assigned yet. Contact your administrator."
                  : "Create or sync agents to start testing."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left: Settings */}
            <div className="space-y-6">
              {/* Agent Selector */}
              <Card className="border-2 border-border p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Bot className="h-5 w-5" />
                  <h3 className="font-bold">Select Agent</h3>
                </div>

                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Choose an agent to test..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agent_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

              </Card>

              {/* Test Settings */}
              {selectedAgent && (
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
                          className="min-h-[150px] border-2 font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Test with a different prompt without saving changes
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Current Prompt Preview */}
              {selectedAgent && !useCustomPrompt && selectedAgent.current_system_prompt && (
                <Card className="border-2 border-dashed border-border p-4">
                  <h4 className="font-medium mb-2 text-sm">Current Agent Prompt</h4>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                    {selectedAgent.current_system_prompt}
                  </pre>
                </Card>
              )}

              {/* Instructions */}
              <Card className="border-2 border-border bg-muted/30 p-4">
                <h4 className="font-bold mb-3">How to Test</h4>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">1.</span>
                    Select an agent from the dropdown above
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">2.</span>
                    Click "Start Test Call" to begin the session
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">3.</span>
                    Grant microphone access when prompted
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">4.</span>
                    Press and hold the microphone button while speaking
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
              {selectedAgent ? (
                <WebCallTester
                  agentId={selectedAgent.id}
                  agentName={selectedAgent.agent_name}
                  systemPrompt={effectivePrompt}
                  welcomeMessage={welcomeMessage}
                />
              ) : (
                <Card className="border-2 border-dashed border-border p-8 h-[400px] flex flex-col items-center justify-center">
                  <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Select an agent to start testing
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
