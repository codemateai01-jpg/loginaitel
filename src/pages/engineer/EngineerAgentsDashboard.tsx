import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  ClipboardList,
  Clock,
  Play,
  CheckCircle,
  Trophy,
  Loader2,
  AlertCircle,
  Timer,
  Eye,
  Settings,
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Agent {
  id: string;
  agent_name: string;
  bolna_agent_id: string;
  status: string;
  current_system_prompt: string | null;
  client_id: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  points: number;
  status: string;
  deadline: string | null;
  bolna_agent_id: string | null;
  created_at: string;
  picked_at: string | null;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
    case "assigned":
      return "bg-muted text-muted-foreground";
    case "in_progress":
      return "bg-chart-4/20 text-chart-4 border-chart-4";
    case "submitted":
      return "bg-chart-3/20 text-chart-3 border-chart-3";
    case "approved":
    case "completed":
      return "bg-chart-2/20 text-chart-2 border-chart-2";
    case "rejected":
      return "bg-destructive/20 text-destructive border-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
    case "assigned":
      return "New Assignment";
    case "in_progress":
      return "In Progress";
    case "submitted":
      return "Pending Review";
    case "approved":
      return "Approved";
    case "completed":
      return "Completed";
    case "rejected":
      return "Needs Revision";
    default:
      return status;
  }
};

export default function EngineerAgentsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Fetch agents assigned to this engineer
  const { data: myAgents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["my-assigned-agents", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("bolna_agents")
        .select("id, agent_name, bolna_agent_id, status, current_system_prompt, client_id")
        .eq("engineer_id", user.id)
        .order("agent_name");
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user?.id,
  });

  // Fetch tasks assigned to this engineer
  const { data: myTasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["my-tasks-with-agents", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id,
  });

  // Group tasks by agent
  const tasksByAgent = myTasks.reduce((acc, task) => {
    const agentId = task.bolna_agent_id || "unassigned";
    if (!acc[agentId]) acc[agentId] = [];
    acc[agentId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const getTimeRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diff = differenceInMinutes(deadlineDate, now);
    if (diff < 0) return "Overdue";
    if (diff < 60) return `${diff}m`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return formatDistanceToNow(deadlineDate, { addSuffix: false });
  };

  const activeTasks = myTasks.filter((t) => ["in_progress", "assigned", "pending"].includes(t.status));
  const pendingReviewTasks = myTasks.filter((t) => t.status === "submitted");
  const completedTasks = myTasks.filter((t) => ["approved", "completed"].includes(t.status));
  const totalPoints = completedTasks.reduce((sum, t) => sum + t.points, 0);

  const getAgentForTask = (agentId: string | null) => {
    if (!agentId) return null;
    return myAgents.find((a) => a.id === agentId);
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Workspace</h1>
            <p className="text-muted-foreground">
              Your assigned agents and tasks in one place
            </p>
          </div>
          <div className="flex gap-3">
            <div className="border-2 border-border bg-card px-4 py-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-chart-4" />
              <span className="font-mono font-bold">{totalPoints} pts</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Bot className="h-4 w-4" />
              <span className="text-sm">My Agents</span>
            </div>
            <p className="text-2xl font-bold">{myAgents.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm">Total Tasks</span>
            </div>
            <p className="text-2xl font-bold">{myTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-4 mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">Active</span>
            </div>
            <p className="text-2xl font-bold">{activeTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-3 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">In Review</span>
            </div>
            <p className="text-2xl font-bold">{pendingReviewTasks.length}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-2 mb-1">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold">{completedTasks.length}</p>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="agents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agents ({myAgents.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              All Tasks ({myTasks.length})
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            {loadingAgents ? (
              <div className="border-2 border-border bg-card p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myAgents.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Agents Assigned</p>
                <p className="text-sm text-muted-foreground">
                  Wait for an admin to assign agents to you.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myAgents.map((agent) => {
                  const agentTasks = tasksByAgent[agent.id] || [];
                  const activeAgentTasks = agentTasks.filter((t) =>
                    ["in_progress", "assigned", "pending"].includes(t.status)
                  );
                  const completedAgentTasks = agentTasks.filter((t) =>
                    ["approved", "completed"].includes(t.status)
                  );

                  return (
                    <Card key={agent.id} className="border-2 hover:border-primary transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent border border-border">
                              <Bot className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{agent.agent_name}</CardTitle>
                            </div>
                          </div>
                          <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                            {agent.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Agent Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-muted/50 rounded">
                            <p className="text-lg font-bold">{agentTasks.length}</p>
                            <p className="text-xs text-muted-foreground">Tasks</p>
                          </div>
                          <div className="p-2 bg-chart-4/10 rounded">
                            <p className="text-lg font-bold text-chart-4">{activeAgentTasks.length}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
                          </div>
                          <div className="p-2 bg-chart-2/10 rounded">
                            <p className="text-lg font-bold text-chart-2">{completedAgentTasks.length}</p>
                            <p className="text-xs text-muted-foreground">Done</p>
                          </div>
                        </div>

                        {/* Active Tasks for this Agent */}
                        {activeAgentTasks.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Active Tasks:</p>
                            {activeAgentTasks.slice(0, 2).map((task) => (
                              <div
                                key={task.id}
                                className="p-2 bg-muted/30 border border-border text-sm flex items-center justify-between"
                              >
                                <span className="truncate flex-1">{task.title}</span>
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {task.points} pts
                                </Badge>
                              </div>
                            ))}
                            {activeAgentTasks.length > 2 && (
                              <p className="text-xs text-muted-foreground">
                                +{activeAgentTasks.length - 2} more tasks
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setSelectedAgent(agent)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Prompt
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/engineer/agent-config?agentId=${agent.id}`)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            {loadingTasks ? (
              <div className="border-2 border-border bg-card p-8 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : myTasks.length === 0 ? (
              <div className="border-2 border-border bg-card p-8 text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-bold mb-2">No Tasks Yet</p>
                <p className="text-sm text-muted-foreground">
                  Check the available tasks to pick one up.
                </p>
                <Button className="mt-4" onClick={() => navigate("/engineer/tasks")}>
                  Browse Available Tasks
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myTasks.map((task) => {
                  const agent = getAgentForTask(task.bolna_agent_id);
                  const isOverdue = task.deadline && new Date(task.deadline) < new Date();

                  return (
                    <div
                      key={task.id}
                      className={`border-2 bg-card p-4 ${
                        isOverdue && !["approved", "completed"].includes(task.status)
                          ? "border-destructive"
                          : "border-border"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold">{task.title}</h3>
                            <Badge className={getStatusColor(task.status)}>
                              {getStatusLabel(task.status)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {agent && (
                              <span className="flex items-center gap-1">
                                <Bot className="h-3 w-3" />
                                {agent.agent_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Trophy className="h-3 w-3 text-chart-4" />
                              {task.points} pts
                            </span>
                            {task.deadline && (
                              <span
                                className={`flex items-center gap-1 ${
                                  isOverdue ? "text-destructive" : ""
                                }`}
                              >
                                {isOverdue ? (
                                  <AlertCircle className="h-3 w-3" />
                                ) : (
                                  <Timer className="h-3 w-3" />
                                )}
                                {getTimeRemaining(task.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/engineer/tasks")}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Agent Prompt Dialog */}
        <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                {selectedAgent?.agent_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">System Prompt</label>
                <pre className="text-sm bg-muted p-3 rounded max-h-64 overflow-auto whitespace-pre-wrap mt-2">
                  {selectedAgent?.current_system_prompt || "No prompt configured"}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
