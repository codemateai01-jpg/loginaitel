import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AgentBuilder, AgentConfig } from "@/components/agent-builder/AgentBuilder";
import { Bot, Save, Play, ArrowLeft } from "lucide-react";

export default function AdminAgentCreator() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [agentName, setAgentName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (config: AgentConfig) => {
        if (!agentName.trim()) {
            toast({
                variant: "destructive",
                title: "Agent name required",
                description: "Please enter a name for your agent",
            });
            return;
        }

        setIsSaving(true);
        try {
            // Transform config to Bolna format
            const { transformToBolnaConfig } = await import("@/lib/bolna-transform");
            const { supabase } = await import("@/integrations/supabase/client");
            const bolnaConfig = transformToBolnaConfig(agentName, config);

            // Create agent in Bolna
            const { createAitelAgent } = await import("@/lib/aitel");
            const { data: agentData, error: bolnaError } = await createAitelAgent(bolnaConfig);

            if (bolnaError || !agentData) {
                throw new Error(bolnaError || "Failed to create agent in Bolna");
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error("User not authenticated");
            }

            // Save to Supabase
            const { error: dbError } = await supabase
                .from("aitel_agents")
                .insert([{
                    external_agent_id: agentData.agent_id,
                    agent_name: agentName,
                    original_system_prompt: config.agentPrompt,
                    current_system_prompt: config.agentPrompt,
                    agent_config: bolnaConfig.agent_config,
                    status: "active",
                    synced_at: new Date().toISOString(),
                }]);

            if (dbError) {
                console.error("Database error:", dbError);
                throw new Error("Failed to save agent to database");
            }

            toast({
                title: "Agent Created Successfully!",
                description: `${agentName} has been deployed and is ready to use.`,
            });

            // Navigate back to agents list
            setTimeout(() => {
                navigate("/admin/agents");
            }, 1500);
        } catch (error) {
            console.error("Agent creation error:", error);
            toast({
                variant: "destructive",
                title: "Error Creating Agent",
                description: error instanceof Error ? error.message : "Failed to create agent",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DashboardLayout role="admin">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/admin/agents")}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="status-pulse">
                            <Bot className="h-8 w-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Create New Agent</h1>
                            <p className="text-sm text-muted-foreground">
                                Configure your AI voice agent with advanced settings
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" className="gap-2">
                            <Play className="h-4 w-4" />
                            Test Agent
                        </Button>
                        <Button className="gap-2" disabled={isSaving}>
                            {isSaving ? (
                                <>Saving...</>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save & Deploy
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Agent Name */}
                <div className="card-tactile bg-card p-6">
                    <Label className="text-sm font-medium mb-2 block">Agent Name</Label>
                    <Input
                        placeholder="e.g., Sales Agent - Real Estate"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        className="border-2 text-lg font-medium"
                    />
                </div>

                {/* Agent Builder */}
                <AgentBuilder
                    onSave={handleSave}
                    onCancel={() => navigate("/admin/agents")}
                />
            </div>
        </DashboardLayout>
    );
}
