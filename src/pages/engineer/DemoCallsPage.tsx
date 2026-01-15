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
import { getExecution } from "@/lib/aitel";
import { DemoCallPreviewModal } from "@/components/engineer/DemoCallPreviewModal";
import {
  Phone,
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Bot,
  Play,
  RefreshCw,
  Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DemoCall {
  id: string;
  task_id: string;
  agent_id: string;
  phone_number: string;
  status: string;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  external_call_id: string | null;
  recording_url: string | null;
  transcript: string | null;
  tasks?: {
    title: string;
    selected_demo_call_id?: string;
  };
  aitel_agents?: {
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
  const [previewCall, setPreviewCall] = useState<DemoCall | null>(null);

  // Fetch demo calls
  const { data: demoCalls = [], isLoading, refetch } = useQuery({
    queryKey: ["demo-calls", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("demo_calls")
        .select(`
          *,
          tasks (title, selected_demo_call_id),
          aitel_agents (agent_name)
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

  // Auto-sync function with retry mechanism
  const autoSyncRecording = async (
    call: DemoCall,
    attempt: number = 1,
    maxAttempts: number = 5
  ): Promise<boolean> => {
    if (!call.external_call_id || call.recording_url) return true;
    
    try {
      const result = await getExecution(call.external_call_id);
      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to fetch");
      }

      const execution = result.data;
      const recordingUrl = execution.telephony_data?.recording_url || null;
      const transcript = execution.transcript || null;
      const duration = execution.conversation_time || null;
      const status = execution.status === "completed" ? "completed" : execution.status;

      if (recordingUrl) {
        await supabase
          .from("demo_calls")
          .update({
            recording_url: recordingUrl,
            transcript: transcript,
            duration_seconds: duration,
            status: status,
            ended_at: status === "completed" ? new Date().toISOString() : null,
          })
          .eq("id", call.id);

        toast({
          title: "Recording Auto-Synced",
          description: "Call recording fetched automatically!",
        });
        return true;
      }

      // Recording not ready yet, retry if attempts remaining
      if (attempt < maxAttempts) {
        const delay = Math.min(attempt * 5000, 15000); // 5s, 10s, 15s, 15s, 15s
        console.log(`Recording not ready, retry ${attempt}/${maxAttempts} in ${delay/1000}s`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return autoSyncRecording(call, attempt + 1, maxAttempts);
      }

      console.log("Max retry attempts reached, recording may not be available");
      return false;
    } catch (error) {
      console.error(`Auto-sync attempt ${attempt} failed:`, error);
      
      // Retry on error if attempts remaining
      if (attempt < maxAttempts) {
        const delay = Math.min(attempt * 5000, 15000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return autoSyncRecording(call, attempt + 1, maxAttempts);
      }
      return false;
    }
  };

  // Real-time subscription with auto-sync
  useEffect(() => {
    const channel = supabase
      .channel("demo-calls-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "demo_calls",
        },
        async (payload) => {
          const updatedCall = payload.new as DemoCall;
          
          // Auto-sync when call is completed but has no recording yet
          if (
            updatedCall.status === "completed" &&
            updatedCall.external_call_id &&
            !updatedCall.recording_url
          ) {
            // Wait 3 seconds initially, then start retry mechanism
            setTimeout(async () => {
              await autoSyncRecording(updatedCall, 1, 5);
              queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
            }, 3000);
          } else {
            queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
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
  }, [queryClient, toast]);

  // Sync demo call recording from Bolna
  const syncRecordingMutation = useMutation({
    mutationFn: async (call: DemoCall) => {
      if (!call.external_call_id) throw new Error("No external call ID");

      // Fetch execution data from Bolna
      const result = await getExecution(call.external_call_id);
      if (result.error || !result.data) {
        throw new Error(result.error || "Failed to fetch call data");
      }

      const execution = result.data;
      const recordingUrl = execution.telephony_data?.recording_url || null;
      const transcript = execution.transcript || null;
      const duration = execution.conversation_time || null;
      const status = execution.status === "completed" ? "completed" : execution.status;

      // Update demo call with recording data
      const { error } = await supabase
        .from("demo_calls")
        .update({
          recording_url: recordingUrl,
          transcript: transcript,
          duration_seconds: duration,
          status: status,
          ended_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", call.id);

      if (error) throw error;

      return { recordingUrl, transcript, duration, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["demo-calls"] });
      toast({
        title: "Recording Synced",
        description: data.recordingUrl 
          ? "Recording and transcript fetched successfully!" 
          : "Call data updated. Recording may not be available yet.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message,
      });
    },
  });

  // Submit demo call for review
  const submitDemoMutation = useMutation({
    mutationFn: async (callId: string) => {
      // Get the demo call to find the task
      const call = demoCalls.find((c) => c.id === callId);
      if (!call) throw new Error("Call not found");

      // Ensure recording is available
      if (!call.recording_url) {
        throw new Error("Please sync recording first before submitting");
      }

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
      call.aitel_agents?.agent_name?.toLowerCase().includes(search.toLowerCase());
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

        {/* Info */}
        <div className="text-sm text-muted-foreground bg-muted/30 p-4 border-2 border-border">
          <p><strong>How it works:</strong> Make demo calls to test your agent. After the call ends, click "Sync Recording" to fetch the recording from Bolna. Then submit your best demo call for admin review.</p>
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
                <TableHead className="font-bold">Recording</TableHead>
                <TableHead className="font-bold">Date</TableHead>
                <TableHead className="font-bold w-48"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredCalls.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No demo calls found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCalls.map((call) => {
                  const isSelected = call.tasks?.selected_demo_call_id === call.id;
                  return (
                    <TableRow 
                      key={call.id} 
                      className={`border-b-2 border-border ${isSelected ? 'bg-chart-2/10' : ''}`}
                    >
                      <TableCell className="font-mono">{call.phone_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {call.tasks?.title || "Unknown"}
                          {isSelected && (
                            <Badge variant="outline" className="bg-chart-2/20 text-chart-2 border-chart-2">
                              Selected
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {call.aitel_agents?.agent_name || "Unknown"}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell className="font-mono">
                        {call.duration_seconds ? `${call.duration_seconds}s` : "—"}
                      </TableCell>
                      <TableCell>
                        {call.recording_url ? (
                          <Badge variant="outline" className="bg-chart-2/20 text-chart-2 border-chart-2">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not synced</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(call.created_at), {
                          addSuffix: true,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Sync Recording Button */}
                          {call.external_call_id && !call.recording_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncRecordingMutation.mutate(call)}
                              disabled={syncRecordingMutation.isPending}
                            >
                              {syncRecordingMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Sync
                                </>
                              )}
                            </Button>
                          )}
                          {/* Preview Button */}
                          {call.recording_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewCall(call)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Preview
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Preview Modal */}
        <DemoCallPreviewModal
          call={previewCall}
          open={!!previewCall}
          onOpenChange={(open) => !open && setPreviewCall(null)}
          onSubmit={(callId) => {
            submitDemoMutation.mutate(callId);
            setPreviewCall(null);
          }}
          isSubmitting={submitDemoMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
