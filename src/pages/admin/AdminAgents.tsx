import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AgentReviewDialog } from "@/components/admin/AgentReviewDialog";
import {
  Bot,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

const getStatusConfig = (status: string) => {
  switch (status) {
    case "pending":
      return {
        label: "Pending Review",
        icon: Clock,
        className: "bg-chart-4/20 text-chart-4 border-chart-4",
      };
    case "approved":
      return {
        label: "Approved",
        icon: CheckCircle,
        className: "bg-chart-2/20 text-chart-2 border-chart-2",
      };
    case "rejected":
      return {
        label: "Rejected",
        icon: XCircle,
        className: "bg-destructive/20 text-destructive border-destructive",
      };
    case "active":
      return {
        label: "Active",
        icon: Bot,
        className: "bg-primary/20 text-primary border-primary",
      };
    default:
      return {
        label: status,
        icon: AlertCircle,
        className: "bg-muted text-muted-foreground border-border",
      };
  }
};

export default function AdminAgents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Fetch all agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Agent[];
    },
  });

  // Approve agent mutation
  const approveAgentMutation = useMutation({
    mutationFn: async ({ agentId, taskId }: { agentId: string; taskId: string | null }) => {
      // Update agent status
      const { error: agentError } = await supabase
        .from("agents")
        .update({ status: "approved" })
        .eq("id", agentId);

      if (agentError) throw agentError;

      // If linked to a task, mark task as completed
      if (taskId) {
        const { error: taskError } = await supabase
          .from("tasks")
          .update({ status: "completed" })
          .eq("id", taskId);

        if (taskError) throw taskError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      setReviewDialogOpen(false);
      setSelectedAgent(null);
      toast({
        title: "Agent Approved!",
        description: "The agent has been approved and is now active.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reject agent mutation
  const rejectAgentMutation = useMutation({
    mutationFn: async ({
      agentId,
      taskId,
      reason,
    }: {
      agentId: string;
      taskId: string | null;
      reason: string;
    }) => {
      // Update agent status
      const { error: agentError } = await supabase
        .from("agents")
        .update({ status: "rejected" })
        .eq("id", agentId);

      if (agentError) throw agentError;

      // If linked to a task, mark task as rejected with reason
      if (taskId) {
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            status: "rejected",
            rejection_reason: reason,
          })
          .eq("id", taskId);

        if (taskError) throw taskError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      setReviewDialogOpen(false);
      setSelectedAgent(null);
      toast({
        title: "Agent Rejected",
        description: "The agent has been rejected and sent back for revision.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReviewAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setReviewDialogOpen(true);
  };

  const handleApprove = () => {
    if (selectedAgent) {
      approveAgentMutation.mutate({
        agentId: selectedAgent.id,
        taskId: selectedAgent.task_id,
      });
    }
  };

  const handleReject = (reason: string) => {
    if (selectedAgent) {
      rejectAgentMutation.mutate({
        agentId: selectedAgent.id,
        taskId: selectedAgent.task_id,
        reason,
      });
    }
  };

  // Filter agents
  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingAgents = filteredAgents.filter((a) => a.status === "pending");
  const approvedAgents = filteredAgents.filter((a) => a.status === "approved" || a.status === "active");
  const rejectedAgents = filteredAgents.filter((a) => a.status === "rejected");

  const renderAgentTable = (agentList: Agent[], showActions = true) => (
    <div className="border-2 border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b-2 border-border hover:bg-transparent">
            <TableHead className="font-bold">Agent Name</TableHead>
            <TableHead className="font-bold">Description</TableHead>
            <TableHead className="font-bold">Status</TableHead>
            <TableHead className="font-bold">Created</TableHead>
            <TableHead className="font-bold w-24">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agentList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                No agents found
              </TableCell>
            </TableRow>
          ) : (
            agentList.map((agent) => {
              const statusConfig = getStatusConfig(agent.status);
              const StatusIcon = statusConfig.icon;
              return (
                <TableRow key={agent.id} className="border-b-2 border-border">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {agent.description || "No description"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig.className}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(agent.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReviewAgent(agent)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Agent Management</h1>
            <p className="text-muted-foreground">
              Review, approve, and manage voice agents
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{agents.length}</p>
            <p className="text-sm text-muted-foreground">Total Agents</p>
          </div>
          <div className="border-2 border-chart-4 bg-chart-4/10 p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">{pendingAgents.length}</p>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </div>
          <div className="border-2 border-chart-2 bg-chart-2/10 p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{approvedAgents.length}</p>
            <p className="text-sm text-muted-foreground">Approved</p>
          </div>
          <div className="border-2 border-destructive bg-destructive/10 p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{rejectedAgents.length}</p>
            <p className="text-sm text-muted-foreground">Rejected</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-10 border-2"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
              {pendingAgents.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingAgents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="border-2 border-border bg-card p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="pending">
                {pendingAgents.length === 0 ? (
                  <div className="border-2 border-border bg-card p-8 text-center">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-bold mb-2">No Pending Agents</p>
                    <p className="text-sm text-muted-foreground">
                      All agents have been reviewed.
                    </p>
                  </div>
                ) : (
                  renderAgentTable(pendingAgents)
                )}
              </TabsContent>

              <TabsContent value="approved">
                {renderAgentTable(approvedAgents)}
              </TabsContent>

              <TabsContent value="rejected">
                {renderAgentTable(rejectedAgents)}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Review Dialog */}
      <AgentReviewDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        agent={selectedAgent}
        onApprove={handleApprove}
        onReject={handleReject}
        isApproving={approveAgentMutation.isPending}
        isRejecting={rejectAgentMutation.isPending}
      />
    </DashboardLayout>
  );
}
