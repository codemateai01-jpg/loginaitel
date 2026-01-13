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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  {
    title: "Credit Balance",
    value: "2,450",
    icon: <CreditCard className="h-5 w-5" />,
    description: "₹12,250 value",
  },
  {
    title: "Active Agents",
    value: 3,
    icon: <Bot className="h-5 w-5" />,
    description: "2 phone numbers",
  },
  {
    title: "Calls This Week",
    value: 847,
    icon: <Phone className="h-5 w-5" />,
    trend: { value: 15, positive: true },
  },
  {
    title: "Conversion Rate",
    value: "23%",
    icon: <TrendingUp className="h-5 w-5" />,
    trend: { value: 5, positive: true },
  },
];

const recentCalls = [
  {
    id: 1,
    phone: "+91 98765XXXXX",
    agent: "Sales Assistant",
    duration: "3:24",
    status: "interested",
    time: "10 min ago",
  },
  {
    id: 2,
    phone: "+91 87654XXXXX",
    agent: "Support Bot",
    duration: "1:45",
    status: "callback",
    time: "25 min ago",
  },
  {
    id: 3,
    phone: "+91 76543XXXXX",
    agent: "Sales Assistant",
    duration: "0:32",
    status: "not_interested",
    time: "1h ago",
  },
  {
    id: 4,
    phone: "+91 65432XXXXX",
    agent: "Lead Qualifier",
    duration: "4:12",
    status: "interested",
    time: "2h ago",
  },
];

const agents = [
  {
    id: 1,
    name: "Sales Assistant",
    calls: 342,
    conversion: "28%",
    status: "active",
  },
  {
    id: 2,
    name: "Support Bot",
    calls: 289,
    conversion: "N/A",
    status: "active",
  },
  {
    id: 3,
    name: "Lead Qualifier",
    calls: 216,
    conversion: "19%",
    status: "active",
  },
];

export default function ClientDashboard() {
  const { user } = useAuth();
  const companyName = user?.user_metadata?.full_name || "Client";

  return (
    <DashboardLayout role="client">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome, {companyName}!</h1>
            <p className="text-muted-foreground">
              Your voice campaigns are performing well.
            </p>
          </div>
          <Button className="shadow-sm">
            <CreditCard className="h-4 w-4 mr-2" />
            Buy Credits
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
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            <div className="divide-y-2 divide-border">
              {recentCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 flex items-center justify-center border-2 ${
                        call.status === "interested"
                          ? "bg-chart-2/10 border-chart-2"
                          : call.status === "callback"
                          ? "bg-chart-4/10 border-chart-4"
                          : "bg-muted border-border"
                      }`}
                    >
                      {call.status === "interested" ? (
                        <CheckCircle className="h-5 w-5 text-chart-2" />
                      ) : call.status === "callback" ? (
                        <Clock className="h-5 w-5 text-chart-4" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-mono text-sm">{call.phone}</p>
                      <p className="text-sm text-muted-foreground">
                        {call.agent} • {call.duration}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-block px-2 py-1 text-xs font-medium border-2 ${
                        call.status === "interested"
                          ? "bg-chart-2/10 border-chart-2 text-chart-2"
                          : call.status === "callback"
                          ? "bg-chart-4/10 border-chart-4 text-chart-4"
                          : "bg-muted border-border"
                      }`}
                    >
                      {call.status === "interested"
                        ? "Interested"
                        : call.status === "callback"
                        ? "Callback"
                        : "Not Interested"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {call.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My Agents */}
          <div className="border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <h2 className="font-bold">My Agents</h2>
            </div>
            <div className="divide-y-2 divide-border">
              {agents.map((agent) => (
                <div key={agent.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{agent.name}</span>
                    <span className="w-2 h-2 bg-chart-2 rounded-full" />
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{agent.calls} calls</span>
                    <span>{agent.conversion} conv.</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t-2 border-border">
              <Button variant="outline" className="w-full shadow-xs">
                View All Agents
              </Button>
            </div>
          </div>
        </div>

        {/* Lead Stats */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Users className="h-5 w-5" />
            <h2 className="font-bold">Lead Performance</h2>
          </div>
          <div className="grid sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-chart-2">847</p>
              <p className="text-sm text-muted-foreground">Total Calls</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-chart-1">195</p>
              <p className="text-sm text-muted-foreground">Interested</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-chart-4">89</p>
              <p className="text-sm text-muted-foreground">Callbacks</p>
            </div>
            <div>
              <p className="text-3xl font-bold">563</p>
              <p className="text-sm text-muted-foreground">Not Interested</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
