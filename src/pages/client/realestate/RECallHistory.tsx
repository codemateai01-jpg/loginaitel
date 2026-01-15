import { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Phone, 
  Clock,
  Play,
  FileText,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Loader2,
  BarChart3,
  CheckCircle,
  XCircle,
  Timer
} from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

// Status config for call display
const statusConfig: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  initiated: { label: "Initiated", icon: PhoneCall, color: "bg-blue-500" },
  ringing: { label: "Ringing", icon: Phone, color: "bg-yellow-500" },
  in_progress: { label: "In Progress", icon: Loader2, color: "bg-orange-500" },
  in_call: { label: "In Progress", icon: Loader2, color: "bg-orange-500" },
  completed: { label: "Completed", icon: PhoneOff, color: "bg-green-500" },
  failed: { label: "Failed", icon: PhoneMissed, color: "bg-red-500" },
  busy: { label: "Busy", icon: PhoneMissed, color: "bg-yellow-600" },
  no_answer: { label: "No Answer", icon: PhoneMissed, color: "bg-gray-500" },
  voicemail: { label: "Voicemail", icon: PhoneMissed, color: "bg-purple-500" },
  stopped: { label: "Stopped", icon: PhoneOff, color: "bg-gray-600" },
};

type CallDisposition = 'answered' | 'not_answered' | 'busy' | 'voicemail' | 'wrong_number' | 'callback_requested';

interface RECall {
  id: string;
  created_at: string;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  lead_name: string | null;
  lead_phone: string;
  lead_stage: string;
  project_name: string | null;
  project_id: string | null;
  from_phone: string | null;
  // From real_estate_calls if available
  disposition: CallDisposition | null;
  ai_summary: string | null;
  objections_detected: string[] | null;
  interest_score: number | null;
  notes: string | null;
}

interface Project {
  id: string;
  name: string;
}

const dispositionConfig: Record<CallDisposition, { label: string; color: string }> = {
  answered: { label: "Answered", color: "bg-green-500" },
  not_answered: { label: "Not Answered", color: "bg-gray-500" },
  busy: { label: "Busy", color: "bg-yellow-500" },
  voicemail: { label: "Voicemail", color: "bg-blue-500" },
  wrong_number: { label: "Wrong Number", color: "bg-red-500" },
  callback_requested: { label: "Callback", color: "bg-purple-500" },
};

export default function RECallHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [calls, setCalls] = useState<RECall[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  
  // Details dialog
  const [selectedCall, setSelectedCall] = useState<RECall | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("client_id", user.id);
    setProjects(data || []);
  }, [user]);

  const fetchCalls = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch calls directly from calls table with real_estate_leads join
      // This ensures we get all calls even if real_estate_calls record wasn't created
      let query = supabase
        .from("calls")
        .select(`
          id,
          created_at,
          status,
          duration_seconds,
          recording_url,
          transcript,
          summary,
          lead_id,
          metadata
        `)
        .eq("client_id", user.id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: callsData, error: callsError } = await query;

      if (callsError) throw callsError;

      // Get all lead IDs
      const leadIds = [...new Set((callsData || []).map(c => c.lead_id))];
      
      // Fetch real_estate_leads data
      const { data: leadsData } = await supabase
        .from("real_estate_leads")
        .select("id, name, phone_number, stage, project_id, projects(name)")
        .in("id", leadIds);

      // Fetch real_estate_calls data
      const callIds = (callsData || []).map(c => c.id);
      const { data: reCallsData } = await supabase
        .from("real_estate_calls")
        .select("call_id, disposition, ai_summary, objections_detected, interest_score, notes")
        .in("call_id", callIds);

      // Map leads and re_calls by their IDs
      const leadsMap = new Map((leadsData || []).map(l => [l.id, l]));
      const reCallsMap = new Map((reCallsData || []).map(rc => [rc.call_id, rc]));

      // Combine the data
      let combinedCalls: RECall[] = (callsData || []).map(call => {
        const lead = leadsMap.get(call.lead_id);
        const reCall = reCallsMap.get(call.id);
        
        // Get actual status from metadata if available
        const metadata = call.metadata as any;
        let displayStatus = call.status;
        if (metadata?.aitel_status) {
          displayStatus = metadata.aitel_status;
        }
        
        // Get the from_phone from metadata
        const fromPhone = metadata?.from_phone_number || metadata?.from_number || null;
        
        return {
          id: call.id,
          created_at: call.created_at,
          status: displayStatus,
          duration_seconds: call.duration_seconds,
          recording_url: call.recording_url,
          transcript: call.transcript,
          summary: call.summary,
          lead_name: lead?.name || null,
          lead_phone: lead?.phone_number || "Unknown",
          lead_stage: lead?.stage || "new",
          project_name: (lead?.projects as any)?.name || null,
          project_id: lead?.project_id || null,
          from_phone: fromPhone,
          disposition: reCall?.disposition || null,
          ai_summary: reCall?.ai_summary || call.summary || null,
          objections_detected: reCall?.objections_detected || null,
          interest_score: reCall?.interest_score || null,
          notes: reCall?.notes || null,
        };
      });

      // Filter by project if needed
      if (projectFilter !== "all") {
        combinedCalls = combinedCalls.filter(c => c.project_id === projectFilter);
      }

      // Filter by search if needed
      if (searchQuery) {
        const lowerSearch = searchQuery.toLowerCase();
        combinedCalls = combinedCalls.filter(call => 
          call.lead_name?.toLowerCase().includes(lowerSearch) ||
          call.lead_phone.includes(searchQuery)
        );
      }

      setCalls(combinedCalls);
    } catch (error) {
      console.error("Error fetching calls:", error);
      toast({
        title: "Error",
        description: "Failed to fetch call history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter, projectFilter, searchQuery, toast]);

  useEffect(() => {
    fetchProjects();
    fetchCalls();

    // Set up realtime subscription for calls table
    const channel = supabase
      .channel('realtime-calls')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `client_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('Call update received:', payload);
          
          if (payload.eventType === 'INSERT') {
            // Fetch the new call with lead data
            fetchCalls();
          } else if (payload.eventType === 'UPDATE') {
            const updatedCall = payload.new as any;
            const metadata = updatedCall.metadata as any;
            let displayStatus = updatedCall.status;
            if (metadata?.aitel_status) {
              displayStatus = metadata.aitel_status;
            }
            
            // Update the specific call in state
            setCalls(prev => prev.map(call => {
              if (call.id === updatedCall.id) {
                return {
                  ...call,
                  status: displayStatus,
                  duration_seconds: updatedCall.duration_seconds,
                  recording_url: updatedCall.recording_url,
                  transcript: updatedCall.transcript,
                  summary: updatedCall.summary,
                  ai_summary: updatedCall.summary || call.ai_summary,
                };
              }
              return call;
            }));
          } else if (payload.eventType === 'DELETE') {
            setCalls(prev => prev.filter(call => call.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProjects, fetchCalls, user?.id]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || statusConfig.initiated;
  };

  const handleViewDetails = (call: RECall) => {
    setSelectedCall(call);
    setDetailsOpen(true);
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const failedCalls = calls.filter(c => c.status === 'failed' || c.status === 'no_answer' || c.status === 'busy').length;
    const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;
    
    // Average duration of completed calls
    const completedWithDuration = calls.filter(c => c.status === 'completed' && c.duration_seconds && c.duration_seconds > 0);
    const avgDuration = completedWithDuration.length > 0 
      ? Math.round(completedWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completedWithDuration.length)
      : 0;
    
    // Average interest score
    const callsWithScore = calls.filter(c => c.interest_score !== null);
    const avgInterestScore = callsWithScore.length > 0 
      ? Math.round(callsWithScore.reduce((sum, c) => sum + (c.interest_score || 0), 0) / callsWithScore.length)
      : 0;

    // Calls by project
    const projectStats = projects.map(project => {
      const projectCalls = calls.filter(c => c.project_id === project.id);
      const projectCompleted = projectCalls.filter(c => c.status === 'completed').length;
      return {
        name: project.name,
        total: projectCalls.length,
        completed: projectCompleted,
        failed: projectCalls.length - projectCompleted,
      };
    }).filter(p => p.total > 0);

    // Status distribution
    const statusDistribution = [
      { name: 'Completed', value: completedCalls, color: '#22c55e' },
      { name: 'Failed', value: failedCalls, color: '#ef4444' },
      { name: 'In Progress', value: calls.filter(c => ['initiated', 'ringing', 'in_progress', 'in_call'].includes(c.status)).length, color: '#f97316' },
    ].filter(s => s.value > 0);

    // Daily call volume (last 7 days)
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date(),
    });

    const dailyVolume = last7Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayCalls = calls.filter(c => {
        const callDate = new Date(c.created_at);
        return callDate >= dayStart && callDate < dayEnd;
      });
      
      return {
        date: format(day, 'MMM d'),
        calls: dayCalls.length,
        completed: dayCalls.filter(c => c.status === 'completed').length,
      };
    });

    // Interest score trend (last 7 days)
    const interestTrend = last7Days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayCalls = calls.filter(c => {
        const callDate = new Date(c.created_at);
        return callDate >= dayStart && callDate < dayEnd && c.interest_score !== null;
      });
      
      const avgScore = dayCalls.length > 0 
        ? Math.round(dayCalls.reduce((sum, c) => sum + (c.interest_score || 0), 0) / dayCalls.length)
        : null;
      
      return {
        date: format(day, 'MMM d'),
        score: avgScore,
      };
    });

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      successRate,
      avgDuration,
      avgInterestScore,
      projectStats,
      statusDistribution,
      dailyVolume,
      interestTrend,
    };
  }, [calls, projects]);

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Call History & Analytics</h1>
            <p className="text-muted-foreground">
              View AI call summaries, recordings, and performance metrics
            </p>
          </div>
          <Button variant="outline" onClick={fetchCalls}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="history" className="space-y-6">
          <TabsList>
            <TabsTrigger value="history" className="gap-2">
              <Phone className="h-4 w-4" />
              Call History
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Call History Tab */}
          <TabsContent value="history" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="initiated">Initiated</SelectItem>
                      <SelectItem value="ringing">Ringing</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Calls Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>From Number</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : calls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No call history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      calls.map((call) => {
                        const config = getStatusConfig(call.status);
                        const StatusIcon = config.icon;
                        return (
                          <TableRow key={call.id}>
                            <TableCell>
                              <span className="text-sm">
                                {format(new Date(call.created_at), "MMM d, h:mm a")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {call.lead_name || "Unknown"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {call.lead_phone}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {call.from_phone ? (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  <Phone className="h-3 w-3 mr-1" />
                                  {call.from_phone}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {call.project_name ? (
                                <Badge variant="outline">{call.project_name}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                                <StatusIcon className={`h-3 w-3 ${call.status === 'in_progress' || call.status === 'in_call' ? 'animate-spin' : ''}`} />
                                {config.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {formatDuration(call.duration_seconds)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {call.interest_score !== null ? (
                                <Badge variant={call.interest_score >= 70 ? "default" : call.interest_score >= 40 ? "secondary" : "outline"}>
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  {call.interest_score}%
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <p className="text-sm text-muted-foreground line-clamp-2 max-w-[200px]">
                                {call.ai_summary || "No summary available"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewDetails(call)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                {call.recording_url && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => window.open(call.recording_url!, "_blank")}
                                  >
                                    <Play className="h-4 w-4" />
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{analytics.totalCalls}</p>
                      <p className="text-sm text-muted-foreground">Total Calls</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{analytics.successRate}%</p>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Timer className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{formatDuration(analytics.avgDuration)}</p>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{analytics.avgInterestScore}%</p>
                      <p className="text-sm text-muted-foreground">Avg Interest</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Daily Call Volume */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Daily Call Volume (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.dailyVolume}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar dataKey="calls" name="Total Calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {analytics.statusDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.statusDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {analytics.statusDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No call data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Calls by Project */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Calls by Project</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {analytics.projectStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.projectStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" />
                          <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" />
                          <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        No project data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Interest Score Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Interest Score Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.interestTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis domain={[0, 100]} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value) => value !== null ? [`${value}%`, 'Interest Score'] : ['No data', '']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Call Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
          </DialogHeader>

          {selectedCall && (
            <div className="space-y-6">
              {/* Lead Info */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-lg">
                    {selectedCall.lead_name || "Unknown"}
                  </p>
                  <p className="text-muted-foreground">
                    {selectedCall.lead_phone}
                  </p>
                  {selectedCall.project_name && (
                    <Badge variant="outline" className="mt-1">{selectedCall.project_name}</Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedCall.created_at), "PPP 'at' p")}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDuration(selectedCall.duration_seconds)}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  {(() => {
                    const config = getStatusConfig(selectedCall.status);
                    const StatusIcon = config.icon;
                    return (
                      <Badge className={`${config.color} flex items-center gap-1 w-fit`}>
                        <StatusIcon className="h-4 w-4" />
                        {config.label}
                      </Badge>
                    );
                  })()}
                </div>
                
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Interest Score</p>
                  {selectedCall.interest_score !== null ? (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span className="text-2xl font-bold">{selectedCall.interest_score}%</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not analyzed</span>
                  )}
                </div>
              </div>

              {/* Disposition if available */}
              {selectedCall.disposition && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Disposition</p>
                  <Badge className={dispositionConfig[selectedCall.disposition].color}>
                    {dispositionConfig[selectedCall.disposition].label}
                  </Badge>
                </div>
              )}

              {/* AI Summary */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">AI Summary</p>
                <p className="text-sm">
                  {selectedCall.ai_summary || "No summary available for this call."}
                </p>
              </div>

              {/* Objections */}
              {selectedCall.objections_detected && selectedCall.objections_detected.length > 0 && (
                <div className="p-4 border rounded-lg border-orange-200 bg-orange-50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-800">Objections Detected</p>
                  </div>
                  <ul className="space-y-1">
                    {selectedCall.objections_detected.map((objection, i) => (
                      <li key={i} className="text-sm text-orange-700">• {objection}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recording */}
              {selectedCall.recording_url && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Recording</p>
                  <audio controls className="w-full">
                    <source src={selectedCall.recording_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Transcript */}
              {selectedCall.transcript && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Transcript</p>
                  <div className="max-h-60 overflow-y-auto text-sm whitespace-pre-wrap">
                    {selectedCall.transcript}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCall.notes && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Notes</p>
                  <p className="text-sm">{selectedCall.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
