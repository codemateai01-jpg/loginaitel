import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FileText,
  Brain,
  Headphones,
  Cog,
  Phone,
  Wrench,
  BarChart3,
  PhoneIncoming,
  Save,
  Trash2,
  Copy,
  Share2,
  PhoneCall,
  MessageCircle,
  ExternalLink,
  Search,
  Plus,
  Download,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react";

// Import all settings components
import { AgentSettings, AgentConfig } from "@/components/agent-builder/AgentSettings";
import { LLMSettingsAdvanced, LLMConfigAdvanced } from "@/components/agent-builder/LLMSettingsAdvanced";
import { AudioSettings, AudioConfig } from "@/components/agent-builder/AudioSettings";
import { EngineSettings, EngineConfig } from "@/components/agent-builder/EngineSettings";
import { CallSettings, CallConfig } from "@/components/agent-builder/CallSettings";
import { ToolsSettings, ToolsConfig } from "@/components/agent-builder/ToolsSettings";
import { AnalyticsSettings, AnalyticsConfig } from "@/components/agent-builder/AnalyticsSettings";
import { InboundSettings, InboundConfig } from "@/components/agent-builder/InboundSettings";
import { useAgentBuilder, AgentFullConfig } from "@/hooks/useAgentBuilder";
import { TestCallDialog } from "@/components/agent-builder/TestCallDialog";

const DEFAULT_CONFIG: AgentFullConfig = {
  agent: {
    welcomeMessage: "Hello",
    systemPrompt: `1. LLM RULES
Speak ONLY in clear Indian English, neutral accent.

Keep responses concise; don't ramble.

Never pronounce numbers digit-by-digit unless absolutely necessary; say them as normal numbers.

Don't oversell; ask, listen, then pitch.

Maintain a friendly, confident tone — not salesy, not robotic.

2. IDENTITY
You are [Agent Name], a representative of [Company Name].`,
  },
  llm: {
    model: "gpt-4.1-nano",
    provider: "openai",
    family: "openai",
    temperature: 0.2,
    maxTokens: 450,
  },
  audio: {
    language: "en",
    transcriberProvider: "elevenlabs",
    transcriberModel: "scribe_v2_realtime",
    keywords: "",
    voiceProvider: "cartesia",
    voiceId: "a0e99841-438c-4a64-b679-ae501e7d6091",
    voiceName: "Barbershop Man",
  },
  engine: {
    preciseTranscript: false,
    interruptWords: 2,
    responseRate: "rapid",
  },
  call: {
    telephonyProvider: "plivo",
    enableDtmf: false,
    noiseCancellation: true,
    noiseCancellationLevel: 85,
    ambientNoise: false,
    ambientNoiseTrack: "office-ambience",
  },
  tools: {
    selectedFunctions: [],
  },
  analytics: {
    autoReschedule: false,
    summarization: false,
    extraction: false,
    extractionPrompt: "",
  },
  inbound: {
    dataSource: "none",
    restrictToDatabase: false,
  },
};

export default function AdminAgentBuilder() {
  const navigate = useNavigate();
  const {
    agents,
    isLoadingAgents,
    syncAgents,
    isSyncing,
    createAgent,
    isCreating,
    updateAgent,
    isUpdating,
    deleteAgent,
    isDeleting,
    fetchAgentDetails,
    makeTestCall,
    stopCall,
  } = useAgentBuilder();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("agent");
  const [config, setConfig] = useState<AgentFullConfig>(DEFAULT_CONFIG);
  const [agentName, setAgentName] = useState("New Agent");
  const [isNewAgent, setIsNewAgent] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isTestCallDialogOpen, setIsTestCallDialogOpen] = useState(false);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const filteredAgents = agents.filter((a) =>
    a.agent_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load agent details when selecting an agent
  useEffect(() => {
    async function loadAgentDetails() {
      if (!selectedAgentId || isNewAgent) return;

      const agent = agents.find((a) => a.id === selectedAgentId);
      if (!agent) return;

      setAgentName(agent.agent_name);
      setLastUpdated(new Date(agent.updated_at));

      // If we have cached config, use it
      if (agent.agent_config) {
        setConfig(agent.agent_config as unknown as AgentFullConfig);
        return;
      }

      // Otherwise fetch from API
      setIsLoadingDetails(true);
      try {
        const details = await fetchAgentDetails(agent.external_agent_id);
        if (details) {
          setConfig(details);
        }
      } finally {
        setIsLoadingDetails(false);
      }
    }

    loadAgentDetails();
  }, [selectedAgentId, isNewAgent, agents, fetchAgentDetails]);

  // Select first agent on load
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
      setIsNewAgent(false);
    }
  }, [agents, selectedAgentId]);

  const handleSave = async () => {
    if (!agentName.trim()) {
      toast.error("Agent name is required");
      return;
    }

    try {
      if (isNewAgent) {
        const newAgent = await createAgent({ name: agentName, config });
        setSelectedAgentId(newAgent.id);
        setIsNewAgent(false);
      } else if (selectedAgent) {
        await updateAgent({
          id: selectedAgent.id,
          externalId: selectedAgent.external_agent_id,
          name: agentName,
          config,
        });
      }
      setLastUpdated(new Date());
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleNewAgent = () => {
    setSelectedAgentId(null);
    setConfig(DEFAULT_CONFIG);
    setAgentName("New Agent");
    setIsNewAgent(true);
    setActiveTab("agent");
    setLastUpdated(null);
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;

    try {
      await deleteAgent({
        id: selectedAgent.id,
        externalId: selectedAgent.external_agent_id,
      });
      setSelectedAgentId(null);
      setIsNewAgent(true);
      setConfig(DEFAULT_CONFIG);
      setAgentName("New Agent");
    } catch (error) {
      // Error already handled by mutation
    }
  };

  const handleCopyAgentId = () => {
    if (selectedAgent) {
      navigator.clipboard.writeText(selectedAgent.external_agent_id);
      toast.success("Agent ID copied to clipboard");
    }
  };

  const calculateCostPerMin = () => {
    return "$0.039";
  };

  const costBreakdown = {
    transcriber: 20,
    llm: 30,
    voice: 25,
    telephony: 25,
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return "Not saved";
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? "s" : ""} ago`;
  };

  const isSaving = isCreating || isUpdating;

  const handleTestCall = async (phoneNumber: string) => {
    if (!selectedAgent) {
      return { success: false, message: "No agent selected" };
    }
    return makeTestCall(selectedAgent.external_agent_id, phoneNumber);
  };

  const handleStopCall = async (executionId: string) => {
    await stopCall(executionId);
  };

  return (
    <DashboardLayout role="admin">
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h1 className="text-2xl font-bold">Agent Setup</h1>
            <p className="text-sm text-muted-foreground">Fine tune your agents</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Agent List */}
          <div className="w-72 border-r flex flex-col bg-card">
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Your Agents</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => syncAgents()}
                  disabled={isSyncing}
                  title="Sync from API"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" disabled>
                  <Download className="h-3 w-3" />
                  Import
                </Button>
                <Button size="sm" className="gap-1" onClick={handleNewAgent}>
                  <Plus className="h-3 w-3" />
                  New Agent
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoadingAgents ? (
                  <div className="space-y-2 p-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-4">
                    {searchQuery ? "No agents found" : "No agents yet. Create one!"}
                  </p>
                ) : (
                  filteredAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setIsNewAgent(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors rounded ${
                        selectedAgentId === agent.id && !isNewAgent
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{agent.agent_name}</span>
                        <Badge
                          variant={agent.status === "active" ? "default" : "secondary"}
                          className="text-[10px] ml-2"
                        >
                          {agent.status}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Center - Configuration */}
            <div className="flex-1 overflow-auto">
              <div className="p-6">
                {/* Agent Header */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <Input
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="text-2xl font-bold border-none p-0 h-auto focus-visible:ring-0 bg-transparent max-w-md"
                      placeholder="Agent Name"
                    />
                    <div className="flex items-center gap-2">
                      {!isNewAgent && selectedAgent && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={handleCopyAgentId}
                        >
                          <Copy className="h-3 w-3" />
                          Agent ID
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-1" disabled>
                        <Share2 className="h-3 w-3" />
                        Share
                      </Button>
                    </div>
                  </div>

                  {/* Cost Indicator */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Cost per min: ~ {calculateCostPerMin()}</span>
                    </div>
                    <div className="flex-1 max-w-md">
                      <div className="h-2 flex rounded-full overflow-hidden">
                        <div
                          className="bg-green-500"
                          style={{ width: `${costBreakdown.transcriber}%` }}
                        />
                        <div
                          className="bg-orange-500"
                          style={{ width: `${costBreakdown.llm}%` }}
                        />
                        <div
                          className="bg-teal-500"
                          style={{ width: `${costBreakdown.voice}%` }}
                        />
                        <div
                          className="bg-amber-500"
                          style={{ width: `${costBreakdown.telephony}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Transcriber
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      LLM
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Voice
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Telephony
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Platform
                    </Badge>
                  </div>
                </div>

                {/* Loading State */}
                {isLoadingDetails ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  /* Tabs */
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-8 w-full mb-6">
                      <TabsTrigger value="agent" className="gap-1 text-xs">
                        <FileText className="h-3 w-3" />
                        Agent
                      </TabsTrigger>
                      <TabsTrigger value="llm" className="gap-1 text-xs">
                        <Brain className="h-3 w-3" />
                        LLM
                      </TabsTrigger>
                      <TabsTrigger value="audio" className="gap-1 text-xs">
                        <Headphones className="h-3 w-3" />
                        Audio
                      </TabsTrigger>
                      <TabsTrigger value="engine" className="gap-1 text-xs">
                        <Cog className="h-3 w-3" />
                        Engine
                      </TabsTrigger>
                      <TabsTrigger value="call" className="gap-1 text-xs">
                        <Phone className="h-3 w-3" />
                        Call
                      </TabsTrigger>
                      <TabsTrigger value="tools" className="gap-1 text-xs">
                        <Wrench className="h-3 w-3" />
                        Tools
                      </TabsTrigger>
                      <TabsTrigger value="analytics" className="gap-1 text-xs">
                        <BarChart3 className="h-3 w-3" />
                        Analytics
                      </TabsTrigger>
                      <TabsTrigger value="inbound" className="gap-1 text-xs">
                        <PhoneIncoming className="h-3 w-3" />
                        Inbound
                      </TabsTrigger>
                    </TabsList>

                    <Card className="p-6">
                      <TabsContent value="agent" className="m-0">
                        <AgentSettings
                          value={config.agent}
                          onChange={(agent) => setConfig({ ...config, agent })}
                        />
                      </TabsContent>
                      <TabsContent value="llm" className="m-0">
                        <LLMSettingsAdvanced
                          value={config.llm}
                          onChange={(llm) => setConfig({ ...config, llm })}
                        />
                      </TabsContent>
                      <TabsContent value="audio" className="m-0">
                        <AudioSettings
                          value={config.audio}
                          onChange={(audio) => setConfig({ ...config, audio })}
                        />
                      </TabsContent>
                      <TabsContent value="engine" className="m-0">
                        <EngineSettings
                          value={config.engine}
                          onChange={(engine) => setConfig({ ...config, engine })}
                        />
                      </TabsContent>
                      <TabsContent value="call" className="m-0">
                        <CallSettings
                          value={config.call}
                          onChange={(call) => setConfig({ ...config, call })}
                        />
                      </TabsContent>
                      <TabsContent value="tools" className="m-0">
                        <ToolsSettings
                          value={config.tools}
                          onChange={(tools) => setConfig({ ...config, tools })}
                        />
                      </TabsContent>
                      <TabsContent value="analytics" className="m-0">
                        <AnalyticsSettings
                          value={config.analytics}
                          onChange={(analytics) => setConfig({ ...config, analytics })}
                        />
                      </TabsContent>
                      <TabsContent value="inbound" className="m-0">
                        <InboundSettings
                          value={config.inbound}
                          onChange={(inbound) => setConfig({ ...config, inbound })}
                        />
                      </TabsContent>
                    </Card>
                  </Tabs>
                )}
              </div>
            </div>

            {/* Right Sidebar - Actions */}
            <div className="w-72 border-l bg-card p-4 space-y-4">
              <Button variant="outline" className="w-full gap-2" disabled>
                <ExternalLink className="h-4 w-4" />
                See all call logs
              </Button>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleSave}
                    disabled={isSaving || isLoadingDetails}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSaving ? "Saving..." : isNewAgent ? "Create agent" : "Save agent"}
                  </Button>

                  {!isNewAgent && selectedAgent && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" disabled={isDeleting}>
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{selectedAgent.agent_name}"? This action
                            cannot be undone and will remove the agent from both the system and API.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAgent}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {isNewAgent ? "Not saved yet" : `Last updated ${formatTimeAgo(lastUpdated)}`}
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Button variant="outline" className="w-full gap-2 text-primary border-primary" disabled>
                  <MessageCircle className="h-4 w-4" />
                  Chat with agent
                </Button>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  💡 Chat is the fastest way to test and refine the agent.
                </p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  onClick={() => setIsTestCallDialogOpen(true)}
                  disabled={isNewAgent || !selectedAgent}
                >
                  <PhoneCall className="h-4 w-4" />
                  Test via phone call
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Test your agent with a real phone call
                </p>
              </div>

              <div className="border-t pt-4 space-y-2">
                <Button className="w-full gap-2" variant="default" disabled>
                  <PhoneCall className="h-4 w-4" />
                  Get call from agent
                </Button>
                <Button variant="outline" className="w-full gap-2" disabled>
                  <PhoneIncoming className="h-4 w-4" />
                  Set inbound agent
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Test Call Dialog */}
        {selectedAgent && (
          <TestCallDialog
            open={isTestCallDialogOpen}
            onOpenChange={setIsTestCallDialogOpen}
            agentName={selectedAgent.agent_name}
            agentId={selectedAgent.id}
            externalAgentId={selectedAgent.external_agent_id}
            onTestCall={handleTestCall}
            onStopCall={handleStopCall}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
