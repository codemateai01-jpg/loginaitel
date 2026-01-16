import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Users,
  TrendingUp,
  Timer,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface CampaignProgressDashboardProps {
  campaignId: string;
  totalLeads: number;
}

interface QueueItem {
  id: string;
  lead_id: string;
  status: string;
  retry_count: number;
  next_retry_at: string | null;
  last_attempt_at: string | null;
  created_at: string;
  lead?: {
    name: string;
    phone_number: string;
  };
}

const statusConfig: Record<string, { label: string; icon: typeof Phone; className: string }> = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "Calling",
    icon: PhoneCall,
    className: "bg-primary/10 text-primary animate-pulse",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    className: "bg-chart-2/10 text-chart-2",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive",
  },
  retry_scheduled: {
    label: "Retry Scheduled",
    icon: RefreshCw,
    className: "bg-chart-4/10 text-chart-4",
  },
};

export function CampaignProgressDashboard({ campaignId, totalLeads }: CampaignProgressDashboardProps) {
  // Fetch call queue with real-time updates
  const { data: queueData, isLoading } = useQuery({
    queryKey: ["campaign-queue-progress", campaignId],
    refetchInterval: 3000, // Refresh every 3 seconds
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_call_queue")
        .select(`
          id,
          lead_id,
          status,
          retry_count,
          next_retry_at,
          last_attempt_at,
          created_at,
          campaign_leads!campaign_call_queue_lead_id_fkey (
            name,
            phone_number
          )
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((item) => ({
        ...item,
        lead: item.campaign_leads as { name: string; phone_number: string } | undefined,
      })) as QueueItem[];
    },
  });

  // Calculate queue statistics
  const stats = useMemo(() => {
    if (!queueData) return {
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      retryScheduled: 0,
      total: 0,
      progressPercent: 0,
      estimatedTime: null as string | null,
    };

    const pending = queueData.filter((q) => q.status === "pending").length;
    const inProgress = queueData.filter((q) => q.status === "in_progress").length;
    const completed = queueData.filter((q) => q.status === "completed").length;
    const failed = queueData.filter((q) => q.status === "failed").length;
    const retryScheduled = queueData.filter((q) => q.status === "retry_scheduled").length;
    const total = queueData.length;
    
    const processed = completed + failed;
    const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

    // Estimate remaining time based on average processing rate
    let estimatedTime: string | null = null;
    if (processed > 0 && (pending + inProgress + retryScheduled) > 0) {
      const completedItems = queueData.filter((q) => q.status === "completed" && q.last_attempt_at);
      if (completedItems.length >= 2) {
        const firstCompleted = new Date(completedItems[0].last_attempt_at!).getTime();
        const lastCompleted = new Date(completedItems[completedItems.length - 1].last_attempt_at!).getTime();
        const avgTimePerCall = (lastCompleted - firstCompleted) / (completedItems.length - 1);
        const remaining = pending + inProgress + retryScheduled;
        const estimatedMs = remaining * avgTimePerCall;
        const estimatedMins = Math.ceil(estimatedMs / 60000);
        estimatedTime = estimatedMins > 60 
          ? `~${Math.round(estimatedMins / 60)}h ${estimatedMins % 60}m`
          : `~${estimatedMins}m`;
      }
    }

    return { pending, inProgress, completed, failed, retryScheduled, total, progressPercent, estimatedTime };
  }, [queueData]);

  // Get active/recent queue items for display
  const activeQueue = useMemo(() => {
    if (!queueData) return [];
    // Show in_progress first, then pending, then retry_scheduled
    return queueData
      .filter((q) => ["in_progress", "pending", "retry_scheduled"].includes(q.status))
      .sort((a, b) => {
        const order = { in_progress: 0, pending: 1, retry_scheduled: 2 };
        return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
      })
      .slice(0, 10);
  }, [queueData]);

  if (isLoading) {
    return (
      <div className="border-2 border-border bg-card p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!queueData || queueData.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-6 text-center">
        <Phone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No calls in queue</p>
        <p className="text-xs text-muted-foreground mt-1">Start a bulk call to see progress here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <div className="border-2 border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Campaign Progress</h3>
          </div>
          {stats.estimatedTime && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              <span>{stats.estimatedTime} remaining</span>
            </div>
          )}
        </div>

        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {stats.completed + stats.failed} of {stats.total} processed
            </span>
            <span className="font-medium">{stats.progressPercent}%</span>
          </div>
          <Progress value={stats.progressPercent} className="h-3" />
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-5 gap-2">
          <div className="text-center p-2 border border-border rounded-md">
            <p className="text-lg font-bold text-muted-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className={`text-center p-2 border border-primary/30 rounded-md ${stats.inProgress > 0 ? "bg-primary/5 animate-pulse" : ""}`}>
            <p className="text-lg font-bold text-primary">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="text-center p-2 border border-chart-2/30 rounded-md bg-chart-2/5">
            <p className="text-lg font-bold text-chart-2">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center p-2 border border-chart-4/30 rounded-md bg-chart-4/5">
            <p className="text-lg font-bold text-chart-4">{stats.retryScheduled}</p>
            <p className="text-xs text-muted-foreground">Retry</p>
          </div>
          <div className="text-center p-2 border border-destructive/30 rounded-md bg-destructive/5">
            <p className="text-lg font-bold text-destructive">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
      </div>

      {/* Visual Call Queue */}
      <div className="border-2 border-border bg-card">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium text-sm">Live Call Queue</h4>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeQueue.length} in queue
          </Badge>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {activeQueue.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Queue is empty
              </div>
            ) : (
              activeQueue.map((item, index) => {
                const config = statusConfig[item.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-md border ${
                      item.status === "in_progress" ? "border-primary/30 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.lead?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {item.lead?.phone_number || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.retry_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Retry #{item.retry_count}
                        </span>
                      )}
                      <Badge className={`text-xs ${config.className}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                    {item.next_retry_at && item.status === "retry_scheduled" && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.next_retry_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
