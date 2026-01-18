import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles } from "lucide-react";

export interface AgentConfig {
  welcomeMessage: string;
  systemPrompt: string;
}

interface AgentSettingsProps {
  value: AgentConfig;
  onChange: (config: AgentConfig) => void;
}

export function AgentSettings({ value, onChange }: AgentSettingsProps) {
  // Provide safe defaults if value is undefined
  const safeValue = value ?? { welcomeMessage: "", systemPrompt: "" };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5" />
        <h2 className="font-bold">Agent Configuration</h2>
      </div>

      {/* Welcome Message */}
      <div className="space-y-2">
        <Label htmlFor="welcomeMessage">Agent Welcome Message</Label>
        <Input
          id="welcomeMessage"
          placeholder="Hello"
          value={safeValue.welcomeMessage}
          onChange={(e) => onChange({ ...safeValue, welcomeMessage: e.target.value })}
          className="border-2"
        />
        <p className="text-xs text-muted-foreground">
          This will be the initial message from the agent. You can use variables here using {"{variable_name}"}
        </p>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="systemPrompt">Agent Prompt</Label>
          <Button variant="outline" size="sm" className="gap-1">
            <Sparkles className="h-3 w-3" />
            AI Edit
          </Button>
        </div>
        <Textarea
          id="systemPrompt"
          placeholder="Enter your agent's system prompt..."
          value={safeValue.systemPrompt}
          onChange={(e) => onChange({ ...safeValue, systemPrompt: e.target.value })}
          className="border-2 min-h-[300px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Define how your agent should behave, respond, and interact with users.
        </p>
      </div>
    </div>
  );
}
