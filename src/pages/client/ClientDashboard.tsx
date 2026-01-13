import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import {
  CreditCard,
  Bot,
  Phone,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function ClientDashboard() {
  const { user } = useAuth();
  const companyName = user?.user_metadata?.full_name || "Client";

  // Fetch credit balance
  const { data: credits } = useQuery({
    queryKey: ["client-credits", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_credits")
        .select("balance")
        .eq("client_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.balance || 0;
    },
  });

  // Fetch agents count
  const { data: agents } = useQuery({
    queryKey: ["client-agents-list", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("id, agent_name, status")
        .eq("client_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent calls
  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ["client-recent-calls", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select(`
          id,
          status,
          duration_seconds,
          connected,
          created_at,
          sentiment,
          lead:leads(name, phone_number),
          agent_id
        `)
        .eq("client_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch call stats for this week
  const { data: weekStats } = useQuery({
    queryKey: ["client-week-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from("calls")
        .select("id, connected, status, sentiment")
        .eq("client_id", user!.id)
        .gte("created_at", weekAgo.toISOString());
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const connected = data?.filter((c) => c.connected).length || 0;
      const positive = data?.filter((c) => c.sentiment === "positive").length || 0;
      
      return {
        total,
        connected,
        conversionRate: total > 0 ? Math.round((positive / total) * 100) : 0,
      };
    },
  });

  // Map agent names
  const getAgentName = (agentId: string) => {
    const agent = agents?.find((a) => a.id === agentId);
    return agent?.agent_name || "Unknown Agent";
  };

  const stats = [
    {
      title: "Credit Balance",
      value: credits?.toLocaleString() || "0",
      icon: <CreditCard className="h-5 w-5" />,
      description: `₹${((credits || 0) * 5).toLocaleString()} value`,
    },
    {
      title: "Active Agents",
      value: agents?.length || 0,
      icon: <Bot className="h-5 w-5" />,
      description: "Assigned to you",
    },
    {
      title: "Calls This Week",
      value: weekStats?.total || 0,
      icon: <Phone className="h-5 w-5" />,
      trend: weekStats?.total ? { value: weekStats.connected, positive: true } : undefined,
    },
    {
      title: "Conversion Rate",
      value: `${weekStats?.conversionRate || 0}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      description: "Positive sentiment",
    },
  ];

  const getStatusIcon = (status: string, sentiment: string | null) => {
    if (sentiment === "positive") return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === "completed" && sentiment !== "negative") return <Clock className="h-5 w-5 text-yellow-500" />;
    return <XCircle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStatusLabel = (status: string, sentiment: string | null) => {
    if (sentiment === "positive") return "Interested";
    if (sentiment === "negative") return "Not Interested";
    if (status === "completed") return "Callback";
    return status;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const callDate = new Date(date);
    const diffMs = now.getTime() - callDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return format(callDate, "PP");
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome, {companyName}!</h1>
            <p className="text-muted-foreground">
              {weekStats?.total ? "Your voice campaigns are performing well." : "Start making calls to see your performance."}
            </p>
          </div>
          <Button className="shadow-sm" asChild>
            <Link to="/client/billing">
              <CreditCard className="h-4 w-4 mr-2" />
              Buy Credits
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Calls */}
          <div className="lg:col-span-2 border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <h2 className="font-bold">Recent Calls</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/client/calls">View All</Link>
              </Button>
            </div>
            {callsLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : calls && calls.length > 0 ? (
              <div className="divide-y-2 divide-border">
                {calls.slice(0, 5).map((call) => (
                  <div
                    key={call.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 flex items-center justify-center border-2 bg-muted/50 border-border">
                        {getStatusIcon(call.status, call.sentiment)}
                      </div>
                      <div>
                        <p className="font-mono text-sm">
                          {call.lead?.phone_number 
                            ? call.lead.phone_number.replace(/(\d{3})(\d{3})(\d+)/, "+$1 $2 XXXXX")
                            : "Unknown"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getAgentName(call.agent_id)} • {formatDuration(call.duration_seconds)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-block px-2 py-1 text-xs font-medium border-2 ${
                        call.sentiment === "positive"
                          ? "bg-green-500/10 border-green-500 text-green-600"
                          : call.status === "completed" && call.sentiment !== "negative"
                          ? "bg-yellow-500/10 border-yellow-500 text-yellow-600"
                          : "bg-muted border-border"
                      }`}>
                        {getStatusLabel(call.status, call.sentiment)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(call.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Phone className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No calls yet</p>
                <Button variant="link" size="sm" asChild>
                  <Link to="/client/make-call">Make your first call</Link>
                </Button>
              </div>
            )}
          </div>

          {/* My Agents */}
          <div className="border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <h2 className="font-bold">My Agents</h2>
            </div>
            {agents && agents.length > 0 ? (
              <div className="divide-y-2 divide-border">
                {agents.slice(0, 4).map((agent) => (
                  <div key={agent.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{agent.agent_name}</span>
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Status: {agent.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Bot className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No agents assigned</p>
              </div>
            )}
            <div className="p-4 border-t-2 border-border">
              <Button variant="outline" className="w-full shadow-xs" asChild>
                <Link to="/client/agents">View All Agents</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Lead Stats */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5" />
            <h2 className="font-bold">Lead Performance (This Week)</h2>
          </div>
          <div className="grid sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{weekStats?.total || 0}</p>
              <p className="text-sm text-muted-foreground">Total Calls</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-500">{weekStats?.connected || 0}</p>
              <p className="text-sm text-muted-foreground">Connected</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-yellow-500">
                {calls?.filter((c) => c.sentiment === "positive").length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Interested</p>
            </div>
            <div>
              <p className="text-3xl font-bold">
                {calls?.filter((c) => c.sentiment === "negative").length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Not Interested</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
