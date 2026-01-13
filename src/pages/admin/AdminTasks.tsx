import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Bot,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateTaskDialog } from "@/components/admin/CreateTaskDialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const statusConfig = {
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-chart-2/10 border-chart-2 text-chart-2",
  },
  pending_review: {
    label: "Pending Review",
    icon: AlertCircle,
    className: "bg-chart-4/10 border-chart-4 text-chart-4",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-chart-1/10 border-chart-1 text-chart-1",
  },
  assigned: {
    label: "Assigned",
    icon: ClipboardList,
    className: "bg-chart-3/10 border-chart-3 text-chart-3",
  },
  pending: {
    label: "Pending",
    icon: ClipboardList,
    className: "bg-muted border-border text-muted-foreground",
  },
};

export default function AdminTasks() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["admin-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          bolna_agents (
            id,
            agent_name
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for assigned engineers
  const { data: profiles } = useQuery({
    queryKey: ["engineer-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const getEngineerName = (userId: string | null) => {
    if (!userId || !profiles) return "Unassigned";
    const profile = profiles.find((p) => p.user_id === userId);
    return profile?.full_name || profile?.email || "Unknown";
  };

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tasks"] });
      toast.success("Task deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const filteredTasks = tasks?.filter(
    (task) =>
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: tasks?.length || 0,
    pendingReview: tasks?.filter((t) => t.status === "pending_review").length || 0,
    inProgress: tasks?.filter((t) => t.status === "in_progress").length || 0,
    completed: tasks?.filter((t) => t.status === "completed").length || 0,
  };

  const handleEdit = (task: any) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Task Management</h1>
            <p className="text-muted-foreground">
              Create, assign, and track engineer tasks
            </p>
          </div>
          <Button className="shadow-sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-4">{stats.pendingReview}</p>
            <p className="text-sm text-muted-foreground">Pending Review</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-1">{stats.inProgress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
          <div className="border-2 border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-chart-2">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-10 border-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border hover:bg-transparent">
                <TableHead className="font-bold">Task</TableHead>
                <TableHead className="font-bold">Agent</TableHead>
                <TableHead className="font-bold">Engineer</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Deadline</TableHead>
                <TableHead className="font-bold text-right">Points</TableHead>
                <TableHead className="font-bold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading tasks...
                  </TableCell>
                </TableRow>
              ) : filteredTasks?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks?.map((task) => {
                  const status = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={task.id} className="border-b-2 border-border">
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell>
                        {task.bolna_agents ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Bot className="h-3 w-3" />
                            {task.bolna_agents.agent_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No agent</span>
                        )}
                      </TableCell>
                      <TableCell>{getEngineerName(task.assigned_to)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium border-2 ${status.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.deadline
                          ? formatDistanceToNow(new Date(task.deadline), { addSuffix: true })
                          : "No deadline"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {task.points}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(task)}>
                              Edit Task
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(task.id)}
                            >
                              Delete Task
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
      />
    </DashboardLayout>
  );
}
