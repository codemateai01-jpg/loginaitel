import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Phone, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Play,
  Pause,
  StopCircle,
  RefreshCw
} from "lucide-react";

interface BulkCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  agentId: string | null;
  selectedLeadIds: string[];
  concurrencyLevel: number;
}

interface QueueStatus {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  retry_pending: number;
  max_retries_reached: number;
}

export function BulkCallDialog({
  open,
  onOpenChange,
  campaignId,
  agentId,
  selectedLeadIds,
  concurrencyLevel,
}: BulkCallDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    retry_pending: 0,
    max_retries_reached: 0,
  });

  // Fetch queue status for this campaign
  const { data: queueItems, refetch: refetchQueue } = useQuery({
    queryKey: ["campaign-queue", campaignId],
    enabled: open,
    refetchInterval: isProcessing ? 2000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_call_queue")
        .select("id, status, lead_id, error_message")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate status counts
  useEffect(() => {
    if (queueItems) {
      setQueueStatus({
        pending: queueItems.filter(q => q.status === "pending").length,
        in_progress: queueItems.filter(q => q.status === "in_progress").length,
        completed: queueItems.filter(q => q.status === "completed").length,
        failed: queueItems.filter(q => q.status === "failed").length,
        retry_pending: queueItems.filter(q => q.status === "retry_pending").length,
        max_retries_reached: queueItems.filter(q => q.status === "max_retries_reached").length,
      });

      // Stop polling if no pending/in_progress/retry_pending items
      if (!queueItems.some(q => ["pending", "in_progress", "retry_pending"].includes(q.status))) {
        setIsProcessing(false);
      }
    }
  }, [queueItems]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`campaign-queue-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_call_queue",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          refetchQueue();
          queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, campaignId, refetchQueue, queryClient]);

  // Queue selected leads mutation
  const queueLeads = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error("No agent assigned to this campaign");
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Not authenticated");

      // Get lead details
      const { data: leads, error: leadsError } = await supabase
        .from("campaign_leads")
        .select("id, phone_number, name")
        .in("id", selectedLeadIds);

      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) throw new Error("No valid leads found");

      // Check for already queued leads
      const { data: existingQueue } = await supabase
        .from("campaign_call_queue")
        .select("lead_id")
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "in_progress"])
        .in("lead_id", selectedLeadIds);

      const alreadyQueued = new Set(existingQueue?.map(q => q.lead_id) || []);
      const leadsToQueue = leads.filter(l => !alreadyQueued.has(l.id));

      if (leadsToQueue.length === 0) {
        throw new Error("All selected leads are already in the queue");
      }

      // Insert into queue
      const queueItems = leadsToQueue.map((lead, index) => ({
        campaign_id: campaignId,
        lead_id: lead.id,
        client_id: session.session.user.id,
        agent_id: agentId,
        priority: selectedLeadIds.length - index, // Higher priority for earlier selections
        status: "pending",
      }));

      const { error: insertError } = await supabase
        .from("campaign_call_queue")
        .insert(queueItems);

      if (insertError) throw insertError;

      return leadsToQueue.length;
    },
    onSuccess: (count) => {
      toast({ 
        title: "Leads queued", 
        description: `${count} leads added to call queue` 
      });
      refetchQueue();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Process queue mutation
  const processQueue = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("process-campaign-calls", {
        body: { campaign_id: campaignId },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.processed > 0) {
        toast({ 
          title: "Calls initiated", 
          description: `${data.successful} calls started, ${data.failed} failed` 
        });
      }
      refetchQueue();
      queryClient.invalidateQueries({ queryKey: ["campaign-leads"] });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Processing error", 
        description: error.message, 
        variant: "destructive" 
      });
      setIsProcessing(false);
    },
  });

  // Cancel pending queue items
  const cancelQueue = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaign_call_queue")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("campaign_id", campaignId)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Queue cancelled" });
      setIsProcessing(false);
      refetchQueue();
    },
  });

  // Retry failed leads mutation
  const retryFailed = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error("No agent assigned to this campaign");
      
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Not authenticated");

      // Get failed queue items for this campaign
      const { data: failedItems, error: fetchError } = await supabase
        .from("campaign_call_queue")
        .select("id, lead_id")
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      if (fetchError) throw fetchError;
      if (!failedItems || failedItems.length === 0) throw new Error("No failed items to retry");

      // Reset failed items to pending
      const { error: updateError } = await supabase
        .from("campaign_call_queue")
        .update({ 
          status: "pending", 
          error_message: null,
          started_at: null,
          completed_at: null
        })
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      if (updateError) throw updateError;

      return failedItems.length;
    },
    onSuccess: (count) => {
      toast({ 
        title: "Retrying failed calls", 
        description: `${count} leads re-queued for calling` 
      });
      setIsProcessing(true);
      processQueue.mutate();
      refetchQueue();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleStartCalling = async () => {
    // First queue the leads
    await queueLeads.mutateAsync();
    setIsProcessing(true);
    
    // Then start processing
    processQueue.mutate();
  };

  const handleProcessMore = () => {
    setIsProcessing(true);
    processQueue.mutate();
  };

  const totalInQueue = queueStatus.pending + queueStatus.in_progress + queueStatus.completed + queueStatus.failed + queueStatus.retry_pending + queueStatus.max_retries_reached;
  const completedCount = queueStatus.completed + queueStatus.failed + queueStatus.max_retries_reached;
  const progressPercent = totalInQueue > 0 
    ? (completedCount / totalInQueue) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Bulk Call - {selectedLeadIds.length} Leads
          </DialogTitle>
          <DialogDescription>
            Calls will be made with a concurrency of {concurrencyLevel} at a time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!agentId && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span>No agent assigned to this campaign. Please assign an agent first.</span>
            </div>
          )}

          {/* Queue Status */}
          {totalInQueue > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{completedCount} / {totalInQueue}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border rounded p-2">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{queueStatus.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="border rounded p-2">
                  <Loader2 className="h-4 w-4 mx-auto mb-1 text-blue-500 animate-spin" />
                  <p className="text-lg font-bold text-blue-600">{queueStatus.in_progress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="border rounded p-2">
                  <RefreshCw className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                  <p className="text-lg font-bold text-orange-600">{queueStatus.retry_pending}</p>
                  <p className="text-xs text-muted-foreground">Retry Pending</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="border rounded p-2">
                  <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-bold text-green-600">{queueStatus.completed}</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
                <div className="border rounded p-2">
                  <XCircle className="h-4 w-4 mx-auto mb-1 text-red-500" />
                  <p className="text-lg font-bold text-red-600">{queueStatus.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div className="border rounded p-2">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                  <p className="text-lg font-bold text-yellow-600">{queueStatus.max_retries_reached}</p>
                  <p className="text-xs text-muted-foreground">Max Retries</p>
                </div>
              </div>
            </div>
          )}

          {/* Failed items list */}
          {queueItems?.some(q => q.status === "failed") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-destructive">Failed Calls</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryFailed.mutate()}
                  disabled={retryFailed.isPending || isProcessing}
                  className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10"
                >
                  {retryFailed.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Retry All ({queueStatus.failed})
                </Button>
              </div>
              <ScrollArea className="h-24 rounded border">
                <div className="p-2 space-y-1">
                  {queueItems
                    .filter(q => q.status === "failed")
                    .map(item => (
                      <div key={item.id} className="text-xs text-muted-foreground">
                        {item.error_message || "Unknown error"}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Info message */}
          <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
            <p><strong>Selected:</strong> {selectedLeadIds.length} leads</p>
            <p><strong>Concurrency:</strong> {concurrencyLevel} simultaneous calls</p>
            <p className="text-muted-foreground text-xs">
              Calls are processed automatically. Status updates in real-time.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {queueStatus.pending > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => cancelQueue.mutate()}
              disabled={cancelQueue.isPending}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              Cancel Queue
            </Button>
          )}
          
          {totalInQueue === 0 ? (
            <Button 
              onClick={handleStartCalling}
              disabled={!agentId || queueLeads.isPending || selectedLeadIds.length === 0}
            >
              {queueLeads.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Calling
            </Button>
          ) : queueStatus.pending > 0 && !isProcessing ? (
            <Button onClick={handleProcessMore}>
              <Play className="h-4 w-4 mr-2" />
              Resume Processing
            </Button>
          ) : isProcessing ? (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
