import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Phone, Loader2, User, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { makeCall } from "@/lib/bolna";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CallProgressTracker } from "@/components/calls/CallProgressTracker";

interface MakeCallPageProps {
  role: "admin" | "engineer" | "client";
}

interface Agent {
  id: string;
  agent_name: string;
  bolna_agent_id: string;
  client_id: string | null;
}

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  client_id: string;
}

interface RecentCall {
  id: string;
  status: string;
  created_at: string;
  agent_id: string;
  duration_seconds?: number;
  external_call_id?: string;
  lead: {
    name: string | null;
    phone_number: string;
  } | null;
  agent: {
    agent_name: string;
  } | null;
}

interface ActiveCall {
  id: string;
  status: string;
  created_at: string;
  lead_name?: string;
  phone_number?: string;
  agent_name?: string;
  external_call_id?: string;
  duration_seconds?: number;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  initiated: { label: "Initiated", icon: <Phone className="h-4 w-4" />, className: "bg-blue-500/20 text-blue-600" },
  queued: { label: "Queued", icon: <Clock className="h-4 w-4" />, className: "bg-muted text-muted-foreground" },
  ringing: { label: "Ringing", icon: <Phone className="h-4 w-4 animate-pulse" />, className: "bg-yellow-500/20 text-yellow-600" },
  "in-progress": { label: "In Progress", icon: <Phone className="h-4 w-4" />, className: "bg-green-500/20 text-green-600" },
  completed: { label: "Completed", icon: <CheckCircle className="h-4 w-4" />, className: "bg-green-500/20 text-green-600" },
  failed: { label: "Failed", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/20 text-destructive" },
  "no-answer": { label: "No Answer", icon: <AlertCircle className="h-4 w-4" />, className: "bg-yellow-500/20 text-yellow-600" },
  busy: { label: "Busy", icon: <AlertCircle className="h-4 w-4" />, className: "bg-yellow-500/20 text-yellow-600" },
  canceled: { label: "Canceled", icon: <XCircle className="h-4 w-4" />, className: "bg-muted text-muted-foreground" },
  "call-disconnected": { label: "Disconnected", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/20 text-destructive" },
};

const ACTIVE_STATUSES = ["initiated", "queued", "ringing", "in-progress"];

export default function MakeCallPage({ role }: MakeCallPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callMode, setCallMode] = useState<"lead" | "manual">("lead");
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);

  // Fetch agents
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-for-call", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("bolna_agents")
        .select("id, agent_name, bolna_agent_id, client_id")
        .eq("status", "active");

      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query.order("agent_name");
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user,
  });

  // Fetch leads
  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["leads-for-call", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, name, phone_number, client_id");

      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query.order("name").limit(100);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user,
  });

  // Fetch recent calls with agent info
  const { data: recentCalls = [], refetch: refetchCalls } = useQuery({
    queryKey: ["recent-calls", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("calls")
        .select(`
          id,
          status,
          created_at,
          agent_id,
          duration_seconds,
          external_call_id,
          lead:leads(name, phone_number)
        `)
        .order("created_at", { ascending: false })
        .limit(15);

      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const agentIds = [...new Set((data || []).map(c => c.agent_id))];
      const { data: agentsData } = await supabase
        .from("bolna_agents")
        .select("id, agent_name")
        .in("id", agentIds);
      
      const agentMap = new Map(agentsData?.map(a => [a.id, a.agent_name]) || []);
      
      return (data || []).map(call => ({
        ...call,
        agent: agentMap.has(call.agent_id) ? { agent_name: agentMap.get(call.agent_id)! } : null
      })) as RecentCall[];
    },
    enabled: !!user,
  });

  // Update active calls from recent calls
  useEffect(() => {
    const active = recentCalls
      .filter(call => ACTIVE_STATUSES.includes(call.status))
      .map(call => ({
        id: call.id,
        status: call.status,
        created_at: call.created_at,
        lead_name: call.lead?.name || undefined,
        phone_number: call.lead?.phone_number,
        agent_name: call.agent?.agent_name,
        external_call_id: call.external_call_id || undefined,
        duration_seconds: call.duration_seconds,
      }));
    setActiveCalls(active);
  }, [recentCalls]);

  // Real-time subscription for call updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('call-status-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        async (payload) => {
          console.log('Call update received:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const updatedCall = payload.new as {
              id: string;
              status: string;
              created_at: string;
              lead_id: string;
              agent_id: string;
              external_call_id?: string;
              duration_seconds?: number;
              client_id: string;
            };

            // Filter by client_id for clients
            if (role === "client" && updatedCall.client_id !== user.id) {
              return;
            }

            // Fetch lead and agent info for the updated call
            const [leadResult, agentResult] = await Promise.all([
              supabase.from("leads").select("name, phone_number").eq("id", updatedCall.lead_id).single(),
              supabase.from("bolna_agents").select("agent_name").eq("id", updatedCall.agent_id).single()
            ]);

            const newActiveCall: ActiveCall = {
              id: updatedCall.id,
              status: updatedCall.status,
              created_at: updatedCall.created_at,
              lead_name: leadResult.data?.name || undefined,
              phone_number: leadResult.data?.phone_number,
              agent_name: agentResult.data?.agent_name,
              external_call_id: updatedCall.external_call_id,
              duration_seconds: updatedCall.duration_seconds,
            };

            // Update active calls state
            setActiveCalls(prev => {
              const existing = prev.findIndex(c => c.id === updatedCall.id);
              
              if (ACTIVE_STATUSES.includes(updatedCall.status)) {
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = newActiveCall;
                  return updated;
                }
                return [newActiveCall, ...prev];
              } else {
                // Remove from active if status is terminal
                if (existing >= 0) {
                  return prev.filter(c => c.id !== updatedCall.id);
                }
                return prev;
              }
            });

            // Show toast for status changes
            const statusInfo = statusConfig[updatedCall.status];
            if (statusInfo && payload.eventType === 'UPDATE') {
              const oldStatus = (payload.old as { status?: string })?.status;
              if (oldStatus !== updatedCall.status) {
                toast({
                  title: `Call ${statusInfo.label}`,
                  description: `${leadResult.data?.name || leadResult.data?.phone_number || 'Call'} is now ${statusInfo.label.toLowerCase()}`,
                });
              }
            }

            // Refetch recent calls to update the list
            refetchCalls();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, toast, refetchCalls]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedLead = leads.find((l) => l.id === selectedLeadId);

  const handleMakeCall = async () => {
    if (!selectedAgentId || !user) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select an agent",
      });
      return;
    }

    let leadId = selectedLeadId;
    // For engineers and admins, use the agent's client_id; for clients, use their own id
    const agentClientId = selectedAgent?.client_id;
    let clientId = role === "client" ? user.id : agentClientId;

    // Engineers MUST use an agent that has a client_id assigned
    if (role === "engineer" && !agentClientId) {
      toast({
        variant: "destructive",
        title: "Cannot Create Lead",
        description: "This agent is not assigned to a client. Select an agent with a client assigned.",
      });
      return;
    }

    if (callMode === "manual") {
      if (!manualPhone) {
        toast({
          variant: "destructive",
          title: "Missing Phone Number",
          description: "Please enter a phone number",
        });
        return;
      }

      if (!clientId) {
        toast({
          variant: "destructive",
          title: "Missing Client",
          description: "Cannot determine client for this lead. Please select an agent assigned to a client.",
        });
        return;
      }

      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          phone_number: manualPhone,
          name: manualName || null,
          client_id: clientId,
          uploaded_by: user.id,
          status: "new",
        })
        .select("id")
        .single();

      if (leadError) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create lead: " + leadError.message,
        });
        return;
      }

      leadId = newLead.id;
    } else {
      if (!selectedLeadId) {
        toast({
          variant: "destructive",
          title: "Missing Lead",
          description: "Please select a lead to call",
        });
        return;
      }
    }

    setIsCalling(true);

    try {
      const { data, error } = await makeCall({
        lead_id: leadId,
        agent_id: selectedAgentId,
        client_id: clientId,
      });

      if (error || !data) {
        throw new Error(error || "Failed to initiate call");
      }

      toast({
        title: "Call Initiated!",
        description: `Call queued successfully`,
      });

      setSelectedLeadId("");
      setManualPhone("");
      setManualName("");

      // Immediate refetch
      setTimeout(() => refetchCalls(), 500);
    } catch (err) {
      console.error("Call error:", err);
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: err instanceof Error ? err.message : "Failed to initiate call",
      });
    } finally {
      setIsCalling(false);
    }
  };

  const handleCallEnded = useCallback((callId: string) => {
    setActiveCalls(prev => prev.filter(c => c.id !== callId));
    refetchCalls();
  }, [refetchCalls]);

  const formatPhoneDisplay = (phone: string) => {
    return phone;
  };

  // Filter completed calls for the history section
  const completedCalls = recentCalls.filter(c => !ACTIVE_STATUSES.includes(c.status));

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Phone className="h-6 w-6" />
              Make Call
            </h1>
            <p className="text-muted-foreground">
              Initiate phone calls to leads using AI agents
            </p>
          </div>
          {activeCalls.length > 0 && (
            <Badge variant="default" className="gap-2 animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              {activeCalls.length} Active Call{activeCalls.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Active Calls Progress Tracker */}
        {activeCalls.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <CallProgressTracker 
                activeCalls={activeCalls} 
                onCallEnded={handleCallEnded}
              />
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Call Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Call Configuration</CardTitle>
              <CardDescription>
                Select an agent and recipient to make a call
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agent Selection */}
              <div className="space-y-2">
                <Label>Select Agent *</Label>
                {loadingAgents ? (
                  <div className="h-10 bg-muted animate-pulse rounded" />
                ) : agents.length > 0 ? (
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="border-2">
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
                ) : (
                  <p className="text-sm text-muted-foreground p-3 bg-muted/50 border-2 border-border">
                    No agents available. Please contact admin to assign agents.
                  </p>
                )}
              </div>

              {/* Call Mode Tabs */}
              <Tabs value={callMode} onValueChange={(v) => setCallMode(v as "lead" | "manual")}>
                <TabsList className="w-full">
                  <TabsTrigger value="lead" className="flex-1">Select Lead</TabsTrigger>
                  <TabsTrigger value="manual" className="flex-1">Enter Number</TabsTrigger>
                </TabsList>

                <TabsContent value="lead" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Lead *</Label>
                    {loadingLeads ? (
                      <div className="h-10 bg-muted animate-pulse rounded" />
                    ) : leads.length > 0 ? (
                      <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                        <SelectTrigger className="border-2">
                          <SelectValue placeholder="Choose a lead" />
                        </SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              <span className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {lead.name || "Unknown"} - {formatPhoneDisplay(lead.phone_number)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground p-3 bg-muted/50 border-2 border-border">
                        No leads available. Add leads first.
                      </p>
                    )}
                  </div>

                  {selectedLead && (
                    <div className="p-3 bg-muted/50 border-2 border-border">
                      <p className="font-medium">{selectedLead.name || "Unknown"}</p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {formatPhoneDisplay(selectedLead.phone_number)}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      placeholder="+1234567890"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      className="border-2 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name (Optional)</Label>
                    <Input
                      placeholder="Contact name"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="border-2"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Make Call Button */}
              <Button
                onClick={handleMakeCall}
                disabled={isCalling || !selectedAgentId || (callMode === "lead" && !selectedLeadId) || (callMode === "manual" && !manualPhone)}
                className="w-full"
                size="lg"
              >
                {isCalling ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Initiating Call...
                  </>
                ) : (
                  <>
                    <Phone className="h-5 w-5 mr-2" />
                    Make Call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Call History */}
          <Card>
            <CardHeader>
              <CardTitle>Call History</CardTitle>
              <CardDescription>
                Recent completed calls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No completed calls yet
                </p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {completedCalls.map((call) => {
                    const status = statusConfig[call.status] || statusConfig.completed;
                    return (
                      <div
                        key={call.id}
                        className="flex items-center justify-between p-3 border-2 border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-muted flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {call.lead?.name || call.lead?.phone_number || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {call.agent?.agent_name || "Unknown Agent"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={status.className}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(call.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
