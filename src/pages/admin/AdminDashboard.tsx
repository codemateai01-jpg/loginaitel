import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import {
  Users,
  Bot,
  Phone,
  CreditCard,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  {
    title: "Active Clients",
    value: 24,
    icon: <Users className="h-5 w-5" />,
    trend: { value: 12, positive: true },
  },
  {
    title: "Total Agents",
    value: 156,
    icon: <Bot className="h-5 w-5" />,
    trend: { value: 8, positive: true },
  },
  {
    title: "Calls Today",
    value: "1,247",
    icon: <Phone className="h-5 w-5" />,
    trend: { value: 23, positive: true },
  },
  {
    title: "Revenue (MTD)",
    value: "₹4.2L",
    icon: <CreditCard className="h-5 w-5" />,
    trend: { value: 18, positive: true },
  },
];

const recentTasks = [
  {
    id: 1,
    engineer: "Rahul Kumar",
    task: "Healthcare Support Agent",
    status: "pending_review",
    time: "2h ago",
  },
  {
    id: 2,
    engineer: "Priya Singh",
    task: "E-commerce Sales Bot",
    status: "in_progress",
    time: "3h ago",
  },
  {
    id: 3,
    engineer: "Amit Patel",
    task: "Banking FAQ Agent",
    status: "approved",
    time: "5h ago",
  },
];

const pendingApprovals = [
  {
    id: 1,
    agent: "Insurance Claim Bot",
    engineer: "Rahul Kumar",
    submitted: "30 min ago",
  },
  {
    id: 2,
    agent: "Travel Booking Assistant",
    engineer: "Priya Singh",
    submitted: "1h ago",
  },
];

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.email?.split("@")[0] || "Admin"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Pending Approvals */}
          <div className="border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-chart-4" />
                <h2 className="font-bold">Pending Approvals</h2>
              </div>
              <span className="text-sm text-muted-foreground">
                {pendingApprovals.length} pending
              </span>
            </div>
            <div className="divide-y-2 divide-border">
              {pendingApprovals.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{item.agent}</p>
                    <p className="text-sm text-muted-foreground">
                      by {item.engineer} • {item.submitted}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      Review
                    </Button>
                    <Button size="sm">Approve</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <h2 className="font-bold">Recent Tasks</h2>
              </div>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            <div className="divide-y-2 divide-border">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{task.task}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.engineer} • {task.time}
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1 text-xs font-medium border-2 ${
                      task.status === "approved"
                        ? "bg-chart-2/10 border-chart-2 text-chart-2"
                        : task.status === "pending_review"
                        ? "bg-chart-4/10 border-chart-4 text-chart-4"
                        : "bg-muted border-border"
                    }`}
                  >
                    {task.status === "approved"
                      ? "Approved"
                      : task.status === "pending_review"
                      ? "Pending Review"
                      : "In Progress"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-2 border-border bg-card p-6">
          <h2 className="font-bold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="shadow-xs">
              <Users className="h-4 w-4 mr-2" />
              Add Client
            </Button>
            <Button variant="outline" className="shadow-xs">
              <Users className="h-4 w-4 mr-2" />
              Add Engineer
            </Button>
            <Button variant="outline" className="shadow-xs">
              <CreditCard className="h-4 w-4 mr-2" />
              Issue Credits
            </Button>
            <Button variant="outline" className="shadow-xs">
              <TrendingUp className="h-4 w-4 mr-2" />
              View Reports
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
