import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  Eye,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Play,
  FileText,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";

interface Call {
  id: string;
  lead_id: string;
  agent_id: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean;
  sentiment: string | null;
  summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  created_at: string;
  lead: { name: string; phone_number: string };
  agent: { agent_name: string };
}

const sentimentConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  positive: { 
    icon: <TrendingUp className="h-4 w-4" />, 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    label: "Positive"
  },
  neutral: { 
    icon: <Minus className="h-4 w-4" />, 
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    label: "Neutral"
  },
  negative: { 
    icon: <TrendingDown className="h-4 w-4" />, 
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    label: "Negative"
  },
};

export default function MonitoringDashboard() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [transcriptDialogOpen, setTranscriptDialogOpen] = useState(false);

  // Get sub-user info
  const { data: subUserInfo } = useQuery({
    queryKey: ["sub-user-info", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_sub_users")
        .select("id, role, client_id")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch calls
  const { data: calls, isLoading } = useQuery({
    queryKey: ["monitoring-calls", subUserInfo?.client_id, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("calls")
        .select(`
          *,
          lead:campaign_leads!lead_id(name, phone_number),
          agent:aitel_agents!agent_id(agent_name)
        `)
        .eq("client_id", subUserInfo!.client_id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Call[];
    },
    enabled: !!subUserInfo?.client_id,
  });

  const filteredCalls = calls?.filter((call) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      call.lead?.name?.toLowerCase().includes(search) ||
      call.lead?.phone_number?.includes(search) ||
      call.agent?.agent_name?.toLowerCase().includes(search)
    );
  });

  const stats = {
    total: calls?.length || 0,
    connected: calls?.filter((c) => c.connected).length || 0,
    completed: calls?.filter((c) => c.status === "completed").length || 0,
    avgDuration: Math.round(
      (calls?.filter((c) => c.duration_seconds)
        .reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) /
      (calls?.filter((c) => c.duration_seconds).length || 1)
    ),
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!subUserInfo || subUserInfo.role !== "monitoring") {
    return (
      <DashboardLayout role="client">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md text-center p-6">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              This dashboard is only available for monitoring team members.
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Call Monitoring Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor call recordings, transcripts, and analytics
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Connected</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.connected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Duration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Call Records</CardTitle>
            <CardDescription>
              View and analyze all call recordings and transcripts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="no-answer">No Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCalls && filteredCalls.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{call.lead?.name || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">
                            {call.lead?.phone_number}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{call.agent?.agent_name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={call.connected ? "default" : "secondary"}
                          className={call.connected ? "bg-green-500" : ""}
                        >
                          {call.connected ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {call.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.sentiment && sentimentConfig[call.sentiment] && (
                          <Badge className={sentimentConfig[call.sentiment].color}>
                            <span className="flex items-center gap-1">
                              {sentimentConfig[call.sentiment].icon}
                              {sentimentConfig[call.sentiment].label}
                            </span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(call.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {call.recording_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(call.recording_url!, "_blank")}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          {call.transcript && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCall(call);
                                setTranscriptDialogOpen(true);
                              }}
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No calls found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Call data will appear here once calls are made"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transcript Dialog */}
      <Dialog open={transcriptDialogOpen} onOpenChange={setTranscriptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Call Transcript - {selectedCall?.lead?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCall?.summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">AI Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{selectedCall.summary}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Full Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <pre className="text-sm whitespace-pre-wrap font-sans">
                    {selectedCall?.transcript || "No transcript available"}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
