import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Bot, RefreshCw, Link, Unlink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listPhoneNumbers, assignPhoneNumberToAgent, type PhoneNumber } from "@/lib/bolna";
import { supabase } from "@/integrations/supabase/client";

interface Agent {
  id: string;
  external_agent_id: string;
  agent_name: string;
  client_id: string | null;
}

interface PhoneNumberAssignmentProps {
  filterByClientId?: string;
  showClientColumn?: boolean;
}

export function PhoneNumberAssignment({ 
  filterByClientId, 
  showClientColumn = true 
}: PhoneNumberAssignmentProps) {
  const queryClient = useQueryClient();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // Fetch phone numbers
  const { data: phoneNumbers, isLoading: loadingPhones, refetch } = useQuery({
    queryKey: ["phone-numbers-assignment"],
    queryFn: async () => {
      const response = await listPhoneNumbers();
      if (response.error) throw new Error(response.error);
      return response.data || [];
    },
  });

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["agents-for-phone-assignment", filterByClientId],
    queryFn: async () => {
      let query = supabase
        .from("aitel_agents" as any)
        .select("id, external_agent_id, agent_name, client_id")
        .eq("status", "active");

      if (filterByClientId) {
        query = query.eq("client_id", filterByClientId);
      }

      const { data, error } = await query.order("agent_name");
      if (error) throw error;
      return (data || []) as Agent[];
    },
  });

  // Fetch profiles for client names
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-phone"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");
      if (error) throw error;
      return data || [];
    },
    enabled: showClientColumn,
  });

  // Assignment mutation
  const assignMutation = useMutation({
    mutationFn: async ({ phoneId, agentId }: { phoneId: string; agentId: string | null }) => {
      const result = await assignPhoneNumberToAgent({
        phone_number_id: phoneId,
        agent_id: agentId,
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success(selectedAgentId ? "Phone number assigned successfully" : "Phone number unassigned");
      queryClient.invalidateQueries({ queryKey: ["phone-numbers-assignment"] });
      setAssignDialogOpen(false);
      setSelectedPhone(null);
      setSelectedAgentId("");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to assign phone number");
    },
  });

  const getAgentName = (agentId?: string) => {
    if (!agentId || !agents) return null;
    const agent = agents.find((a) => a.external_agent_id === agentId);
    return agent?.agent_name || null;
  };

  const getClientName = (agentId?: string) => {
    if (!agentId || !agents || !profiles) return null;
    const agent = agents.find((a) => a.external_agent_id === agentId);
    if (!agent?.client_id) return null;
    const profile = profiles.find((p) => p.user_id === agent.client_id);
    return profile?.full_name || profile?.email || null;
  };

  const handleAssignClick = (phone: PhoneNumber) => {
    setSelectedPhone(phone);
    // Pre-select current agent if assigned
    const currentAgent = agents?.find((a) => a.external_agent_id === phone.agent_id);
    setSelectedAgentId(currentAgent?.id || "");
    setAssignDialogOpen(true);
  };

  const handleAssign = () => {
    if (!selectedPhone) return;
    
    const agent = agents?.find((a) => a.id === selectedAgentId);
    assignMutation.mutate({
      phoneId: selectedPhone.id,
      agentId: agent?.external_agent_id || null,
    });
  };

  const handleUnassign = (phone: PhoneNumber) => {
    assignMutation.mutate({
      phoneId: phone.id,
      agentId: null,
    });
  };

  const getProviderBadgeVariant = (provider: string) => {
    switch (provider) {
      case "twilio":
        return "default";
      case "plivo":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Stats
  const totalNumbers = phoneNumbers?.length || 0;
  const assignedNumbers = phoneNumbers?.filter((p) => p.agent_id).length || 0;
  const unassignedNumbers = totalNumbers - assignedNumbers;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Phone Number Assignments
              </CardTitle>
              <CardDescription>
                Assign phone numbers to agents for outbound and inbound calls
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{totalNumbers}</p>
              <p className="text-xs text-muted-foreground">Total Numbers</p>
            </div>
            <div className="bg-chart-2/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-chart-2">{assignedNumbers}</p>
              <p className="text-xs text-muted-foreground">Assigned</p>
            </div>
            <div className="bg-chart-4/10 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-chart-4">{unassignedNumbers}</p>
              <p className="text-xs text-muted-foreground">Unassigned</p>
            </div>
          </div>

          {/* Table */}
          {loadingPhones ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : phoneNumbers && phoneNumbers.length > 0 ? (
            <div className="border-2 border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    {showClientColumn && <TableHead>Client</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phoneNumbers.map((phone) => {
                    const agentName = getAgentName(phone.agent_id);
                    const clientName = getClientName(phone.agent_id);
                    
                    return (
                      <TableRow key={phone.id}>
                        <TableCell className="font-mono font-medium">
                          {phone.phone_number}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getProviderBadgeVariant(phone.telephony_provider)}>
                            {phone.telephony_provider}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {agentName ? (
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-primary" />
                              <span>{agentName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        {showClientColumn && (
                          <TableCell>
                            {clientName ? (
                              <span>{clientName}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          {phone.agent_id ? (
                            <Badge variant="default" className="bg-chart-2">
                              <Link className="h-3 w-3 mr-1" />
                              Assigned
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <Unlink className="h-3 w-3 mr-1" />
                              Available
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignClick(phone)}
                            >
                              <Bot className="h-4 w-4 mr-1" />
                              {phone.agent_id ? "Reassign" : "Assign"}
                            </Button>
                            {phone.agent_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnassign(phone)}
                                disabled={assignMutation.isPending}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No phone numbers available</p>
              <p className="text-sm">Phone numbers will appear here once configured</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Phone Number</DialogTitle>
            <DialogDescription>
              Assign <span className="font-mono font-medium">{selectedPhone?.phone_number}</span> to an agent
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Agent</label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        {agent.agent_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedAgentId && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm">
                  <strong>Agent:</strong>{" "}
                  {agents?.find((a) => a.id === selectedAgentId)?.agent_name}
                </p>
                {showClientColumn && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Client:</strong>{" "}
                    {(() => {
                      const agent = agents?.find((a) => a.id === selectedAgentId);
                      if (!agent?.client_id) return "Not assigned";
                      const profile = profiles?.find((p) => p.user_id === agent.client_id);
                      return profile?.full_name || profile?.email || "Unknown";
                    })()}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedAgentId || assignMutation.isPending}
            >
              {assignMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
