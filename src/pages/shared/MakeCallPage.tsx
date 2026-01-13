import { useState, useEffect } from "react";
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
import { makeCall, getCallStatus } from "@/lib/bolna";
import { useQuery } from "@tanstack/react-query";

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
  lead: {
    name: string | null;
    phone_number: string;
  } | null;
  agent: {
    agent_name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  queued: { label: "Queued", icon: <Clock className="h-4 w-4" />, className: "bg-muted text-muted-foreground" },
  initiated: { label: "Initiated", icon: <Phone className="h-4 w-4" />, className: "bg-blue-500/20 text-blue-600" },
  ringing: { label: "Ringing", icon: <Phone className="h-4 w-4 animate-pulse" />, className: "bg-yellow-500/20 text-yellow-600" },
  "in-progress": { label: "In Progress", icon: <Phone className="h-4 w-4" />, className: "bg-green-500/20 text-green-600" },
  completed: { label: "Completed", icon: <CheckCircle className="h-4 w-4" />, className: "bg-green-500/20 text-green-600" },
  failed: { label: "Failed", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/20 text-destructive" },
  "no-answer": { label: "No Answer", icon: <AlertCircle className="h-4 w-4" />, className: "bg-yellow-500/20 text-yellow-600" },
  busy: { label: "Busy", icon: <AlertCircle className="h-4 w-4" />, className: "bg-yellow-500/20 text-yellow-600" },
};

export default function MakeCallPage({ role }: MakeCallPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callMode, setCallMode] = useState<"lead" | "manual">("lead");

  // Fetch agents
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-for-call", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("bolna_agents")
        .select("id, agent_name, bolna_agent_id, client_id")
        .eq("status", "active");

      // Clients only see their assigned agents
      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query.order("agent_name");
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user,
  });

  // Fetch leads (for clients, filter by their ID)
  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["leads-for-call", user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, name, phone_number, client_id");

      // Clients only see their leads
      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query.order("name").limit(100);
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!user,
  });

  // Fetch recent calls
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
          lead:leads(name, phone_number)
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (role === "client" && user) {
        query = query.eq("client_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch agent names separately
      const agentIds = [...new Set((data || []).map(c => c.agent_id))];
      const { data: agents } = await supabase
        .from("bolna_agents")
        .select("id, agent_name")
        .in("id", agentIds);
      
      const agentMap = new Map(agents?.map(a => [a.id, a.agent_name]) || []);
      
      return (data || []).map(call => ({
        ...call,
        agent: agentMap.has(call.agent_id) ? { agent_name: agentMap.get(call.agent_id)! } : null
      })) as RecentCall[];
    },
    enabled: !!user,
  });

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
    let clientId = role === "client" ? user.id : selectedAgent?.client_id || user.id;

    // If manual mode, create a temporary lead first
    if (callMode === "manual") {
      if (!manualPhone) {
        toast({
          variant: "destructive",
          title: "Missing Phone Number",
          description: "Please enter a phone number",
        });
        return;
      }

      // Create lead in database
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
        description: `Call queued successfully. Execution ID: ${data.execution_id}`,
      });

      // Reset form
      setSelectedLeadId("");
      setManualPhone("");
      setManualName("");

      // Refresh recent calls
      setTimeout(() => refetchCalls(), 2000);
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

  const formatPhoneDisplay = (phone: string) => {
    if (role === "admin" || role === "engineer") {
      return phone;
    }
    // Mask phone for clients in certain views
    return phone;
  };

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Make Call
          </h1>
          <p className="text-muted-foreground">
            Initiate phone calls to leads using AI agents
          </p>
        </div>

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

                  {/* Selected Lead Info */}
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

          {/* Recent Calls */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Calls</CardTitle>
              <CardDescription>
                Your most recent call attempts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent calls
                </p>
              ) : (
                <div className="space-y-3">
                  {recentCalls.map((call) => {
                    const status = statusConfig[call.status] || statusConfig.queued;
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
