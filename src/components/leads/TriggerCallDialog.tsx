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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Phone, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { makeCall } from "@/lib/bolna";
import { useAuth } from "@/contexts/AuthContext";

interface Agent {
  id: string;
  name: string;
}

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
}

interface TriggerCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  agents: Agent[];
  onSuccess: () => void;
}

export function TriggerCallDialog({
  open,
  onOpenChange,
  lead,
  agents,
  onSuccess,
}: TriggerCallDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isCallingLead, setIsCallingLead] = useState(false);

  const handleTriggerCall = async () => {
    if (!lead || !selectedAgentId || !user) return;

    setIsCallingLead(true);

    try {
      const { data, error } = await makeCall({
        lead_id: lead.id,
        agent_id: selectedAgentId,
        client_id: user.id,
      });

      if (error || !data) {
        throw new Error(error || "Failed to initiate call");
      }

      toast({
        title: "Call Initiated!",
        description: `Call queued for ${lead.name || lead.phone_number}`,
      });

      onSuccess();
      onOpenChange(false);
      setSelectedAgentId("");
    } catch (err) {
      console.error("Call error:", err);
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: err instanceof Error ? err.message : "Failed to initiate call",
      });
    } finally {
      setIsCallingLead(false);
    }
  };

  const handleClose = () => {
    setSelectedAgentId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Trigger Call
          </DialogTitle>
          <DialogDescription>
            {lead
              ? `Call ${lead.name || "lead"} at ${lead.phone_number}`
              : "Select a lead to call"}
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="space-y-4">
            {/* Lead Info */}
            <div className="p-3 bg-muted/50 border-2 border-border">
              <div className="text-sm">
                <p className="font-medium">{lead.name || "Unknown"}</p>
                <p className="font-mono text-muted-foreground">{lead.phone_number}</p>
              </div>
            </div>

            {/* Agent Selection */}
            <div className="space-y-2">
              <Label>Select Agent</Label>
              {agents.length > 0 ? (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 border-2 border-border">
                  No agents available. Please contact admin to assign agents.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isCallingLead}>
            Cancel
          </Button>
          <Button
            onClick={handleTriggerCall}
            disabled={isCallingLead || !selectedAgentId || !lead}
          >
            {isCallingLead ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Calling...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-2" />
                Start Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
