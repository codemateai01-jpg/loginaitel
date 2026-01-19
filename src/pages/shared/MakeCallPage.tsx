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
import { Badge } from "@/components/ui/badge";
import { Phone, Loader2, User, Clock, CheckCircle, XCircle, AlertCircle, ShieldAlert, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { makeCall } from "@/lib/aitel";
import { useQuery } from "@tanstack/react-query";
import { CreditGate } from "@/components/client/CreditGate";

interface MakeCallPageProps {
  role: "admin" | "engineer" | "client";
}

interface Agent {
  id: string;
  agent_name: string;
  external_agent_id: string;
  client_id: string | null;
  engineer_id?: string | null;
}

interface RecentCall {
  id: string;
  status: string;
  created_at: string;
  agent_id: string;
  duration_seconds?: number;
  external_call_id?: string | null;
  agent: {
    agent_name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  initiated: { label: "Initiated", icon: <Phone className="h-4 w-4" />, className: "bg-primary/20 text-primary" },
  queued: { label: "Queued", icon: <Clock className="h-4 w-4" />, className: "bg-muted text-muted-foreground" },
  ringing: { label: "Ringing", icon: <Phone className="h-4 w-4" />, className: "bg-chart-4/20 text-chart-4" },
  "in-progress": { label: "In Progress", icon: <Phone className="h-4 w-4" />, className: "bg-chart-2/20 text-chart-2" },
  completed: { label: "Completed", icon: <CheckCircle className="h-4 w-4" />, className: "bg-chart-2/20 text-chart-2" },
  failed: { label: "Failed", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/20 text-destructive" },
  "no-answer": { label: "No Answer", icon: <AlertCircle className="h-4 w-4" />, className: "bg-chart-4/20 text-chart-4" },
  busy: { label: "Busy", icon: <AlertCircle className="h-4 w-4" />, className: "bg-chart-4/20 text-chart-4" },
  canceled: { label: "Canceled", icon: <XCircle className="h-4 w-4" />, className: "bg-muted text-muted-foreground" },
  "call-disconnected": { label: "Disconnected", icon: <XCircle className="h-4 w-4" />, className: "bg-destructive/20 text-destructive" },
};

// Statuses that allow call testing (prompt approved or later)
const CALL_ALLOWED_STATUSES = [
  'prompt_approved',
  'demo_in_progress',
  'demo_submitted',
  'completed'
];

export default function MakeCallPage({ role }: MakeCallPageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualName, setManualName] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [hasApprovedPrompts, setHasApprovedPrompts] = useState<boolean | null>(null);

  // Fetch agents
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["agents-for-call", user?.id, role],
    queryFn: async () => {
      let query = supabase.from("aitel_agents").select("*");

      if (role === "client" && user) {
        query = query.eq("client_id", user.id).eq("status", "active");
      } else if (role === "engineer" && user) {
        query = query
          .eq("engineer_id", user.id)
          .eq("status", "active")
          .not("client_id", "is", null);
      } else if (role === "admin") {
        // Admins see everything, no extra filters
      }

      const { data, error } = await query.order("agent_name");
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user,
  });

  // Check if engineer has approved prompts for call testing
  const { data: approvedPromptsCheck, isLoading: checkingApproval } = useQuery({
    queryKey: ["engineer-approved-prompts", user?.id],
    queryFn: async () => {
      if (!user || role !== "engineer") return { hasApproved: true };

      const { data, error } = await supabase
        .from("tasks")
        .select("id")
        .eq("assigned_to", user.id)
        .in("status", CALL_ALLOWED_STATUSES)
        .limit(1);

      if (error) throw error;
      return { hasApproved: data && data.length > 0 };
    },
    enabled: !!user && role === "engineer",
  });

  // Update state when check completes
  useEffect(() => {
    if (role !== "engineer") {
      setHasApprovedPrompts(true);
    } else if (approvedPromptsCheck !== undefined) {
      setHasApprovedPrompts(approvedPromptsCheck.hasApproved);
    }
  }, [role, approvedPromptsCheck]);

  // Fetch recent calls with agent info
  const { data: recentCalls = [], refetch: refetchCalls, isLoading: loadingCalls } = useQuery({
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
          external_call_id
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
        .from("aitel_agents")
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

  // Real-time subscription for call updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('recent-calls-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        () => {
          // Refetch when any call changes
          refetchCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchCalls]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  const handleMakeCall = async () => {
    if (!selectedAgentId || !user) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select an agent",
      });
      return;
    }

    if (!manualPhone) {
      toast({
        variant: "destructive",
        title: "Missing Phone Number",
        description: "Please enter a phone number",
      });
      return;
    }

    // For engineers and admins, use the agent's client_id; for clients, use their own id
    const agentClientId = selectedAgent?.client_id;
    let clientId = role === "client" ? user.id : agentClientId;

    // For admins, if agent has no client, use admin's own ID as client context
    if (role === "admin" && !clientId) {
      clientId = user.id;
    }

    // Engineers MUST use an agent that has a client_id assigned
    if (role === "engineer" && !agentClientId) {
      toast({
        variant: "destructive",
        title: "Cannot Make Call",
        description: "This agent is not assigned to a client. Select an agent with a client assigned.",
      });
      return;
    }

    if (!clientId) {
      toast({
        variant: "destructive",
        title: "Missing Client",
        description: "Cannot determine client for this call. Please select an agent assigned to a client.",
      });
      return;
    }

    setIsCalling(true);

    try {
      // Make call via API with phone number
      const { data, error } = await makeCall({
        phone_number: manualPhone,
        agent_id: selectedAgentId,
        client_id: clientId,
        name: manualName || undefined,
      });

      if (error || !data) {
        throw new Error(error || "Failed to initiate call");
      }

      toast({
        title: "Call Initiated!",
        description: `Call queued successfully`,
      });

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

  // For clients, wrap content with CreditGate
  const content = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6" />
            Make Call
          </h1>
          <p className="text-muted-foreground">
            Initiate phone calls using AI agents. Check call status in Call History.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetchCalls()} disabled={loadingCalls}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingCalls ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Call Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Call Configuration</CardTitle>
            <CardDescription>
              Select an agent and enter phone number to make a call
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Engineer Approval Restriction Message */}
            {role === "engineer" && hasApprovedPrompts === false && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border-2 border-destructive text-destructive">
                <ShieldAlert className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Call Testing Not Available</p>
                  <p className="text-sm mt-1">
                    You need to have at least one task with an approved prompt before you can test calls.
                    Complete your prompt editing and submit for admin approval first.
                  </p>
                </div>
              </div>
            )}

            {role === "engineer" && checkingApproval && (
              <div className="flex items-center gap-2 p-4 bg-muted border-2 border-border">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Checking approval status...</span>
              </div>
            )}

            {/* Agent Selection - Only show if engineer has approval or is admin/client */}
            {(hasApprovedPrompts || role !== "engineer") && (
              <>
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
                      {role === "engineer"
                        ? "No eligible agents assigned to you. Ask an admin to assign you an agent and a client."
                        : "No agents available. Please contact admin to assign agents."}
                    </p>
                  )}
                </div>

                {/* Phone Number Input */}
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

                {/* Make Call Button */}
                <Button
                  onClick={handleMakeCall}
                  disabled={isCalling || !selectedAgentId || !manualPhone}
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
              </>
            )}
          </CardContent>
        </Card>

        {/* Call History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>
              Your recent calls - check Call History for full details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCalls ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentCalls.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No calls yet
              </p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {recentCalls.map((call) => {
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
                            Call #{call.id.slice(0, 8)}
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
  );

  return (
    <DashboardLayout role={role}>
      {role === "client" ? (
        <CreditGate requiredCredits={1} featureName="Make Call">
          {content}
        </CreditGate>
      ) : (
        content
      )}
    </DashboardLayout>
  );
}