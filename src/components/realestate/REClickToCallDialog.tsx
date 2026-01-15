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
import { Badge } from "@/components/ui/badge";
import { Phone, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { makeCall } from "@/lib/aitel";

interface Agent {
  id: string;
  agent_name: string;
  external_agent_id?: string;
}

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  stage: string;
}

interface REClickToCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  agents: Agent[];
  onSuccess: () => void;
}

export function REClickToCallDialog({
  open,
  onOpenChange,
  lead,
  agents,
  onSuccess,
}: REClickToCallDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [calling, setCalling] = useState(false);

  const handleCall = async () => {
    if (!lead || !selectedAgentId || !user) return;

    const selectedAgent = agents.find((a) => a.id === selectedAgentId);
    if (!selectedAgent) return;

    setCalling(true);

    try {
      // Make the call via Aitel API - uses the internal agent_id which is resolved server-side
      const response = await makeCall({
        agent_id: selectedAgentId,
        lead_id: lead.id,
        client_id: user.id,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.data?.success) {
        throw new Error("Failed to initiate call");
      }

      // Update lead's last call time
      await supabase
        .from("real_estate_leads")
        .update({ last_call_at: new Date().toISOString() })
        .eq("id", lead.id);

      toast({
        title: "Call Initiated",
        description: `Calling ${lead.name || lead.phone_number}...`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error making call:", error);
      toast({
        title: "Call Failed",
        description: error instanceof Error ? error.message : "Failed to initiate call",
        variant: "destructive",
      });
    } finally {
      setCalling(false);
    }
  };

  const handleClose = () => {
    if (!calling) {
      setSelectedAgentId("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Click to Call
          </DialogTitle>
          <DialogDescription>
            Initiate a call to this lead using your AI agent
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="space-y-4">
            {/* Lead Info */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{lead.name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {lead.phone_number}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  {lead.stage}
                </Badge>
              </div>
            </div>

            {/* Agent Selection */}
            <div className="space-y-2">
              <Label>Select Agent</Label>
              {agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active agents available. Please create an agent first.
                </p>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agent_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={calling}>
            Cancel
          </Button>
          <Button
            onClick={handleCall}
            disabled={!selectedAgentId || calling || agents.length === 0}
          >
            {calling ? (
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
