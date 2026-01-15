import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Phone, Loader2 } from "lucide-react";

interface Agent { id: string; agent_name: string; }
interface Props { open: boolean; onOpenChange: (open: boolean) => void; selectedLeadIds: string[]; agents: Agent[]; onSuccess: () => void; }

export function REBulkCallDialog({ open, onOpenChange, selectedLeadIds, agents, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [agentId, setAgentId] = useState("");
  const [calling, setCalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queueStatus, setQueueStatus] = useState({ pending: 0, completed: 0, failed: 0 });

  const handleStartCalls = async () => {
    if (!user || !agentId || selectedLeadIds.length === 0) return;
    setCalling(true);
    setProgress(0);
    
    try {
      // Add all leads to call queue
      const queueItems = selectedLeadIds.map(leadId => ({
        client_id: user.id,
        lead_id: leadId,
        agent_id: agentId,
        status: "pending",
      }));
      
      const { error } = await supabase.from("call_queue").insert(queueItems);
      if (error) throw error;

      toast({ title: "Calls Queued", description: `${selectedLeadIds.length} leads added to call queue` });
      setQueueStatus({ pending: selectedLeadIds.length, completed: 0, failed: 0 });
      
      // Start processing queue via edge function
      const { error: processError } = await supabase.functions.invoke("process-call-queue", {
        body: { client_id: user.id, agent_id: agentId }
      });
      
      if (processError) console.error("Queue processing error:", processError);
      
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCalling(false);
      onOpenChange(false);
    }
  };

  // Subscribe to queue updates
  useEffect(() => {
    if (!open || !user) return;
    
    const channel = supabase.channel("queue-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "call_queue", filter: `client_id=eq.${user.id}` }, (payload) => {
        // Update progress on queue changes
        supabase.from("call_queue").select("status").eq("client_id", user.id).then(({ data }) => {
          if (data) {
            const pending = data.filter(d => d.status === "pending").length;
            const completed = data.filter(d => d.status === "completed").length;
            const failed = data.filter(d => d.status === "failed").length;
            setQueueStatus({ pending, completed, failed });
            const total = pending + completed + failed;
            setProgress(total > 0 ? ((completed + failed) / total) * 100 : 0);
          }
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make Bulk Calls</DialogTitle>
          <DialogDescription>Call {selectedLeadIds.length} selected leads using AI agent</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger><SelectValue placeholder="Choose an agent" /></SelectTrigger>
              <SelectContent>
                {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.agent_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          {calling && (
            <div className="space-y-2">
              <Progress value={progress} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Pending: {queueStatus.pending}</span>
                <span>Completed: {queueStatus.completed}</span>
                <span>Failed: {queueStatus.failed}</span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={calling}>Cancel</Button>
          <Button onClick={handleStartCalls} disabled={!agentId || calling}>
            {calling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <><Phone className="h-4 w-4 mr-2" />Start Calls</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
