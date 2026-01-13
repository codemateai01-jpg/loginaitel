import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

const leaderboardData = {
  daily: [
    { rank: 1, name: "Priya Singh", points: 180, tasks: 3, badge: "🔥" },
    { rank: 2, name: "Amit Patel", points: 165, tasks: 2, badge: "" },
    { rank: 3, name: "Rahul Kumar", points: 142, tasks: 2, badge: "" },
    { rank: 4, name: "Sneha Reddy", points: 120, tasks: 1, badge: "" },
    { rank: 5, name: "Vikram Joshi", points: 95, tasks: 1, badge: "" },
  ],
  weekly: [
    { rank: 1, name: "Amit Patel", points: 1240, tasks: 12, badge: "👑" },
    { rank: 2, name: "Priya Singh", points: 1180, tasks: 11, badge: "" },
    { rank: 3, name: "Rahul Kumar", points: 847, tasks: 8, badge: "" },
    { rank: 4, name: "Sneha Reddy", points: 720, tasks: 7, badge: "" },
    { rank: 5, name: "Vikram Joshi", points: 650, tasks: 6, badge: "" },
  ],
  monthly: [
    { rank: 1, name: "Priya Singh", points: 4850, tasks: 48, badge: "⭐" },
    { rank: 2, name: "Amit Patel", points: 4620, tasks: 45, badge: "" },
    { rank: 3, name: "Rahul Kumar", points: 3890, tasks: 38, badge: "" },
    { rank: 4, name: "Vikram Joshi", points: 3420, tasks: 33, badge: "" },
    { rank: 5, name: "Sneha Reddy", points: 3180, tasks: 31, badge: "" },
  ],
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-chart-4/20 border-2 border-chart-4">
        <Trophy className="h-5 w-5 text-chart-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-muted border-2 border-muted-foreground">
        <Medal className="h-5 w-5" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-chart-5/20 border-2 border-chart-5">
        <Award className="h-5 w-5 text-chart-5" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 flex items-center justify-center border-2 border-border font-bold">
      {rank}
    </div>
  );
}

function LeaderboardSection({
  title,
  data,
  currentUser = "Rahul Kumar",
}: {
  title: string;
  data: typeof leaderboardData.daily;
  currentUser?: string;
}) {
  return (
    <div className="border-2 border-border bg-card">
      <div className="p-4 border-b-2 border-border">
        <h2 className="font-bold">{title}</h2>
      </div>
      <div className="divide-y-2 divide-border">
        {data.map((user) => {
          const isCurrentUser = user.name === currentUser;
          return (
            <div
              key={user.rank}
              className={`p-4 flex items-center justify-between ${
                isCurrentUser ? "bg-accent" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <RankBadge rank={user.rank} />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        isCurrentUser ? "font-bold" : ""
                      }`}
                    >
                      {user.name}
                    </span>
                    {user.badge && <span>{user.badge}</span>}
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground">
                        (You)
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {user.tasks} tasks completed
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold">{user.points}</p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EngineerLeaderboard() {
  return (
    <DashboardLayout role="engineer">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
          <p className="text-muted-foreground">
            See how you rank against other prompt engineers
          </p>
        </div>

        {/* Your Stats */}
        <div className="border-2 border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <h2 className="font-bold">Your Performance</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold">#3</p>
              <p className="text-sm text-muted-foreground">Weekly Rank</p>
            </div>
            <div>
              <p className="text-3xl font-bold">847</p>
              <p className="text-sm text-muted-foreground">Weekly Points</p>
            </div>
            <div>
              <p className="text-3xl font-bold">8</p>
              <p className="text-sm text-muted-foreground">Tasks This Week</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-chart-2">+12%</p>
              <p className="text-sm text-muted-foreground">vs Last Week</p>
            </div>
          </div>
        </div>

        {/* Leaderboards */}
        <div className="grid lg:grid-cols-3 gap-6">
          <LeaderboardSection title="Daily Leaders" data={leaderboardData.daily} />
          <LeaderboardSection title="Weekly Leaders" data={leaderboardData.weekly} />
          <LeaderboardSection title="Monthly Leaders" data={leaderboardData.monthly} />
        </div>
      </div>
    </DashboardLayout>
  );
}
