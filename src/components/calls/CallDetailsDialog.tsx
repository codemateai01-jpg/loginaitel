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
  PhoneIncoming,
  PhoneOutgoing,
  Download,
  Voicemail,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Slider } from "@/components/ui/slider";
import { getExecution, downloadRecording } from "@/lib/aitel";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Call {
  id: string;
  agent_id: string;
  status: string;
  duration_seconds: number | null;
  connected: boolean | null;
  created_at: string;
  transcript: string | null;
  recording_url: string | null;
  summary?: string | null;
  external_call_id?: string | null;
  phone_number?: string;
  agent_name?: string;
  call_type?: "inbound" | "outbound" | null;
}

interface CallDetailsDialogProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidePhoneNumber?: boolean;
}

export function CallDetailsDialog({
  call,
  open,
  onOpenChange,
  hidePhoneNumber = false,
}: CallDetailsDialogProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Fetch execution details from Bolna if we have external_call_id
  const { data: execution } = useQuery({
    queryKey: ["execution", call?.external_call_id],
    enabled: !!call?.external_call_id && open,
    queryFn: async () => {
      const response = await getExecution(call!.external_call_id!);
      if (response.error) throw new Error(response.error);
      return response.data;
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

  // Get summary from execution or call
  const callSummary = execution?.summary || call.summary;

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

  const handleDownloadRecording = async () => {
    if (recordingUrl) {
      try {
        const callId = call.external_call_id || call.id;
        await downloadRecording(recordingUrl, `call-${callId}.mp3`);
        toast({
          title: "Download started",
          description: "Your recording is being downloaded.",
        });
      } catch (error) {
        toast({
          title: "Download failed",
          description: "Failed to download recording. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  // Helper to mask phone numbers
  const maskPhone = (phone: string | undefined | null) => {
    if (!phone) return "—";
    if (phone.length <= 4) return "****";
    return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
  };

  // Generate short call ID for admin reference
  const shortCallId = call.id.slice(0, 8);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Details
            {getStatusBadge(execution?.status || call.status)}
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              ID: #{shortCallId}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 border-2 border-border">
          {!hidePhoneNumber && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium text-sm font-mono">{call.phone_number || "—"}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Agent</p>
              <p className="font-medium text-sm">{call.agent_name || "—"}</p>
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
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{call.connected || execution.status === "completed" ? "Connected" : "Not Connected"}</span>
            </div>
            
            {(execution.telephony_data?.call_type || call.call_type) && (
              <div className="flex items-center gap-2">
                {(execution.telephony_data?.call_type || call.call_type) === "outbound" ? (
                  <PhoneOutgoing className="h-4 w-4 text-chart-2" />
                ) : (
                  <PhoneIncoming className="h-4 w-4 text-chart-1" />
                )}
                <span className="capitalize">{execution.telephony_data?.call_type || call.call_type}</span>
              </div>
            )}

            {execution.answered_by_voice_mail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Voicemail className="h-4 w-4" />
                <span>Voicemail</span>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {execution?.error_message && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border-2 border-destructive text-destructive text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{execution.error_message}</span>
          </div>
        )}

        {/* Tabs - Only Transcript, Recording, Summary */}
        <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0">
          <TabsList className="border-2 border-border bg-card p-1 flex-wrap h-auto gap-1">
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
                    <Button variant="outline" size="icon" onClick={handleDownloadRecording}>
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

                  {/* Waveform placeholder */}
                  <div className="h-16 bg-muted/50 border border-border flex items-center justify-center gap-1">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1 bg-primary/40 transition-all",
                          isPlaying && "animate-pulse"
                        )}
                        style={{
                          height: `${Math.random() * 100}%`,
                          animationDelay: `${i * 50}ms`,
                        }}
                      />
                    ))}
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

          {/* Summary Tab */}
          <TabsContent value="summary" className="flex-1">
            <ScrollArea className="h-[300px] border-2 border-border p-4">
              <div className="space-y-6">
                {/* Call Summary */}
                {callSummary ? (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Call Summary
                    </h4>
                    <div className="p-4 bg-muted/50 border-2 border-border">
                      <p className="text-sm leading-relaxed">{callSummary}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                    <p>No summary available</p>
                    <p className="text-xs mt-1">Summary will appear here if summarization is enabled for the agent</p>
                  </div>
                )}

                {/* Extracted Data */}
                {execution?.extracted_data && Object.keys(execution.extracted_data).length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Extracted Data</h4>
                    <div className="p-4 bg-muted/50 border-2 border-border">
                      <div className="space-y-2">
                        {Object.entries(execution.extracted_data).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Telephony Details */}
                {execution?.telephony_data && (
                  <div>
                    <h4 className="font-medium mb-3">Call Details</h4>
                    <div className="p-4 bg-muted/50 border-2 border-border space-y-2 text-sm">
                      {execution.telephony_data.from_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">From</span>
                          <span className="font-mono">
                            {hidePhoneNumber ? maskPhone(execution.telephony_data.from_number) : execution.telephony_data.from_number}
                          </span>
                        </div>
                      )}
                      {execution.telephony_data.to_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">To</span>
                          <span className="font-mono">
                            {hidePhoneNumber ? maskPhone(execution.telephony_data.to_number) : execution.telephony_data.to_number}
                          </span>
                        </div>
                      )}
                      {execution.telephony_data.hangup_reason && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hangup Reason</span>
                          <span>{execution.telephony_data.hangup_reason}</span>
                        </div>
                      )}
                      {execution.telephony_data.hangup_by && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hangup By</span>
                          <span>{execution.telephony_data.hangup_by}</span>
                        </div>
                      )}
                    </div>
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