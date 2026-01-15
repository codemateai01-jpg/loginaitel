import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Clock, CheckCircle, XCircle, PhoneOff, Loader2, Play } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface Lead {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  source: string | null;
  stage: string;
  interest_score: number | null;
  last_call_at: string | null;
  last_call_summary: string | null;
  created_at: string;
  projects?: { name: string } | null;
}

interface CallHistoryItem {
  id: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  summary: string | null;
  sentiment: string | null;
  recording_url: string | null;
  real_estate_calls?: {
    disposition: string | null;
    interest_score: number | null;
    ai_summary: string | null;
  }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onUpdate: () => void;
}

const stageColors: Record<string, string> = {
  new: "bg-gray-500",
  contacted: "bg-blue-500",
  interested: "bg-green-500",
  site_visit_done: "bg-purple-500",
  negotiation: "bg-orange-500",
  token_paid: "bg-yellow-500",
  closed: "bg-emerald-600",
  lost: "bg-red-500",
};

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  completed: { icon: CheckCircle, color: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-500", label: "Failed" },
  in_progress: { icon: Loader2, color: "text-blue-500", label: "In Progress" },
  initiated: { icon: Phone, color: "text-yellow-500", label: "Initiated" },
  no_answer: { icon: PhoneOff, color: "text-gray-500", label: "No Answer" },
};

export function RELeadDetailsDialog({ open, onOpenChange, lead }: Props) {
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);

  useEffect(() => {
    if (open && lead?.id) {
      fetchCallHistory();
    }
  }, [open, lead?.id]);

  const fetchCallHistory = async () => {
    setLoadingCalls(true);
    try {
      const { data, error } = await supabase
        .from("calls")
        .select(`
          id,
          status,
          duration_seconds,
          connected,
          started_at,
          ended_at,
          created_at,
          summary,
          sentiment,
          recording_url,
          real_estate_calls (
            disposition,
            interest_score,
            ai_summary
          )
        `)
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCallHistory(data || []);
    } catch (error) {
      console.error("Error fetching call history:", error);
    } finally {
      setLoadingCalls(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { icon: Phone, color: "text-muted-foreground", label: status };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{lead.name || "Lead Details"}</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(85vh-100px)]">
          <div className="space-y-6 pr-4">
            {/* Lead Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-mono">{lead.phone_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p>{lead.email || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <Badge variant="outline">{lead.source || "Unknown"}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stage</p>
                <Badge className={stageColors[lead.stage] || "bg-gray-500"}>
                  {lead.stage.replace("_", " ")}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Project</p>
                <p>{lead.projects?.name || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interest Score</p>
                <p>{lead.interest_score !== null ? `${lead.interest_score}%` : "—"}</p>
              </div>
            </div>

            {lead.last_call_summary && (
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Last Call Summary</p>
                <p className="text-sm">{lead.last_call_summary}</p>
                {lead.last_call_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(lead.last_call_at), "PPP 'at' p")}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Call History Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Phone className="h-4 w-4" />
                <h3 className="font-semibold">Call History</h3>
                <Badge variant="secondary" className="ml-auto">
                  {callHistory.length} call{callHistory.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              {loadingCalls ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : callHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No calls yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {callHistory.map((call) => {
                    const config = getStatusConfig(call.status);
                    const StatusIcon = config.icon;
                    const reCall = call.real_estate_calls?.[0];

                    return (
                      <div
                        key={call.id}
                        className="p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${config.color}`}>
                            <StatusIcon className={`h-5 w-5 ${call.status === 'in_progress' ? 'animate-spin' : ''}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{config.label}</span>
                              {call.connected && (
                                <Badge variant="outline" className="text-xs">Connected</Badge>
                              )}
                              {call.sentiment && call.sentiment !== 'neutral' && (
                                <Badge 
                                  variant={call.sentiment === 'positive' ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {call.sentiment}
                                </Badge>
                              )}
                              {reCall?.interest_score !== null && reCall?.interest_score !== undefined && (
                                <Badge variant="secondary" className="text-xs">
                                  Interest: {reCall.interest_score}%
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(call.duration_seconds)}
                              </span>
                              <span>
                                {call.started_at 
                                  ? format(new Date(call.started_at), "MMM d, h:mm a")
                                  : format(new Date(call.created_at), "MMM d, h:mm a")
                                }
                              </span>
                              {call.recording_url && (
                                <a 
                                  href={call.recording_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Play className="h-3 w-3" />
                                  Recording
                                </a>
                              )}
                            </div>

                            {(reCall?.ai_summary || call.summary) && (
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {reCall?.ai_summary || call.summary}
                              </p>
                            )}

                            {reCall?.disposition && (
                              <Badge variant="outline" className="mt-2 text-xs capitalize">
                                {reCall.disposition.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Created: {format(new Date(lead.created_at), "PPP")}
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
