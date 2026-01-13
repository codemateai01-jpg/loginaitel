import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { VoiceSelector, VoiceConfig, CARTESIA_VOICES } from "@/components/agent-builder/VoiceSelector";
import { LLMSettings, LLMConfig, LLM_MODELS } from "@/components/agent-builder/LLMSettings";
import { ConversationSettings, ConversationConfig } from "@/components/agent-builder/ConversationSettings";
import { TranscriberSettings, TranscriberConfig } from "@/components/agent-builder/TranscriberSettings";
import { TelephonySettings, TelephonyConfig } from "@/components/agent-builder/TelephonySettings";
import { TestCallDialog } from "@/components/agent-builder/TestCallDialog";
import { createBolnaAgent, buildAgentConfig, makeCall, BuildAgentOptions } from "@/lib/bolna";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bot,
  Save,
  Play,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";

export default function AgentBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [savedAgentId, setSavedAgentId] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

  // Basic Info
  const [agentName, setAgentName] = useState("");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");

  // Voice Configuration
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>({
    provider: "cartesia",
    voiceId: CARTESIA_VOICES[0].id,
    voiceName: CARTESIA_VOICES[0].name,
  });

  // LLM Configuration
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    model: LLM_MODELS[0].id,
    provider: LLM_MODELS[0].provider,
    family: LLM_MODELS[0].family,
    temperature: 0.1,
    maxTokens: 150,
  });

  // Transcriber Configuration
  const [transcriberConfig, setTranscriberConfig] = useState<TranscriberConfig>({
    model: "nova-3",
    language: "en",
  });

  // Telephony Configuration
  const [telephonyConfig, setTelephonyConfig] = useState<TelephonyConfig>({
    provider: "plivo",
  });

  // Conversation Configuration
  const [conversationConfig, setConversationConfig] = useState<ConversationConfig>({
    hangupAfterSilence: 10,
    callTerminate: 90,
    interruptionWords: 2,
    voicemailDetection: true,
    backchanneling: true,
    ambientNoise: false,
    ambientNoiseTrack: "office-ambience",
  });

  const handleSaveAgent = async () => {
    if (!agentName.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter an agent name",
      });
      return;
    }

    if (!systemPrompt.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please enter a system prompt",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Build agent config for Bolna API
      const buildOptions: BuildAgentOptions = {
        name: agentName,
        systemPrompt,
        welcomeMessage: welcomeMessage || undefined,
        voiceProvider: voiceConfig.provider,
        voiceId: voiceConfig.voiceId,
        voiceName: voiceConfig.voiceName,
        llmProvider: llmConfig.provider,
        llmFamily: llmConfig.family,
        llmModel: llmConfig.model,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        transcriberModel: transcriberConfig.model,
        language: transcriberConfig.language as "en" | "hi" | "es" | "fr",
        telephonyProvider: telephonyConfig.provider,
        hangupAfterSilence: conversationConfig.hangupAfterSilence,
        callTerminate: conversationConfig.callTerminate,
        interruptionWords: conversationConfig.interruptionWords,
        voicemailDetection: conversationConfig.voicemailDetection,
        backchanneling: conversationConfig.backchanneling,
        ambientNoise: conversationConfig.ambientNoise,
        ambientNoiseTrack: conversationConfig.ambientNoiseTrack,
      };

      const agentPayload = buildAgentConfig(buildOptions);
      
      // Create agent in Bolna
      const { data: bolnaResponse, error: bolnaError } = await createBolnaAgent(agentPayload);

      if (bolnaError || !bolnaResponse) {
        throw new Error(bolnaError || "Failed to create agent in Bolna");
      }

      // Save agent to our database
      const { error: dbError } = await supabase.from("agents").insert([{
        name: agentName,
        description,
        system_prompt: systemPrompt,
        voice_config: JSON.parse(JSON.stringify({
          bolna_agent_id: bolnaResponse.agent_id,
          provider: voiceConfig.provider,
          voice_id: voiceConfig.voiceId,
          voice_name: voiceConfig.voiceName,
          llm: llmConfig,
          transcriber: transcriberConfig,
          telephony: telephonyConfig,
          conversation: conversationConfig,
        })),
        created_by: user?.id || "",
        client_id: user?.id || "",
        status: "pending",
      }]);

      if (dbError) {
        console.error("DB Error:", dbError);
        throw new Error("Failed to save agent to database");
      }

      setSavedAgentId(bolnaResponse.agent_id);

      toast({
        title: "Agent Created!",
        description: "Your agent has been created and is pending approval.",
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save agent",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCall = async (phoneNumber: string) => {
    if (!savedAgentId || !user) {
      return { success: false, message: "Please save the agent first" };
    }

    try {
      const { data, error } = await makeCall({
        agent_id: savedAgentId,
        lead_id: "", // Test call - no lead
        client_id: user.id,
      });

      if (error || !data) {
        return { success: false, message: error || "Failed to initiate call" };
      }

      return { success: true, message: `Call queued! Execution ID: ${data.execution_id}` };
    } catch (error) {
      return { success: false, message: "Failed to make test call" };
    }
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent border-2 border-border">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agent Builder</h1>
              <p className="text-sm text-muted-foreground">
                Create and configure voice agents
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {savedAgentId && (
              <Button
                variant="outline"
                className="shadow-xs"
                onClick={() => setTestDialogOpen(true)}
              >
                <Play className="h-4 w-4 mr-2" />
                Test Agent
              </Button>
            )}
            <Button onClick={handleSaveAgent} disabled={isSaving} className="shadow-sm">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : savedAgentId ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Agent
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="border-2 border-border bg-card p-6">
              <h2 className="font-bold mb-4">Basic Information</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Customer Support Agent"
                    className="border-2"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of the agent's purpose"
                    className="border-2"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcome">Welcome Message</Label>
                  <Input
                    id="welcome"
                    placeholder="What the agent says when the call starts"
                    className="border-2"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. This is the first thing the agent will say.
                  </p>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="border-2 border-border bg-card p-6">
              <h2 className="font-bold mb-4">System Prompt *</h2>
              <Textarea
                placeholder="Define the agent's personality, behavior, and knowledge base...

Example:
You are a friendly customer support agent for Acme Corp. Your role is to help customers with their inquiries about our products and services. Be professional, helpful, and concise. If you don't know something, honestly say so and offer to connect them with a human agent."
                className="min-h-[200px] border-2 font-mono text-sm"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {systemPrompt.length} characters
              </p>
            </div>

            {/* Voice Configuration */}
            <div className="border-2 border-border bg-card p-6">
              <VoiceSelector value={voiceConfig} onChange={setVoiceConfig} />
            </div>

            {/* Conversation Settings */}
            <ConversationSettings
              value={conversationConfig}
              onChange={setConversationConfig}
            />
          </div>

          {/* Sidebar Settings */}
          <div className="space-y-6">
            {/* LLM Settings */}
            <div className="border-2 border-border bg-card p-6">
              <LLMSettings value={llmConfig} onChange={setLlmConfig} />
            </div>

            {/* Transcriber */}
            <div className="border-2 border-border bg-card p-6">
              <TranscriberSettings
                value={transcriberConfig}
                onChange={setTranscriberConfig}
              />
            </div>

            {/* Telephony */}
            <div className="border-2 border-border bg-card p-6">
              <TelephonySettings
                value={telephonyConfig}
                onChange={setTelephonyConfig}
              />
            </div>

            {/* Status Card */}
            {savedAgentId ? (
              <div className="border-2 border-green-500 bg-green-50 dark:bg-green-950 p-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-bold">Agent Created</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  ID: {savedAgentId.slice(0, 8)}...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Status: Pending Admin Approval
                </p>
              </div>
            ) : (
              <div className="border-2 border-border bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Fill in the details and click "Create Agent" to save your configuration.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Call Dialog */}
      <TestCallDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        agentName={agentName}
        onTestCall={handleTestCall}
      />
    </DashboardLayout>
  );
}
