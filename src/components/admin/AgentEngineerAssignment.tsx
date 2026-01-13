import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Bot, User, Search, UserPlus } from "lucide-react";

interface AgentEngineerAssignmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentEngineerAssignment({ open, onOpenChange }: AgentEngineerAssignmentProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedEngineer, setSelectedEngineer] = useState<string>("none");

  // Fetch agents with their assigned engineers
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-with-engineers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("id, agent_name, status, engineer_id, client_id")
        .order("agent_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch engineers
  const { data: engineers = [] } = useQuery({
    queryKey: ["engineers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "engineer");
      if (error) throw error;

      const userIds = data.map((r) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (profileError) throw profileError;
      return profiles;
    },
    enabled: open,
  });

  // Fetch engineer profiles for display
  const { data: engineerProfiles = {} } = useQuery({
    queryKey: ["engineer-profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "engineer");
      if (error) throw error;

      const userIds = data.map((r) => r.user_id);
      if (userIds.length === 0) return {};

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      if (profileError) throw profileError;
      
      return profiles.reduce((acc, p) => {
        acc[p.user_id] = p.full_name || p.email;
        return acc;
      }, {} as Record<string, string>);
    },
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ agentId, engineerId }: { agentId: string; engineerId: string | null }) => {
      const { error } = await supabase
        .from("bolna_agents")
        .update({ engineer_id: engineerId })
        .eq("id", agentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents-with-engineers"] });
      toast.success("Agent assignment updated");
      setSelectedAgent(null);
      setSelectedEngineer("none");
    },
    onError: (error) => {
      toast.error(`Failed to assign: ${error.message}`);
    },
  });

  const filteredAgents = agents.filter(
    (agent) =>
      agent.agent_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = (agentId: string) => {
    setSelectedAgent(agentId);
    const agent = agents.find((a) => a.id === agentId);
    setSelectedEngineer(agent?.engineer_id || "none");
  };

  const confirmAssignment = () => {
    if (selectedAgent) {
      assignMutation.mutate({
        agentId: selectedAgent,
        engineerId: selectedEngineer === "none" ? null : selectedEngineer,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Assign Agents to Engineers
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 py-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Engineer</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingAgents ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading agents...
                  </TableCell>
                </TableRow>
              ) : filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAgents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.agent_name}</TableCell>
                    <TableCell>
                      <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                        {agent.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {selectedAgent === agent.id ? (
                        <Select value={selectedEngineer} onValueChange={setSelectedEngineer}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select engineer" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {engineers.map((eng) => (
                              <SelectItem key={eng.user_id} value={eng.user_id}>
                                {eng.full_name || eng.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : agent.engineer_id ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{engineerProfiles[agent.engineer_id] || "Unknown"}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {selectedAgent === agent.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={confirmAssignment}
                            disabled={assignMutation.isPending}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedAgent(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssign(agent.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
