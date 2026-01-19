import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listAitelAgents, getAitelAgent } from "@/lib/aitel";
import { fetchClientsWithStats } from "@/lib/secure-proxy";
import {
  Bot,
  RefreshCw,
  Search,
  Users,
  Download,
  Eye,
  Loader2,
  Wrench,
  Webhook,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { AgentEngineerAssignment } from "@/components/admin/AgentEngineerAssignment";
import { WebhookConfigDialog } from "@/components/admin/WebhookConfigDialog";

interface AgentFromAPI {
  id: string;
  agent_name: string;
  agent_type?: string;
  agent_status?: string;
  agent_prompts?: {
    task_1?: {
      system_prompt?: string;
    };
  };
}

interface SyncedAgent {
  id: string;
  external_agent_id: string;
  agent_name: string;
  client_id: string | null;
  original_system_prompt: string | null;
  current_system_prompt: string | null;
  agent_config: Record<string, unknown>;
  status: string;
  synced_at: string;
}

interface Client {
  user_id: string;
  display_name: string;
  display_email: string;
}

export default function AdminAgents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SyncedAgent | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [engineerAssignOpen, setEngineerAssignOpen] = useState(false);
  const [webhookAgent, setWebhookAgent] = useState<SyncedAgent | null>(null);

  // Fetch synced agents from our database
  const { data: syncedAgents, isLoading: loadingAgents } = useQuery({
    queryKey: ["synced-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("*")
        .order("synced_at", { ascending: false });

      if (error) throw error;
      return data as SyncedAgent[];
    },
  });

  // Fetch clients for assignment via secure proxy
  const { data: clients } = useQuery({
    queryKey: ["clients-for-assignment"],
    queryFn: async () => {
      const clientsWithStats = await fetchClientsWithStats();
      return clientsWithStats.map((c) => ({
        user_id: c.user_id,
        display_name: c.display_name,
        display_email: c.display_email,
      })) as Client[];
    },
  });

  // Sync agents from Aitel
  const handleSyncAgents = async () => {
    setIsSyncing(true);
    try {
      const { data: aitelAgents, error } = await listAitelAgents();

      if (error || !aitelAgents) {
        throw new Error(error || "Failed to fetch agents");
      }

      let synced = 0;
      let updated = 0;

      for (const agent of aitelAgents as AgentFromAPI[]) {
        // Get full agent details including prompts
        const { data: fullAgent } = await getAitelAgent(agent.id);
        
        const systemPrompt = (fullAgent as AgentFromAPI)?.agent_prompts?.task_1?.system_prompt || "";
        const agentConfig = fullAgent || agent;

        // Check if already exists
        const { data: existing } = await supabase
          .from("aitel_agents")
          .select("id")
          .eq("external_agent_id", agent.id)
          .maybeSingle();

        if (existing) {
          // Update existing
          await supabase
            .from("aitel_agents")
            .update({
              agent_name: agent.agent_name,
              agent_config: JSON.parse(JSON.stringify(agentConfig)),
              original_system_prompt: systemPrompt,
              synced_at: new Date().toISOString(),
            })
            .eq("external_agent_id", agent.id);
          updated++;
        } else {
          // Insert new
          await supabase.from("aitel_agents").insert([{
            external_agent_id: agent.id,
            agent_name: agent.agent_name,
            original_system_prompt: systemPrompt,
            current_system_prompt: systemPrompt,
            agent_config: JSON.parse(JSON.stringify(agentConfig)),
          }]);
          synced++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["synced-agents"] });

      toast({
        title: "Sync Complete",
        description: `${synced} new agents synced, ${updated} updated.`,
      });
    } catch (error) {
      console.error("Sync error:", error);
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Assign agent to client
  const assignMutation = useMutation({
    mutationFn: async ({
      agentId,
      clientId,
    }: {
      agentId: string;
      clientId: string | null;
    }) => {
      const { error } = await supabase
        .from("aitel_agents")
        .update({ client_id: clientId })
        .eq("id", agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synced-agents"] });
      setAssignDialogOpen(false);
      toast({
        title: "Agent Assigned",
        description: "Agent has been assigned to the client.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign",
      });
    },
  });

  const filteredAgents = syncedAgents?.filter(
    (agent) =>
      agent.agent_name.toLowerCase().includes(search.toLowerCase()) ||
      agent.external_agent_id.toLowerCase().includes(search.toLowerCase())
  );

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Unassigned";
    const client = clients?.find((c) => c.user_id === clientId);
    return client?.display_name || client?.display_email || "Unknown";
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-accent border-2 border-border">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Agent Management</h1>
            <p className="text-sm text-muted-foreground">
              Sync and assign agents to clients
            </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEngineerAssignOpen(true)}>
              <Wrench className="h-4 w-4 mr-2" />
              Assign to Engineers
            </Button>
            <Button onClick={handleSyncAgents} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Sync Agents
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total Agents</p>
            <p className="text-2xl font-bold">{syncedAgents?.length || 0}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold">
              {syncedAgents?.filter((a) => a.client_id).length || 0}
            </p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Unassigned</p>
            <p className="text-2xl font-bold">
              {syncedAgents?.filter((a) => !a.client_id).length || 0}
            </p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Active Clients</p>
            <p className="text-2xl font-bold">{clients?.length || 0}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-10 border-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Agents Table */}
        <div className="border-2 border-border bg-card">
          {loadingAgents ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Bot className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No agents found</p>
              <Button variant="outline" onClick={handleSyncAgents}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Agents
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent Name</TableHead>
                  <TableHead>Agent ID</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents?.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">
                      {agent.agent_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1">
                        {agent.external_agent_id.slice(0, 8)}...
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={agent.client_id ? "default" : "outline"}
                        className={agent.client_id ? "" : "text-muted-foreground"}
                      >
                        {getClientName(agent.client_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={agent.status === "active" ? "default" : "secondary"}
                      >
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(agent.synced_at), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setWebhookAgent(agent)}
                          title="Webhook Config"
                        >
                          <Webhook className="h-4 w-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" title="View Prompt">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>{agent.agent_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">
                                  Current System Prompt
                                </label>
                                <pre className="text-sm bg-muted p-3 rounded max-h-64 overflow-auto whitespace-pre-wrap">
                                  {agent.current_system_prompt || "No prompt available"}
                                </pre>
                              </div>
                              {agent.original_system_prompt && agent.original_system_prompt !== agent.current_system_prompt && (
                                <div>
                                  <label className="text-sm font-medium">
                                    Original System Prompt
                                  </label>
                                  <pre className="text-sm bg-muted p-3 rounded max-h-48 overflow-auto whitespace-pre-wrap">
                                    {agent.original_system_prompt}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAgent(agent);
                            setSelectedClientId(agent.client_id || "");
                            setAssignDialogOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Assign
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Agent to Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Agent: <strong>{selectedAgent?.agent_name}</strong>
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Client</label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                >
                  <SelectTrigger className="border-2">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.user_id} value={client.user_id}>
                        {client.display_name || client.display_email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setAssignDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedAgent) {
                      assignMutation.mutate({
                        agentId: selectedAgent.id,
                        clientId:
                          selectedClientId === "unassigned"
                            ? null
                            : selectedClientId,
                      });
                    }
                  }}
                  disabled={assignMutation.isPending}
                >
                  {assignMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Assign"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Engineer Assignment Dialog */}
        <AgentEngineerAssignment
          open={engineerAssignOpen}
          onOpenChange={setEngineerAssignOpen}
        />

        {/* Webhook Config Dialog */}
        {webhookAgent && (
          <WebhookConfigDialog
            open={!!webhookAgent}
            onOpenChange={(open) => !open && setWebhookAgent(null)}
            agentId={webhookAgent.external_agent_id}
            agentName={webhookAgent.agent_name}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
