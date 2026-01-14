import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { updateBolnaAgentPrompt } from "@/lib/bolna";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bot,
  Save,
  ArrowLeft,
  Loader2,
  FileText,
  RotateCcw,
} from "lucide-react";

interface Agent {
  id: string;
  agent_name: string;
  external_agent_id: string;
  status: string;
  current_system_prompt: string | null;
  original_system_prompt: string | null;
  agent_config: Record<string, unknown> | null;
  client_id: string | null;
}


export default function AgentConfigEditor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const agentIdFromUrl = searchParams.get("agentId");

  const [selectedAgentId, setSelectedAgentId] = useState<string>(agentIdFromUrl || "");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch agents assigned to this engineer
  const { data: myAgents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["my-assigned-agents-editor", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, agent_name, external_agent_id, status, current_system_prompt, original_system_prompt, agent_config, client_id")
        .eq("engineer_id", user.id)
        .order("agent_name");
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user?.id,
  });

  // Load agent config when selected
  const selectedAgent = myAgents.find((a) => a.id === selectedAgentId);

  useEffect(() => {
    if (selectedAgent) {
      setSystemPrompt(selectedAgent.current_system_prompt || selectedAgent.original_system_prompt || "");
      setHasChanges(false);
    }
  }, [selectedAgent]);

  // Track changes to system prompt only
  useEffect(() => {
    if (selectedAgent) {
      const originalPrompt = selectedAgent.current_system_prompt || selectedAgent.original_system_prompt || "";
      setHasChanges(systemPrompt !== originalPrompt);
    }
  }, [systemPrompt, selectedAgent]);

  // Save mutation - saves system prompt to both local DB and Bolna API
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAgentId || !selectedAgent) throw new Error("No agent selected");

      // First, update in Aitel API (two-way sync)
      const bolnaResponse = await updateBolnaAgentPrompt(
        selectedAgent.external_agent_id,
        systemPrompt
      );

      if (bolnaResponse.error) {
        throw new Error(`Failed to sync agent: ${bolnaResponse.error}`);
      }

      // Then update in local database
      const { error } = await supabase
        .from("aitel_agents")
        .update({
          current_system_prompt: systemPrompt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAgentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-assigned-agents-editor"] });
      toast.success("Agent prompt saved and synced with Bolna!");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Reset to original prompt
  const handleResetPrompt = () => {
    if (selectedAgent?.original_system_prompt) {
      setSystemPrompt(selectedAgent.original_system_prompt);
      toast.info("Prompt reset to original");
    }
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/engineer/agents")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Agent Prompt Editor</h1>
              <p className="text-sm text-muted-foreground">
                Edit the system prompt for your assigned agents
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Badge variant="outline" className="text-chart-4 border-chart-4">
                Unsaved changes
              </Badge>
            )}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!selectedAgentId || saveMutation.isPending || !hasChanges}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Configuration
            </Button>
          </div>
        </div>

        {/* Agent Selector */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Select Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents...
              </div>
            ) : myAgents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No agents assigned to you yet.</p>
                <p className="text-sm">Wait for an admin to assign agents.</p>
              </div>
            ) : (
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="border-2 max-w-md">
                  <SelectValue placeholder="Choose an agent to configure" />
                </SelectTrigger>
                <SelectContent>
                  {myAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <span>{agent.agent_name}</span>
                        <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">
                          {agent.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* System Prompt Editor - Only editable section for engineers */}
        {selectedAgent && (
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  System Prompt
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleResetPrompt}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset to Original
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">Agent Instructions</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Enter the system prompt for this agent..."
                  className="min-h-[300px] font-mono text-sm border-2"
                />
                <p className="text-xs text-muted-foreground">
                  Define how the agent should behave, its personality, and goals.
                </p>
              </div>

              {selectedAgent.original_system_prompt && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Original Prompt (Read-only)</Label>
                  <div className="p-3 bg-muted/50 border border-border rounded text-sm max-h-40 overflow-auto">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {selectedAgent.original_system_prompt}
                    </pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No Agent Selected State */}
        {!selectedAgent && myAgents.length > 0 && (
          <Card className="border-2 border-dashed">
            <CardContent className="py-12 text-center">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium mb-2">Select an Agent</p>
              <p className="text-muted-foreground">
                Choose an agent from the dropdown above to configure its settings.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
