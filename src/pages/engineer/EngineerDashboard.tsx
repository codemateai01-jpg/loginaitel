import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatCard } from "@/components/ui/stat-card";
import {
  ClipboardList,
  Trophy,
  Clock,
  CheckCircle,
  Play,
  Timer,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

const stats = [
  {
    title: "My Points",
    value: 847,
    icon: <Trophy className="h-5 w-5" />,
    description: "Rank #3 this week",
  },
  {
    title: "Tasks Completed",
    value: 12,
    icon: <CheckCircle className="h-5 w-5" />,
    description: "This month",
  },
  {
    title: "Active Tasks",
    value: 2,
    icon: <ClipboardList className="h-5 w-5" />,
    description: "1 pending review",
  },
  {
    title: "Time Today",
    value: "5h 23m",
    icon: <Clock className="h-5 w-5" />,
    description: "Checked in at 9:30 AM",
  },
];

const activeTasks = [
  {
    id: 1,
    title: "Customer Support Agent",
    client: "TechCorp India",
    deadline: "2h remaining",
    progress: 75,
    status: "in_progress",
  },
  {
    id: 2,
    title: "Lead Qualification Bot",
    client: "Sales Pro Ltd",
    deadline: "Due tomorrow",
    progress: 30,
    status: "in_progress",
  },
];

const leaderboard = [
  { rank: 1, name: "Priya Singh", points: 1240 },
  { rank: 2, name: "Amit Patel", points: 1180 },
  { rank: 3, name: "You", points: 847, isCurrentUser: true },
  { rank: 4, name: "Sneha Reddy", points: 720 },
  { rank: 5, name: "Vikram Joshi", points: 650 },
];

export default function EngineerDashboard() {
  const { user } = useAuth();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Engineer";

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {displayName}!</h1>
            <p className="text-muted-foreground">
              You're doing great this week. Keep it up!
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="shadow-xs">
              <Timer className="h-4 w-4 mr-2" />
              Start Break
            </Button>
            <Button className="shadow-sm">
              <Play className="h-4 w-4 mr-2" />
              Check In
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Tasks */}
          <div className="lg:col-span-2 border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                <h2 className="font-bold">Active Tasks</h2>
              </div>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            <div className="divide-y-2 divide-border">
              {activeTasks.map((task) => (
                <div key={task.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.client}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {task.deadline}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{task.progress}%</span>
                    </div>
                    <Progress value={task.progress} className="h-2" />
                  </div>
                  <Button size="sm" className="shadow-xs">
                    Continue Working
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="border-2 border-border bg-card">
            <div className="p-4 border-b-2 border-border flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <h2 className="font-bold">Weekly Leaderboard</h2>
            </div>
            <div className="divide-y-2 divide-border">
              {leaderboard.map((user) => (
                <div
                  key={user.rank}
                  className={`p-4 flex items-center justify-between ${
                    user.isCurrentUser ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 flex items-center justify-center font-bold border-2 ${
                        user.rank === 1
                          ? "bg-chart-4/20 border-chart-4"
                          : user.rank === 2
                          ? "bg-muted border-muted-foreground"
                          : user.rank === 3
                          ? "bg-chart-5/20 border-chart-5"
                          : "border-border"
                      }`}
                    >
                      {user.rank}
                    </span>
                    <span className={user.isCurrentUser ? "font-bold" : ""}>
                      {user.name}
                    </span>
                  </div>
                  <span className="font-mono">{user.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Learning Progress */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5" />
            <h2 className="font-bold">Learning Progress</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Prompt Engineering</span>
                <span>85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Voice Configuration</span>
                <span>72%</span>
              </div>
              <Progress value={72} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Telephony Setup</span>
                <span>60%</span>
              </div>
              <Progress value={60} className="h-2" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
