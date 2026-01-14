import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  BarChart3,
  PieChart,
  RefreshCw,
  Loader2,
  Calendar,
  Target,
  Zap,
  ThumbsUp,
  AlertCircle,
  Timer,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listBatches, listAgentExecutions, type Batch, type CallExecution } from "@/lib/bolna";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  Tooltip,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

interface BatchStats {
  batch: Batch;
  executions: CallExecution[];
  totalDialed: number;
  answered: number;
  connected: number;
  successful: number;
  failed: number;
  noAnswer: number;
  busy: number;
  voicemail: number;
  avgDuration: number;
  totalCost: number;
  answerRate: number;
  connectRate: number;
  successRate: number;
}

const COLORS = {
  answered: "hsl(var(--chart-2))",
  connected: "hsl(var(--chart-1))",
  successful: "hsl(var(--primary))",
  failed: "hsl(var(--destructive))",
  noAnswer: "hsl(var(--chart-4))",
  busy: "hsl(var(--chart-5))",
  voicemail: "hsl(var(--muted-foreground))",
};

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = "primary"
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: React.ElementType;
  trend?: { value: number; label: string };
  color?: "primary" | "success" | "warning" | "destructive";
}) {
  const colorClasses = {
    primary: "text-primary bg-primary/10 border-primary/20",
    success: "text-green-600 bg-green-500/10 border-green-500/20",
    warning: "text-yellow-600 bg-yellow-500/10 border-yellow-500/20",
    destructive: "text-destructive bg-destructive/10 border-destructive/20",
  };

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-3 border ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            {trend.value >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className={trend.value >= 0 ? "text-green-600" : "text-destructive"}>
              {trend.value >= 0 ? "+" : ""}{trend.value}%
            </span>
            <span className="text-muted-foreground">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelChart({ stats }: { stats: BatchStats }) {
  const data = [
    { name: "Dialed", value: stats.totalDialed, fill: "hsl(var(--muted-foreground))" },
    { name: "Answered", value: stats.answered, fill: COLORS.answered },
    { name: "Connected (>45s)", value: stats.connected, fill: COLORS.connected },
    { name: "Successful", value: stats.successful, fill: COLORS.successful },
  ];

  return (
    <div className="space-y-4">
      {data.map((item, index) => {
        const percentage = stats.totalDialed > 0 
          ? Math.round((item.value / stats.totalDialed) * 100) 
          : 0;
        const prevValue = index > 0 ? data[index - 1].value : item.value;
        const conversionRate = prevValue > 0 
          ? Math.round((item.value / prevValue) * 100) 
          : 0;

        return (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3" 
                  style={{ backgroundColor: item.fill }}
                />
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-bold">{item.value}</span>
                <Badge variant="outline">{percentage}%</Badge>
                {index > 0 && (
                  <Badge 
                    variant={conversionRate >= 50 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {conversionRate}% conv
                  </Badge>
                )}
              </div>
            </div>
            <Progress 
              value={percentage} 
              className="h-3"
              style={{ 
                // @ts-ignore
                "--progress-background": item.fill 
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function StatusBreakdownChart({ stats }: { stats: BatchStats }) {
  const data = [
    { name: "Completed", value: stats.connected, color: COLORS.connected },
    { name: "No Answer", value: stats.noAnswer, color: COLORS.noAnswer },
    { name: "Failed", value: stats.failed, color: COLORS.failed },
    { name: "Busy", value: stats.busy, color: COLORS.busy },
    { name: "Voicemail", value: stats.voicemail, color: COLORS.voicemail },
  ].filter(d => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <RechartsPie>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </RechartsPie>
    </ResponsiveContainer>
  );
}

export default function BatchAnalytics() {
  const { role } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["bolna-agents-analytics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents" as any)
        .select("id, agent_name, external_agent_id")
        .eq("status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch all batches
  const { data: allBatches, isLoading: batchesLoading, refetch } = useQuery({
    queryKey: ["all-batches-analytics", selectedAgent],
    queryFn: async () => {
      const allBatches: (Batch & { agentId: string; agentName: string })[] = [];
      const agentsToFetch = selectedAgent === "all" 
        ? agents 
        : agents?.filter((a: any) => a.id === selectedAgent);
      
      for (const agent of agentsToFetch || []) {
        if (agent.external_agent_id) {
          const result = await listBatches(agent.external_agent_id);
          if (result.data) {
            allBatches.push(...result.data.map(b => ({ 
              ...b, 
              agentId: agent.external_agent_id, 
              agentName: agent.agent_name 
            })));
          }
        }
      }
      return allBatches.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!agents && agents.length > 0,
  });

  // Fetch executions for selected batches
  const { data: batchStats, isLoading: statsLoading } = useQuery({
    queryKey: ["batch-stats", selectedBatch, allBatches],
    queryFn: async () => {
      if (!allBatches || allBatches.length === 0) return [];

      const batchesToAnalyze = selectedBatch === "all" 
        ? allBatches.filter(b => b.status === "executed")
        : allBatches.filter(b => b.batch_id === selectedBatch);

      const stats: BatchStats[] = [];

      for (const batch of batchesToAnalyze) {
        // Get executions for this batch
        const result = await listAgentExecutions({
          agent_id: batch.agentId,
          batch_id: batch.batch_id,
          page_size: 1000,
        });

        const executions = result.data?.data || [];
        
        // Calculate metrics
        const totalDialed = batch.valid_contacts || executions.length;
        const answered = executions.filter(e => 
          e.status === "completed" || 
          e.status === "call-disconnected" ||
          (e.conversation_time && e.conversation_time > 0)
        ).length;
        const connected = executions.filter(e => 
          e.conversation_time && e.conversation_time >= 45
        ).length;
        
        // Success = connected + positive sentiment or goal achieved (from metadata)
        const successful = executions.filter(e => {
          if (!e.conversation_time || e.conversation_time < 45) return false;
          // Check extracted_data for success indicators
          const extracted = e.extracted_data as Record<string, unknown> | undefined;
          if (extracted?.interested === true || extracted?.goal_achieved === true) return true;
          // Default: consider 60+ second connected calls as successful
          return e.conversation_time >= 60;
        }).length;

        const failed = executions.filter(e => e.status === "failed").length;
        const noAnswer = executions.filter(e => e.status === "no-answer").length;
        const busy = executions.filter(e => e.status === "busy").length;
        const voicemail = executions.filter(e => e.answered_by_voice_mail).length;

        const totalDuration = executions.reduce((sum, e) => sum + (e.conversation_time || 0), 0);
        const avgDuration = answered > 0 ? totalDuration / answered : 0;
        const totalCost = executions.reduce((sum, e) => sum + (e.total_cost || 0), 0);

        stats.push({
          batch,
          executions,
          totalDialed,
          answered,
          connected,
          successful,
          failed,
          noAnswer,
          busy,
          voicemail,
          avgDuration,
          totalCost,
          answerRate: totalDialed > 0 ? (answered / totalDialed) * 100 : 0,
          connectRate: answered > 0 ? (connected / answered) * 100 : 0,
          successRate: connected > 0 ? (successful / connected) * 100 : 0,
        });
      }

      return stats;
    },
    enabled: !!allBatches && allBatches.length > 0,
  });

  // Aggregate stats for overview
  const aggregateStats = useMemo(() => {
    if (!batchStats || batchStats.length === 0) return null;

    return batchStats.reduce((acc, stat) => ({
      totalDialed: acc.totalDialed + stat.totalDialed,
      answered: acc.answered + stat.answered,
      connected: acc.connected + stat.connected,
      successful: acc.successful + stat.successful,
      failed: acc.failed + stat.failed,
      noAnswer: acc.noAnswer + stat.noAnswer,
      busy: acc.busy + stat.busy,
      voicemail: acc.voicemail + stat.voicemail,
      totalDuration: acc.totalDuration + (stat.avgDuration * stat.answered),
      totalCost: acc.totalCost + stat.totalCost,
      batchCount: acc.batchCount + 1,
    }), {
      totalDialed: 0,
      answered: 0,
      connected: 0,
      successful: 0,
      failed: 0,
      noAnswer: 0,
      busy: 0,
      voicemail: 0,
      totalDuration: 0,
      totalCost: 0,
      batchCount: 0,
    });
  }, [batchStats]);

  const overviewStats: BatchStats | null = useMemo(() => {
    if (!aggregateStats) return null;
    return {
      batch: {} as Batch,
      executions: [],
      ...aggregateStats,
      avgDuration: aggregateStats.answered > 0 
        ? aggregateStats.totalDuration / aggregateStats.answered 
        : 0,
      answerRate: aggregateStats.totalDialed > 0 
        ? (aggregateStats.answered / aggregateStats.totalDialed) * 100 
        : 0,
      connectRate: aggregateStats.answered > 0 
        ? (aggregateStats.connected / aggregateStats.answered) * 100 
        : 0,
      successRate: aggregateStats.connected > 0 
        ? (aggregateStats.successful / aggregateStats.connected) * 100 
        : 0,
    };
  }, [aggregateStats]);

  // Trend data for charts
  const trendData = useMemo(() => {
    if (!batchStats) return [];
    return batchStats.map(stat => ({
      name: format(new Date(stat.batch.created_at), "MMM d"),
      batchId: stat.batch.batch_id.slice(0, 8),
      answerRate: Math.round(stat.answerRate),
      connectRate: Math.round(stat.connectRate),
      successRate: Math.round(stat.successRate),
      dialed: stat.totalDialed,
      connected: stat.connected,
    })).reverse();
  }, [batchStats]);

  const isLoading = batchesLoading || statsLoading;

  return (
    <DashboardLayout role={role === "admin" ? "admin" : "client"}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Batch Call Analytics</h1>
            <p className="text-muted-foreground">
              Track performance metrics across your batch calling campaigns.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.agent_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Executed Batches</SelectItem>
              {allBatches?.filter(b => b.status === "executed").map((batch) => (
                <SelectItem key={batch.batch_id} value={batch.batch_id}>
                  {batch.batch_id.slice(0, 12)}... ({format(new Date(batch.created_at), "MMM d")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !overviewStats || aggregateStats?.batchCount === 0 ? (
          <Card className="border-2">
            <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4" />
              <h3 className="font-medium text-lg mb-1">No executed batches yet</h3>
              <p className="text-sm">Execute a batch to see analytics here</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Dialed"
                value={aggregateStats?.totalDialed || 0}
                subtitle={`${aggregateStats?.batchCount} batch(es)`}
                icon={Phone}
                color="primary"
              />
              <StatCard
                title="Answered"
                value={aggregateStats?.answered || 0}
                subtitle={`${Math.round(overviewStats.answerRate)}% answer rate`}
                icon={PhoneCall}
                color="success"
              />
              <StatCard
                title="Connected (>45s)"
                value={aggregateStats?.connected || 0}
                subtitle={`${Math.round(overviewStats.connectRate)}% of answered`}
                icon={CheckCircle}
                color="success"
              />
              <StatCard
                title="Successful"
                value={aggregateStats?.successful || 0}
                subtitle={`${Math.round(overviewStats.successRate)}% success rate`}
                icon={Target}
                color="success"
              />
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border-2">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 border border-destructive/20">
                    <PhoneOff className="h-4 w-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-xl font-bold">{aggregateStats?.failed || 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 border border-yellow-500/20">
                    <PhoneMissed className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">No Answer</p>
                    <p className="text-xl font-bold">{aggregateStats?.noAnswer || 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 border border-orange-500/20">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Busy</p>
                    <p className="text-xl font-bold">{aggregateStats?.busy || 0}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-muted border border-border">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-xl font-bold">{Math.round(overviewStats.avgDuration)}s</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/10 border border-primary/20">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                    <p className="text-xl font-bold">${(aggregateStats?.totalCost || 0).toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Funnel Chart */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Conversion Funnel
                  </CardTitle>
                  <CardDescription>
                    Call progression from dialed to successful
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FunnelChart stats={overviewStats} />
                </CardContent>
              </Card>

              {/* Status Breakdown */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Call Status Breakdown
                  </CardTitle>
                  <CardDescription>
                    Distribution of call outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StatusBreakdownChart stats={overviewStats} />
                </CardContent>
              </Card>
            </div>

            {/* Trend Chart */}
            {trendData.length > 1 && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Performance Trends
                  </CardTitle>
                  <CardDescription>
                    Conversion rates across batches
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={trendData}>
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip 
                        formatter={(value: number) => `${value}%`}
                        labelFormatter={(label) => `Batch: ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="answerRate" 
                        name="Answer Rate"
                        stroke={COLORS.answered} 
                        fill={COLORS.answered}
                        fillOpacity={0.3}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="connectRate" 
                        name="Connect Rate"
                        stroke={COLORS.connected} 
                        fill={COLORS.connected}
                        fillOpacity={0.3}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="successRate" 
                        name="Success Rate"
                        stroke={COLORS.successful} 
                        fill={COLORS.successful}
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Batch Details Table */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Batch Performance Details
                </CardTitle>
                <CardDescription>
                  Individual batch statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Dialed</TableHead>
                        <TableHead className="text-right">Answered</TableHead>
                        <TableHead className="text-right">Connected</TableHead>
                        <TableHead className="text-right">Successful</TableHead>
                        <TableHead className="text-right">Answer %</TableHead>
                        <TableHead className="text-right">Connect %</TableHead>
                        <TableHead className="text-right">Success %</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchStats?.map((stat) => (
                        <TableRow key={stat.batch.batch_id}>
                          <TableCell className="font-mono text-sm">
                            {stat.batch.batch_id.slice(0, 12)}...
                          </TableCell>
                          <TableCell>
                            {format(new Date(stat.batch.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {stat.totalDialed}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.answered}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.connected}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={stat.successful > 0 ? "default" : "outline"}>
                              {stat.successful}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={stat.answerRate >= 50 ? "default" : "secondary"}
                              className={stat.answerRate >= 50 ? "bg-green-600" : ""}
                            >
                              {Math.round(stat.answerRate)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={stat.connectRate >= 50 ? "default" : "secondary"}
                              className={stat.connectRate >= 50 ? "bg-green-600" : ""}
                            >
                              {Math.round(stat.connectRate)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge 
                              variant={stat.successRate >= 50 ? "default" : "secondary"}
                              className={stat.successRate >= 50 ? "bg-primary" : ""}
                            >
                              {Math.round(stat.successRate)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            ${stat.totalCost.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
