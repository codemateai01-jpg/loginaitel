import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { BarChart3, Webhook, Plus, ExternalLink } from "lucide-react";
import { AgentConfig } from "../AgentBuilder";
import { useState } from "react";

interface AnalyticsTabProps {
    config: AgentConfig;
    updateConfig: (updates: Partial<AgentConfig>) => void;
}

interface CustomAnalytic {
    id: string;
    name: string;
    prompt: string;
}

export function AnalyticsTab({ config, updateConfig }: AnalyticsTabProps) {
    const [summarizationEnabled, setSummarizationEnabled] = useState(true);
    const [extractionEnabled, setExtractionEnabled] = useState(true);
    const [extractionPrompt, setExtractionPrompt] = useState(
        `user_name : Yield the name of the user.

payment_mode :
If user is paying by cash, yield cash. If they are paying by card, yield card.`
    );
    const [customAnalytics, setCustomAnalytics] = useState<CustomAnalytic[]>([]);
    const [webhookUrl, setWebhookUrl] = useState(
        `${window.location.origin}/api/webhooks/aitel-webhook`
    );

    const addCustomAnalytic = () => {
        const newAnalytic: CustomAnalytic = {
            id: Date.now().toString(),
            name: "",
            prompt: "",
        };
        setCustomAnalytics([...customAnalytics, newAnalytic]);
    };

    const updateCustomAnalytic = (id: string, field: "name" | "prompt", value: string) => {
        setCustomAnalytics(
            customAnalytics.map((a) => (a.id === id ? { ...a, [field]: value } : a))
        );
    };

    const removeCustomAnalytic = (id: string) => {
        setCustomAnalytics(customAnalytics.filter((a) => a.id !== id));
    };

    return (
        <div className="space-y-6">
            {/* Webhook Configuration */}
            <div className="card-tactile bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Webhook className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-lg">Push all execution data to webhook</h3>
                    <a
                        href="https://docs.bolna.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-primary hover:underline flex items-center gap-1"
                    >
                        See all events <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Automatically receive all execution data for this agent using webhook
                </p>
                <Input
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="border-2 font-mono text-sm"
                    placeholder="https://your-domain.com/webhook"
                />
            </div>

            {/* Post Call Tasks */}
            <div className="card-tactile bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-lg">Post Call Tasks</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                    Choose tasks to get executed after the agent conversation is complete
                </p>

                <div className="space-y-6">
                    {/* Summarization */}
                    <div className="border-2 border-border p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h4 className="font-bold">Summarization</h4>
                                <p className="text-sm text-muted-foreground">
                                    Generate a summary of the conversation automatically.
                                </p>
                            </div>
                            <Switch
                                checked={summarizationEnabled}
                                onCheckedChange={setSummarizationEnabled}
                            />
                        </div>
                    </div>

                    {/* Extraction */}
                    <div className="border-2 border-border p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="font-bold">Extraction</h4>
                                <p className="text-sm text-muted-foreground">
                                    Extract structured data from the conversation based on your custom prompt
                                </p>
                            </div>
                            <Switch
                                checked={extractionEnabled}
                                onCheckedChange={setExtractionEnabled}
                            />
                        </div>

                        {extractionEnabled && (
                            <div className="mt-4">
                                <Textarea
                                    value={extractionPrompt}
                                    onChange={(e) => setExtractionPrompt(e.target.value)}
                                    className="min-h-[120px] border-2 font-mono text-sm"
                                    placeholder="user_name : Yield the name of the user.&#10;&#10;payment_mode :&#10;If user is paying by cash, yield cash. If they are paying by card, yield card."
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Define the data fields you want to extract from the conversation
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Custom Analytics */}
            <div className="card-tactile bg-card p-6">
                <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <h3 className="font-bold text-lg">Custom Analytics</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Post call tasks to extract data from the call
                </p>

                {customAnalytics.length > 0 && (
                    <div className="space-y-3 mb-4">
                        {customAnalytics.map((analytic) => (
                            <div key={analytic.id} className="border-2 border-border p-4 rounded-lg">
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Name</Label>
                                        <Input
                                            value={analytic.name}
                                            onChange={(e) =>
                                                updateCustomAnalytic(analytic.id, "name", e.target.value)
                                            }
                                            placeholder="e.g., Lead Quality Score"
                                            className="border-2"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Extraction Prompt</Label>
                                        <Textarea
                                            value={analytic.prompt}
                                            onChange={(e) =>
                                                updateCustomAnalytic(analytic.id, "prompt", e.target.value)
                                            }
                                            placeholder="Describe what data to extract..."
                                            className="min-h-[80px] border-2"
                                        />
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => removeCustomAnalytic(analytic.id)}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <Button
                    variant="outline"
                    className="w-full border-2 border-dashed hover:border-primary"
                    onClick={addCustomAnalytic}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Extract custom analytics
                </Button>
            </div>
        </div>
    );
}
