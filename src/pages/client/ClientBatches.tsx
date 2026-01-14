import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Phone, 
  Calendar, 
  Users, 
  RefreshCw,
  Eye,
  Trash2,
  Loader2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listBatches, deleteBatch, type Batch } from "@/lib/bolna";
import { format } from "date-fns";
import { CreateBatchDialog } from "@/components/batch/CreateBatchDialog";
import { BatchDetailsDialog } from "@/components/batch/BatchDetailsDialog";
import { ScheduleBatchDialog } from "@/components/batch/ScheduleBatchDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

export default function ClientBatches() {
  const { role } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [batchToSchedule, setBatchToSchedule] = useState<Batch | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["bolna-agents-for-batch-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents" as any)
        .select("id, agent_name, external_agent_id")
        .eq("status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch batches for selected agent
  const { data: batches, isLoading, refetch } = useQuery({
    queryKey: ["batches", selectedAgent],
    queryFn: async () => {
      if (selectedAgent === "all" || !agents) {
        // Fetch batches for all agents
        const allBatches: Batch[] = [];
        for (const agent of agents || []) {
          if (agent.external_agent_id) {
            const result = await listBatches(agent.external_agent_id);
            if (result.data) {
              allBatches.push(...result.data);
            }
          }
        }
        return allBatches.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      } else {
        const agent = agents.find((a: any) => a.id === selectedAgent);
        if (!agent?.external_agent_id) return [];
        const result = await listBatches(agent.external_agent_id);
        if (result.error) throw new Error(result.error);
        return result.data || [];
      }
    },
    enabled: !!agents && agents.length > 0,
  });

  const handleViewDetails = (batch: Batch) => {
    setSelectedBatch(batch);
    setDetailsDialogOpen(true);
  };

  const handleScheduleClick = (batch: Batch) => {
    setBatchToSchedule(batch);
    setScheduleDialogOpen(true);
  };

  const handleDeleteClick = (batchId: string) => {
    setBatchToDelete(batchId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!batchToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteBatch(batchToDelete);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Batch deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete batch");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setBatchToDelete(null);
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

  return (
    <DashboardLayout role={role === "admin" ? "admin" : "client"}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Batch Calls</h1>
            <p className="text-muted-foreground">
              Create and manage batch calling campaigns.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Quick Create
            </Button>
            <Button onClick={() => window.location.href = "/client/batches/create"}>
              <Users className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.agent_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Batches Table */}
        <div className="border-2 border-border bg-card rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : batches && batches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>From Number</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.batch_id}>
                    <TableCell className="font-mono text-sm">
                      {batch.batch_id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{batch.valid_contacts || 0} / {batch.total_contacts || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {batch.from_phone_number || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {batch.humanized_created_at || 
                        (batch.created_at ? format(new Date(batch.created_at), "PP") : "-")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {batch.scheduled_at ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-chart-1" />
                          {format(new Date(batch.scheduled_at), "Pp")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not scheduled</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(batch)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {batch.status === "created" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleScheduleClick(batch)}
                            title="Schedule Batch"
                          >
                            <Clock className="h-4 w-4 text-chart-1" />
                          </Button>
                        )}
                        {(role === "admin" || role === "client") && batch.status !== "executed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(batch.batch_id)}
                            title="Delete Batch"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Phone className="h-12 w-12 mb-4" />
              <h3 className="font-medium text-lg mb-1">No batches yet</h3>
              <p className="text-sm mb-4">Create your first batch calling campaign</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Batch
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateBatchDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />

      <BatchDetailsDialog
        batch={selectedBatch}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onRefresh={() => refetch()}
      />

      <ScheduleBatchDialog
        batch={batchToSchedule}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSuccess={() => refetch()}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this batch? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
