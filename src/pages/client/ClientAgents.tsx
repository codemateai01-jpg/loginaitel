import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bot, Phone, RefreshCw, User, Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface Agent {
  id: string;
  agent_name: string;
  bolna_agent_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  current_system_prompt: string | null;
  engineer_id: string | null;
  engineer?: {
    full_name: string | null;
    email: string;
  };
}

export default function ClientAgents() {
  const { user } = useAuth();

  const { data: agents, isLoading, refetch } = useQuery({
    queryKey: ["client-agents", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("*")
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch engineer profiles for assigned agents
      const engineerIds = data
        .filter((a) => a.engineer_id)
        .map((a) => a.engineer_id);

      let engineerMap: Record<string, { full_name: string | null; email: string }> = {};
      
      if (engineerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", engineerIds);

        if (profiles) {
          engineerMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string }>);
        }
      }

      return data.map((agent) => ({
        ...agent,
        engineer: agent.engineer_id ? engineerMap[agent.engineer_id] : undefined,
      })) as Agent[];
    },
  });

  // Get call stats per agent
  const { data: callStats } = useQuery({
    queryKey: ["client-agent-call-stats", user?.id],
    enabled: !!user?.id && !!agents?.length,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("agent_id, status, connected")
        .eq("client_id", user!.id);

      if (error) throw error;

      const stats: Record<string, { total: number; connected: number; completed: number }> = {};
      
      data.forEach((call) => {
        if (!stats[call.agent_id]) {
          stats[call.agent_id] = { total: 0, connected: 0, completed: 0 };
        }
        stats[call.agent_id].total++;
        if (call.connected) stats[call.agent_id].connected++;
        if (call.status === "completed") stats[call.agent_id].completed++;
      });

      return stats;
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return (
        <Badge className="bg-green-500/20 text-green-600 border-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <XCircle className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Agents</h1>
            <p className="text-muted-foreground">
              View and manage your AI voice agents
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agents?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents?.filter((a) => a.status === "active").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Engineer</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {agents?.filter((a) => a.engineer_id).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agents Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Voice Agents</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : agents && agents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Engineer</TableHead>
                    <TableHead>Total Calls</TableHead>
                    <TableHead>Connected</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const stats = callStats?.[agent.id];
                    return (
                      <TableRow key={agent.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                              <Bot className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{agent.agent_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {agent.bolna_agent_id.slice(0, 8)}...
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(agent.status)}</TableCell>
                        <TableCell>
                          {agent.engineer ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{agent.engineer.full_name || agent.engineer.email}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{stats?.total || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">
                            {stats?.connected || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(agent.created_at), "PP")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/client/make-call?agent=${agent.id}`}>
                                <Phone className="h-4 w-4 mr-1" />
                                Call
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="font-medium text-lg mb-2">No agents assigned</h3>
                <p className="text-sm">
                  Contact your administrator to assign voice agents to your account.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
