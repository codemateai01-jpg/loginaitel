import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { downloadRecording } from "@/lib/aitel";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  Search,
  Filter,
  Play,
  Clock,
  User,
  Bot,
  ClipboardList,
  Loader2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DemoCall {
  id: string;
  task_id: string;
  agent_id: string;
  engineer_id: string;
  phone_number: string;
  external_call_id: string | null;
  status: string;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
  updated_at: string;
}

interface Task {
  id: string;
  title: string;
}

interface Agent {
  id: string;
  agent_name: string;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "initiated":
      return "bg-muted text-muted-foreground";
    case "ringing":
      return "bg-chart-4/20 text-chart-4";
    case "in_progress":
      return "bg-chart-3/20 text-chart-3";
    case "completed":
      return "bg-chart-2/20 text-chart-2";
    case "failed":
      return "bg-destructive/20 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function AdminDemoLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTask, setFilterTask] = useState<string>("all");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterEngineer, setFilterEngineer] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<DemoCall | null>(null);

  // Fetch demo calls
  const { data: demoCalls = [], isLoading: loadingCalls } = useQuery({
    queryKey: ["admin-demo-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_calls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DemoCall[];
    },
  });

  // Fetch tasks for filter
  const { data: tasks = [] } = useQuery({
    queryKey: ["admin-tasks-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Task[];
    },
  });

  // Fetch agents for filter
  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("id, agent_name")
        .order("agent_name", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as Agent[];
    },
  });

  // Fetch profiles for filter
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Filter demo calls
  const filteredCalls = demoCalls.filter((call) => {
    const matchesSearch = 
      call.phone_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.external_call_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTask = filterTask === "all" || call.task_id === filterTask;
    const matchesAgent = filterAgent === "all" || call.agent_id === filterAgent;
    const matchesEngineer = filterEngineer === "all" || call.engineer_id === filterEngineer;
    const matchesStatus = filterStatus === "all" || call.status === filterStatus;

    return matchesSearch && matchesTask && matchesAgent && matchesEngineer && matchesStatus;
  });

  // Helper to get task title
  const getTaskTitle = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.title || "Unknown Task";
  };

  // Helper to get agent name
  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.agent_name || "Unknown Agent";
  };

  // Helper to get engineer name
  const getEngineerName = (engineerId: string) => {
    const profile = profiles.find(p => p.user_id === engineerId);
    return profile?.full_name || profile?.email || "Unknown Engineer";
  };

  // Stats
  const totalCalls = demoCalls.length;
  const completedCalls = demoCalls.filter(c => c.status === "completed").length;
  const failedCalls = demoCalls.filter(c => c.status === "failed").length;
  const avgDuration = demoCalls
    .filter(c => c.duration_seconds)
    .reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / (completedCalls || 1);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Demo Call Logs</h1>
          <p className="text-muted-foreground">
            View and filter all demo calls made by engineers
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Total Calls</span>
            </div>
            <p className="text-2xl font-bold">{totalCalls}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-2 mb-1">
              <Play className="h-4 w-4" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold">{completedCalls}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Failed</span>
            </div>
            <p className="text-2xl font-bold">{failedCalls}</p>
          </div>
          <div className="border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2 text-chart-4 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Avg Duration</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(avgDuration)}s</p>
          </div>
        </div>

        {/* Filters */}
        <div className="border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone or call ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterTask} onValueChange={setFilterTask}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Task" />
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
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.agent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEngineer} onValueChange={setFilterEngineer}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Engineer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engineers</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.user_id} value={profile.user_id}>
                    {profile.full_name || profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="initiated">Initiated</SelectItem>
                <SelectItem value="ringing">Ringing</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Demo Calls Table */}
        <div className="border-2 border-border bg-card">
          {loadingCalls ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="p-8 text-center">
              <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="font-bold mb-2">No Demo Calls Found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || filterTask !== "all" || filterAgent !== "all" || filterEngineer !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "No demo calls have been made yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Engineer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-mono">{call.phone_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[150px]" title={getTaskTitle(call.task_id)}>
                          {getTaskTitle(call.task_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[120px]" title={getAgentName(call.agent_id)}>
                          {getAgentName(call.agent_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[120px]" title={getEngineerName(call.engineer_id)}>
                          {getEngineerName(call.engineer_id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(call.status)}>
                        {call.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {call.duration_seconds ? `${call.duration_seconds}s` : "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground" title={format(new Date(call.created_at), "PPpp")}>
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCall(call)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Showing count */}
        {filteredCalls.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredCalls.length} of {demoCalls.length} demo calls
          </p>
        )}
      </div>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demo Call Details</DialogTitle>
            <DialogDescription>
              Full details for this demo call
            </DialogDescription>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <p className="font-mono">{selectedCall.phone_number}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(selectedCall.status)}>
                    {selectedCall.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Task</label>
                  <p>{getTaskTitle(selectedCall.task_id)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Agent</label>
                  <p>{getAgentName(selectedCall.agent_id)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Engineer</label>
                  <p>{getEngineerName(selectedCall.engineer_id)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Duration</label>
                  <p>{selectedCall.duration_seconds ? `${selectedCall.duration_seconds} seconds` : "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Started At</label>
                  <p>{selectedCall.started_at ? format(new Date(selectedCall.started_at), "PPpp") : "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Ended At</label>
                  <p>{selectedCall.ended_at ? format(new Date(selectedCall.ended_at), "PPpp") : "N/A"}</p>
                </div>
              </div>

              {selectedCall.external_call_id && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">External Call ID</label>
                  <p className="font-mono text-sm">{selectedCall.external_call_id}</p>
                </div>
              )}

              {selectedCall.recording_url && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Recording</label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadRecording(selectedCall.recording_url!, `demo-call-${selectedCall.id}.mp3`)}
                    className="w-full"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Download Recording
                  </Button>
                </div>
              )}

              {selectedCall.transcript && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Transcript
                  </label>
                  <div className="bg-muted p-4 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
                    {selectedCall.transcript}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
