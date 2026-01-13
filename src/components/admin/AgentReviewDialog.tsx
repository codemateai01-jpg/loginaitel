import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  CheckCircle,
  XCircle,
  Loader2,
  Mic,
  Brain,
  MessageSquare,
  Settings,
  ClipboardList,
} from "lucide-react";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  status: string;
  created_at: string;
  created_by: string;
  client_id: string;
  task_id: string | null;
  voice_config: Record<string, unknown> | null;
}

interface AgentReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onApprove: () => void;
  onReject: (reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function AgentReviewDialog({
  open,
  onOpenChange,
  agent,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: AgentReviewDialogProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(rejectionReason);
    setRejectionReason("");
    setShowRejectForm(false);
  };

  const handleClose = () => {
    setShowRejectForm(false);
    setRejectionReason("");
    onOpenChange(false);
  };

  if (!agent) return null;

  const voiceConfig = agent.voice_config as Record<string, unknown> | null;
  const llmConfig = voiceConfig?.llm as Record<string, unknown> | undefined;
  const transcriberConfig = voiceConfig?.transcriber as Record<string, unknown> | undefined;
  const conversationConfig = voiceConfig?.conversation as Record<string, unknown> | undefined;

  const isPending = agent.status === "pending";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Review Agent: {agent.name}
          </DialogTitle>
          <DialogDescription>
            Review the agent configuration before approving or rejecting.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="prompt" className="flex-1 min-h-0">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="prompt" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Prompt</span>
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-1">
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">Voice</span>
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">LLM</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 h-[350px]">
            <TabsContent value="prompt" className="mt-0 space-y-4">
              <div className="space-y-2">
                <h4 className="font-bold text-sm">Description</h4>
                <p className="text-sm text-muted-foreground border-2 border-border p-3 bg-muted/50">
                  {agent.description || "No description provided"}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-sm">System Prompt</h4>
                <pre className="text-sm text-muted-foreground border-2 border-border p-3 bg-muted/50 whitespace-pre-wrap font-mono max-h-[200px] overflow-auto">
                  {agent.system_prompt || "No system prompt provided"}
                </pre>
              </div>
              {agent.task_id && (
                <div className="flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4 text-chart-4" />
                  <span className="text-muted-foreground">Linked to task</span>
                  <Badge variant="outline">{agent.task_id.slice(0, 8)}...</Badge>
                </div>
              )}
            </TabsContent>

            <TabsContent value="voice" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Voice Provider</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {(voiceConfig?.provider as string) || "Not configured"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Voice Name</h4>
                  <p className="text-sm text-muted-foreground">
                    {(voiceConfig?.voice_name as string) || "Not configured"}
                  </p>
                </div>
              </div>
              <div className="border-2 border-border p-4">
                <h4 className="font-bold text-sm mb-2">Voice ID</h4>
                <code className="text-xs text-muted-foreground bg-muted px-2 py-1">
                  {(voiceConfig?.voice_id as string) || "N/A"}
                </code>
              </div>
            </TabsContent>

            <TabsContent value="llm" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Model</h4>
                  <p className="text-sm text-muted-foreground">
                    {(llmConfig?.model as string) || "Not configured"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Provider</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {(llmConfig?.provider as string) || "Not configured"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Temperature</h4>
                  <p className="text-sm text-muted-foreground">
                    {llmConfig?.temperature !== undefined ? String(llmConfig.temperature) : "N/A"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Max Tokens</h4>
                  <p className="text-sm text-muted-foreground">
                    {llmConfig?.maxTokens !== undefined ? String(llmConfig.maxTokens) : "N/A"}
                  </p>
                </div>
              </div>

              <div className="border-2 border-border p-4">
                <h4 className="font-bold text-sm mb-2">Transcriber</h4>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Provider: {(transcriberConfig?.provider as string) || "N/A"}</span>
                  <span>Language: {(transcriberConfig?.language as string) || "N/A"}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Hangup After Silence</h4>
                  <p className="text-sm text-muted-foreground">
                    {conversationConfig?.hangupAfterSilence !== undefined
                      ? `${conversationConfig.hangupAfterSilence}s`
                      : "N/A"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Call Terminate</h4>
                  <p className="text-sm text-muted-foreground">
                    {conversationConfig?.callTerminate !== undefined
                      ? `${conversationConfig.callTerminate}s`
                      : "N/A"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Voicemail Detection</h4>
                  <p className="text-sm text-muted-foreground">
                    {conversationConfig?.voicemailDetection ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <div className="border-2 border-border p-4">
                  <h4 className="font-bold text-sm mb-2">Backchanneling</h4>
                  <p className="text-sm text-muted-foreground">
                    {conversationConfig?.backchanneling ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Rejection Form */}
        {showRejectForm && (
          <div className="space-y-3 border-2 border-destructive bg-destructive/10 p-4 mt-4">
            <h4 className="font-bold text-destructive">Rejection Reason</h4>
            <Textarea
              placeholder="Explain why this agent is being rejected and what needs to be fixed..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRejectForm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isRejecting}
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirm Reject
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          {isPending && !showRejectForm && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                disabled={isApproving || isRejecting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={onApprove}
                disabled={isApproving || isRejecting}
                className="bg-chart-2 hover:bg-chart-2/90"
              >
                {isApproving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve Agent
              </Button>
            </>
          )}
          {!isPending && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
