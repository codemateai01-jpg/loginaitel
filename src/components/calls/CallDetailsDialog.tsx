import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  FileText,
  Play,
  Pause,
  Volume2,
  Clock,
  User,
  Bot,
  Calendar,
  CheckCircle,
  XCircle,
  MessageSquare,
  TrendingUp,
  ListOrdered,
  DollarSign,
  PhoneIncoming,
  PhoneOutgoing,
  Download,
  RefreshCw,
  AlertCircle,
  Voicemail,
} from "lucide-react";
import { format } from "date-fns";
import { Slider } from "@/components/ui/slider";
import { getExecution, getExecutionLogs, CallExecution, ExecutionLogEntry } from "@/lib/bolna";

interface Call {
  id: string;
  lead_id: string;
  agent_id: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  sentiment: string | null;
  metadata: unknown;
  external_call_id?: string | null;
  lead?: {
    name: string | null;
    phone_number: string;
  };
  agent?: {
    name: string;
  };
}

interface CallDetailsDialogProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallDetailsDialog({
  call,
  open,
  onOpenChange,
}: CallDetailsDialogProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch execution details from Bolna if we have external_call_id
  const { data: execution, isLoading: executionLoading } = useQuery({
    queryKey: ["execution", call?.external_call_id],
    enabled: !!call?.external_call_id && open,
    queryFn: async () => {
      const response = await getExecution(call!.external_call_id!);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
  });

  // Fetch execution logs from Bolna
  const { data: executionLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["execution-logs", call?.external_call_id],
    enabled: !!call?.external_call_id && open,
    queryFn: async () => {
      const response = await getExecutionLogs(call!.external_call_id!);
      if (response.error) throw new Error(response.error);
      return response.data?.data || [];
    },
  });

  // Reset audio state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [open]);

  if (!call) return null;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive":
        return "text-chart-2";
      case "negative":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      completed: { variant: "default", label: "Completed" },
      "call-disconnected": { variant: "secondary", label: "Disconnected" },
      "no-answer": { variant: "outline", label: "No Answer" },
      busy: { variant: "outline", label: "Busy" },
      failed: { variant: "destructive", label: "Failed" },
      "in-progress": { variant: "secondary", label: "In Progress" },
      canceled: { variant: "outline", label: "Canceled" },
      "balance-low": { variant: "destructive", label: "Balance Low" },
      queued: { variant: "outline", label: "Queued" },
      ringing: { variant: "secondary", label: "Ringing" },
      initiated: { variant: "secondary", label: "Initiated" },
      stopped: { variant: "outline", label: "Stopped" },
    };
    const config = statusMap[status] || { variant: "outline", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get recording URL from execution or call
  const recordingUrl = execution?.telephony_data?.recording_url || call.recording_url;

  // Parse transcript into messages
  const parseTranscript = (transcript: string | null) => {
    if (!transcript) return [];
    
    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not JSON
    }

    const lines = transcript.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      const match = line.match(/^(Agent|User|Lead|Bot|Assistant|Human):\s*(.*)$/i);
      if (match) {
        return { role: match[1].toLowerCase(), content: match[2] };
      }
      return { role: "unknown", content: line };
    });
  };

  // Use execution transcript if available, otherwise fall back to call transcript
  const transcriptSource = execution?.transcript || call.transcript;
  const transcriptMessages = parseTranscript(transcriptSource);

  const downloadRecording = () => {
    if (recordingUrl) {
      window.open(recordingUrl, "_blank");
    }
  };

  const getComponentIcon = (component: string) => {
    switch (component.toLowerCase()) {
      case "llm":
        return <Bot className="h-3 w-3" />;
      case "synthesizer":
        return <Volume2 className="h-3 w-3" />;
      case "transcriber":
        return <FileText className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Details
            {execution && getStatusBadge(execution.status)}
          </DialogTitle>
        </DialogHeader>

        {/* Call Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 border-2 border-border">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Lead</p>
              <p className="font-medium text-sm">{call.lead?.name || "Unknown"}</p>
              <p className="text-xs text-muted-foreground font-mono">{call.lead?.phone_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Agent</p>
              <p className="font-medium text-sm">{call.agent?.name || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Duration</p>
              <p className="font-medium text-sm font-mono">
                {execution?.conversation_time 
                  ? formatDuration(execution.conversation_time) 
                  : formatDuration(call.duration_seconds)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium text-sm">
                {format(new Date(call.created_at), "MMM d, HH:mm")}
              </p>
            </div>
          </div>
        </div>

        {/* Execution Details */}
        {execution && (
          <div className="flex flex-wrap gap-4 items-center text-sm">
            <div className="flex items-center gap-2">
              {call.connected || execution.status === "completed" ? (
                <CheckCircle className="h-4 w-4 text-chart-2" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{call.connected || execution.status === "completed" ? "Connected" : "Not Connected"}</span>
            </div>
            
            {execution.telephony_data?.call_type && (
              <div className="flex items-center gap-2">
                {execution.telephony_data.call_type === "outbound" ? (
                  <PhoneOutgoing className="h-4 w-4 text-chart-1" />
                ) : (
                  <PhoneIncoming className="h-4 w-4 text-chart-2" />
                )}
                <span className="capitalize">{execution.telephony_data.call_type}</span>
              </div>
            )}

            {execution.answered_by_voice_mail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Voicemail className="h-4 w-4" />
                <span>Voicemail</span>
              </div>
            )}

            {execution.total_cost !== undefined && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-chart-4" />
                <span>${execution.total_cost.toFixed(4)}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${getSentimentColor(call.sentiment)}`} />
              <span className={`capitalize ${getSentimentColor(call.sentiment)}`}>
                {call.sentiment || "Neutral"}
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {execution?.error_message && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border-2 border-destructive text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{execution.error_message}</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0">
          <TabsList className="border-2 border-border bg-card p-1">
            <TabsTrigger
              value="transcript"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <FileText className="h-4 w-4" />
              Transcript
            </TabsTrigger>
            <TabsTrigger
              value="recording"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              disabled={!recordingUrl}
            >
              <Volume2 className="h-4 w-4" />
              Recording
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              disabled={!call.external_call_id}
            >
              <ListOrdered className="h-4 w-4" />
              Logs
              {logsLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="flex-1 min-h-0">
            <ScrollArea className="h-[300px] border-2 border-border p-4">
              {transcriptMessages.length > 0 ? (
                <div className="space-y-4">
                  {transcriptMessages.map((message, index) => {
                    const isAgent = ["agent", "bot", "assistant"].includes(message.role);
                    return (
                      <div
                        key={index}
                        className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}
                      >
                        <div
                          className={`w-8 h-8 flex items-center justify-center border-2 shrink-0 ${
                            isAgent
                              ? "bg-chart-1/10 border-chart-1"
                              : "bg-chart-2/10 border-chart-2"
                          }`}
                        >
                          {isAgent ? (
                            <Bot className="h-4 w-4 text-chart-1" />
                          ) : (
                            <User className="h-4 w-4 text-chart-2" />
                          )}
                        </div>
                        <div
                          className={`flex-1 p-3 border-2 border-border ${
                            isAgent ? "bg-muted/50" : "bg-card"
                          }`}
                        >
                          <p className="text-xs text-muted-foreground mb-1 capitalize">
                            {isAgent ? "Agent" : "Lead"}
                          </p>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2" />
                  <p>No transcript available</p>
                  <p className="text-xs">Transcript will appear here after processing</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Recording Tab */}
          <TabsContent value="recording" className="flex-1">
            <div className="border-2 border-border p-6 space-y-6">
              {recordingUrl ? (
                <>
                  <audio
                    ref={audioRef}
                    src={recordingUrl}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  <div className="flex items-center justify-center gap-4">
                    <Button
                      size="lg"
                      onClick={handlePlayPause}
                      className="w-14 h-14 rounded-full"
                    >
                      {isPlaying ? (
                        <Pause className="h-6 w-6" />
                      ) : (
                        <Play className="h-6 w-6 ml-1" />
                      )}
                    </Button>
                    <Button variant="outline" size="icon" onClick={downloadRecording}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={1}
                      onValueChange={handleSeek}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(duration)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
                  <Volume2 className="h-8 w-8 mb-2" />
                  <p>No recording available</p>
                  <p className="text-xs">Recording will appear here when available</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="flex-1 min-h-0">
            <ScrollArea className="h-[300px] border-2 border-border">
              {logsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : executionLogs && executionLogs.length > 0 ? (
                <div className="divide-y divide-border">
                  {executionLogs.map((log, index) => (
                    <div key={index} className="p-3 hover:bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={log.type === "request" ? "outline" : "secondary"} className="text-xs">
                          {log.type}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getComponentIcon(log.component)}
                          <span className="capitalize">{log.component}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {log.provider}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(log.created_at), "HH:mm:ss.SSS")}
                        </span>
                      </div>
                      <pre className="text-xs bg-muted/50 p-2 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                        {log.data.length > 500 ? `${log.data.slice(0, 500)}...` : log.data}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <ListOrdered className="h-8 w-8 mb-2" />
                  <p>No execution logs available</p>
                  <p className="text-xs">Logs will appear for calls with external IDs</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="flex-1">
            <ScrollArea className="h-[300px] border-2 border-border p-4">
              <div className="space-y-6">
                {/* Call Summary */}
                {call.summary ? (
                  <div>
                    <h4 className="font-medium mb-2">Call Summary</h4>
                    <p className="text-sm text-muted-foreground">{call.summary}</p>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                    <p>No summary available</p>
                  </div>
                )}
                
                {/* Sentiment */}
                {call.sentiment && (
                  <div>
                    <h4 className="font-medium mb-2">Sentiment Analysis</h4>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          call.sentiment === "positive"
                            ? "bg-chart-2"
                            : call.sentiment === "negative"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <span className="text-sm capitalize">{call.sentiment}</span>
                    </div>
                  </div>
                )}

                {/* Cost Breakdown */}
                {execution?.cost_breakdown && Object.keys(execution.cost_breakdown).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Cost Breakdown</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(execution.cost_breakdown).map(([key, value]) => (
                        <div key={key} className="flex justify-between p-2 bg-muted/50 border border-border">
                          <span className="text-sm capitalize">{key}</span>
                          <span className="text-sm font-mono">${(value || 0).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between p-2 mt-2 bg-primary/10 border-2 border-primary">
                      <span className="font-medium">Total</span>
                      <span className="font-mono font-medium">${(execution.total_cost || 0).toFixed(4)}</span>
                    </div>
                  </div>
                )}

                {/* Telephony Details */}
                {execution?.telephony_data && (
                  <div>
                    <h4 className="font-medium mb-2">Telephony Details</h4>
                    <div className="space-y-1 text-sm">
                      {execution.telephony_data.from_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">From</span>
                          <span className="font-mono">{execution.telephony_data.from_number}</span>
                        </div>
                      )}
                      {execution.telephony_data.to_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">To</span>
                          <span className="font-mono">{execution.telephony_data.to_number}</span>
                        </div>
                      )}
                      {execution.telephony_data.provider && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Provider</span>
                          <span className="capitalize">{execution.telephony_data.provider}</span>
                        </div>
                      )}
                      {execution.telephony_data.hangup_reason && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hangup Reason</span>
                          <span>{execution.telephony_data.hangup_reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Extracted Data */}
                {execution?.extracted_data && Object.keys(execution.extracted_data).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Extracted Data</h4>
                    <pre className="text-xs bg-muted/50 p-3 border border-border overflow-x-auto font-mono">
                      {JSON.stringify(execution.extracted_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t-2 border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
