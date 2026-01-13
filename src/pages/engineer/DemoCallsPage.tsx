import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  Send,
  Loader2,
  Bot,
  Play,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface DemoCall {
  id: string;
  task_id: string;
  agent_id: string;
  phone_number: string;
  status: string;
  duration_seconds: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  tasks?: {
    title: string;
  };
  bolna_agents?: {
    agent_name: string;
  };
}

export default function DemoCallsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const taskIdFilter = searchParams.get("taskId");
  const [search, setSearch] = useState("");
  const [filterTaskId, setFilterTaskId] = useState<string>(taskIdFilter || "all");

  // Fetch demo calls
  const { data: demoCalls = [], isLoading } = useQuery({
    queryKey: ["demo-calls", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("demo_calls")
        .select(`
          *,
          tasks (title),
          bolna_agents (agent_name)
        `)
        .eq("engineer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DemoCall[];
    },
    enabled: !!user?.id,
  });

  // Fetch tasks for filter dropdown
  const { data: tasks = [] } = useQuery({
    queryKey: ["my-tasks-filter", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("assigned_to", user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("demo-calls-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "demo_calls",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Submit demo call for review
  const submitDemoMutation = useMutation({
    mutationFn: async (callId: string) => {
      // Get the demo call to find the task
      const call = demoCalls.find((c) => c.id === callId);
      if (!call) throw new Error("Call not found");

      // Update task with selected demo call and change status
      const { error } = await supabase
        .from("tasks")
        .update({
          selected_demo_call_id: callId,
          status: "demo_submitted",
          demo_completed_at: new Date().toISOString(),
        })
        .eq("id", call.task_id)
        .eq("assigned_to", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      toast({
        title: "Demo Submitted!",
        description: "Your demo call has been submitted for admin review.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const filteredCalls = demoCalls.filter((call) => {
    const matchesSearch =
      call.phone_number.includes(search) ||
      call.tasks?.title?.toLowerCase().includes(search.toLowerCase()) ||
      call.bolna_agents?.agent_name?.toLowerCase().includes(search.toLowerCase());
    const matchesTask = filterTaskId === "all" || call.task_id === filterTaskId;
    return matchesSearch && matchesTask;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-chart-2/20 text-chart-2 border-chart-2">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-chart-4/20 text-chart-4 border-chart-4">
            <Play className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout role="engineer">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/engineer/tasks")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Demo Call Logs</h1>
              <p className="text-muted-foreground">
                View and submit demo calls for review
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by phone, task, or agent..."
              className="pl-10 border-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterTaskId} onValueChange={setFilterTaskId}>
            <SelectTrigger className="w-[200px] border-2">
              <SelectValue placeholder="Filter by task" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              {tasks.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border-2 border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border hover:bg-transparent">
                <TableHead className="font-bold">Phone</TableHead>
                <TableHead className="font-bold">Task</TableHead>
                <TableHead className="font-bold">Agent</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold">Duration</TableHead>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="font-bold w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredCalls.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No demo calls found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCalls.map((call) => (
                  <TableRow key={call.id} className="border-b-2 border-border">
                    <TableCell className="font-mono">{call.phone_number}</TableCell>
                    <TableCell>{call.tasks?.title || "Unknown"}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {call.bolna_agents?.agent_name || "Unknown"}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(call.status)}</TableCell>
                    <TableCell className="font-mono">
                      {call.duration_seconds}s
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(call.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      {call.status === "completed" && (
                        <Button
                          size="sm"
                          onClick={() => submitDemoMutation.mutate(call.id)}
                          disabled={submitDemoMutation.isPending}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          Submit for Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
