import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  Phone, 
  Users, 
  CheckCircle, 
  XCircle,
  Loader2,
  StopCircle,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { 
  type Batch, 
  type CallExecution,
  listBatchExecutions, 
  scheduleBatch, 
  stopBatch 
} from "@/lib/bolna";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BatchDetailsDialogProps {
  batch: Batch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

export function BatchDetailsDialog({ batch, open, onOpenChange, onRefresh }: BatchDetailsDialogProps) {
  const [scheduleDate, setScheduleDate] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const { data: executions, isLoading: executionsLoading, refetch } = useQuery({
    queryKey: ["batch-executions", batch?.batch_id],
    queryFn: async () => {
      if (!batch?.batch_id) return [];
      const result = await listBatchExecutions(batch.batch_id);
      if (result.error) throw new Error(result.error);
      return result.data || [];
    },
    enabled: !!batch?.batch_id && open,
  });

  const handleSchedule = async () => {
    if (!batch?.batch_id || !scheduleDate) {
      toast.error("Please select a schedule date");
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledAt = new Date(scheduleDate).toISOString();
      const result = await scheduleBatch(batch.batch_id, scheduledAt);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Batch scheduled successfully!");
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to schedule batch");
    } finally {
      setIsScheduling(false);
    }
  };

  const handleStop = async () => {
    if (!batch?.batch_id) return;

    setIsStopping(true);
    try {
      const result = await stopBatch(batch.batch_id);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Batch stopped successfully!");
      onRefresh?.();
    } catch (error) {
      toast.error("Failed to stop batch");
    } finally {
      setIsStopping(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      created: { variant: "outline", className: "border-chart-4 text-chart-4" },
      scheduled: { variant: "outline", className: "border-chart-1 text-chart-1" },
      queued: { variant: "secondary", className: "" },
      executed: { variant: "default", className: "bg-chart-2" },
    };
    const config = statusConfig[status] || { variant: "outline" as const, className: "" };
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
  };

  const getExecutionStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-chart-2/10 text-chart-2 border-chart-2",
      "in-progress": "bg-chart-4/10 text-chart-4 border-chart-4",
      queued: "bg-muted text-muted-foreground border-border",
      ringing: "bg-chart-1/10 text-chart-1 border-chart-1",
      failed: "bg-destructive/10 text-destructive border-destructive",
      "no-answer": "bg-muted text-muted-foreground border-border",
    };
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium border rounded ${colors[status] || colors.queued}`}>
        {status}
      </span>
    );
  };

  if (!batch) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Batch Details
                {getStatusBadge(batch.status)}
              </DialogTitle>
              <DialogDescription>
                ID: {batch.batch_id}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-border p-4 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Contacts</span>
                </div>
                <p className="text-2xl font-bold">
                  {batch.valid_contacts || 0} / {batch.total_contacts || 0}
                </p>
                <p className="text-xs text-muted-foreground">Valid / Total</p>
              </div>

              <div className="border-2 border-border p-4 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">From Number</span>
                </div>
                <p className="text-lg font-mono">
                  {batch.from_phone_number || "Not set"}
                </p>
              </div>

              <div className="border-2 border-border p-4 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Created</span>
                </div>
                <p className="text-sm font-medium">
                  {batch.created_at ? format(new Date(batch.created_at), "PPp") : "N/A"}
                </p>
              </div>

              <div className="border-2 border-border p-4 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Scheduled At</span>
                </div>
                <p className="text-sm font-medium">
                  {batch.scheduled_at ? format(new Date(batch.scheduled_at), "PPp") : "Not scheduled"}
                </p>
              </div>
            </div>

            {/* Execution Status Breakdown */}
            {batch.execution_status && Object.keys(batch.execution_status).length > 0 && (
              <div className="border-2 border-border p-4 rounded-lg">
                <h4 className="font-medium mb-3">Execution Status</h4>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Object.entries(batch.execution_status).map(([status, count]) => (
                    <div key={status} className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{status}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="executions" className="flex-1 min-h-0">
            <ScrollArea className="h-[350px]">
              {executionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : executions && executions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((exec: CallExecution) => (
                      <TableRow key={exec.id}>
                        <TableCell className="font-mono text-sm">
                          {exec.telephony_data?.to_number || "N/A"}
                        </TableCell>
                        <TableCell>{getExecutionStatusBadge(exec.status)}</TableCell>
                        <TableCell>
                          {exec.conversation_time ? `${Math.round(exec.conversation_time)}s` : "-"}
                        </TableCell>
                        <TableCell>
                          {exec.total_cost ? `$${(exec.total_cost / 100).toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {exec.created_at ? format(new Date(exec.created_at), "Pp") : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Phone className="h-8 w-8 mb-2" />
                  <p>No executions yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            {/* Schedule Batch */}
            {(batch.status === "created" || batch.status === "scheduled") && (
              <div className="border-2 border-border p-4 rounded-lg space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Schedule Batch
                </h4>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="scheduleDate" className="sr-only">Schedule Date</Label>
                    <Input
                      id="scheduleDate"
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                  <Button onClick={handleSchedule} disabled={isScheduling || !scheduleDate}>
                    {isScheduling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Schedule"
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Stop Batch */}
            {(batch.status === "queued" || batch.status === "scheduled") && (
              <div className="border-2 border-destructive/50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-destructive">
                  <StopCircle className="h-4 w-4" />
                  Stop Batch
                </h4>
                <p className="text-sm text-muted-foreground">
                  This will stop all pending calls in the batch. Calls already in progress will complete.
                </p>
                <Button variant="destructive" onClick={handleStop} disabled={isStopping}>
                  {isStopping ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  Stop Batch
                </Button>
              </div>
            )}

            {batch.status === "executed" && (
              <div className="border-2 border-chart-2/50 p-4 rounded-lg flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-chart-2" />
                <div>
                  <h4 className="font-medium">Batch Completed</h4>
                  <p className="text-sm text-muted-foreground">
                    All calls in this batch have been executed.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
