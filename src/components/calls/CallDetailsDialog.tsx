import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  PhoneIncoming,
  PhoneOutgoing,
  Download,
  RefreshCw,
  AlertCircle,
  Voicemail,
  Star,
  ThumbsUp,
  ThumbsDown,
  Target,
  Mic,
  Zap,
  Save,
  Loader2,
  Sparkles,
  Lightbulb,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { Slider } from "@/components/ui/slider";
import { getExecution, getExecutionLogs, downloadRecording, CallExecution, ExecutionLogEntry } from "@/lib/aitel";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface CallEvaluation {
  overall_score: number;
  greeting_score: number;
  objection_handling: number;
  closing_score: number;
  clarity_score: number;
  engagement_score: number;
  goal_achieved: boolean;
  notes: string;
  ai_generated?: boolean;
  key_moments?: string[];
  improvement_suggestions?: string[];
  evaluated_at?: string;
}

interface CallDetailsDialogProps {
  call: Call | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EVALUATION_CRITERIA = [
  { key: "greeting_score", label: "Opening/Greeting", icon: Mic, description: "How well did the agent introduce themselves and set the tone?" },
  { key: "clarity_score", label: "Clarity & Communication", icon: MessageSquare, description: "Was the agent clear and easy to understand?" },
  { key: "engagement_score", label: "Engagement", icon: Zap, description: "Did the agent keep the lead engaged throughout?" },
  { key: "objection_handling", label: "Objection Handling", icon: Target, description: "How well were objections addressed?" },
  { key: "closing_score", label: "Closing", icon: CheckCircle, description: "Was there a clear call-to-action or next step?" },
];

function ScoreSlider({ 
  value, 
  onChange, 
  label, 
  description, 
  icon: Icon 
}: { 
  value: number; 
  onChange: (v: number) => void; 
  label: string; 
  description: string;
  icon: React.ElementType;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 5) return "text-yellow-600";
    return "text-destructive";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 9) return "Excellent";
    if (score >= 7) return "Good";
    if (score >= 5) return "Average";
    if (score >= 3) return "Poor";
    return "Very Poor";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-bold", getScoreColor(value))}>{value}</span>
          <span className="text-xs text-muted-foreground">/ 10</span>
        </div>
      </div>
      <Slider
        value={[value]}
        max={10}
        min={1}
        step={1}
        onValueChange={(v) => onChange(v[0])}
        className="w-full"
      />
      <div className="flex justify-between">
        <p className="text-xs text-muted-foreground">{description}</p>
        <Badge variant="outline" className={cn("text-xs", getScoreColor(value))}>
          {getScoreLabel(value)}
        </Badge>
      </div>
    </div>
  );
}

function OverallScoreDisplay({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return { bg: "bg-green-500", text: "text-green-600", label: "Excellent" };
    if (s >= 60) return { bg: "bg-yellow-500", text: "text-yellow-600", label: "Good" };
    if (s >= 40) return { bg: "bg-orange-500", text: "text-orange-600", label: "Average" };
    return { bg: "bg-destructive", text: "text-destructive", label: "Needs Improvement" };
  };

  const config = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-3 p-6 bg-muted/50 border-2 border-border">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-muted"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${(score / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            className={config.text}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-2xl font-bold", config.text)}>{score}%</span>
        </div>
      </div>
      <Badge className={cn(config.bg, "text-white")}>{config.label}</Badge>
    </div>
  );
}

export function CallDetailsDialog({
  call,
  open,
  onOpenChange,
}: CallDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Evaluation state
  const [evaluation, setEvaluation] = useState<CallEvaluation>({
    overall_score: 70,
    greeting_score: 7,
    objection_handling: 7,
    closing_score: 7,
    clarity_score: 7,
    engagement_score: 7,
    goal_achieved: false,
    notes: "",
  });

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

  // Load existing evaluation from metadata
  useEffect(() => {
    if (call?.metadata && typeof call.metadata === 'object') {
      const meta = call.metadata as Record<string, unknown>;
      if (meta.evaluation) {
        setEvaluation(meta.evaluation as CallEvaluation);
      }
    }
  }, [call]);

  // Calculate overall score when criteria change
  useEffect(() => {
    const scores = [
      evaluation.greeting_score,
      evaluation.clarity_score,
      evaluation.engagement_score,
      evaluation.objection_handling,
      evaluation.closing_score,
    ];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const overall = Math.round(avg * 10);
    setEvaluation(prev => ({ ...prev, overall_score: overall }));
  }, [
    evaluation.greeting_score,
    evaluation.clarity_score,
    evaluation.engagement_score,
    evaluation.objection_handling,
    evaluation.closing_score,
  ]);

  // Save evaluation mutation
  const saveEvaluation = useMutation({
    mutationFn: async () => {
      if (!call) return;
      
      const currentMetadata = (call.metadata as Record<string, unknown>) || {};
      const evaluationData = {
        overall_score: evaluation.overall_score,
        greeting_score: evaluation.greeting_score,
        objection_handling: evaluation.objection_handling,
        closing_score: evaluation.closing_score,
        clarity_score: evaluation.clarity_score,
        engagement_score: evaluation.engagement_score,
        goal_achieved: evaluation.goal_achieved,
        notes: evaluation.notes,
        key_moments: evaluation.key_moments,
        improvement_suggestions: evaluation.improvement_suggestions,
        ai_generated: evaluation.ai_generated,
      };
      
      const { error } = await supabase
        .from("calls")
        .update({
          metadata: JSON.parse(JSON.stringify({
            ...currentMetadata,
            evaluation: evaluationData,
            evaluated_at: new Date().toISOString(),
          })),
        })
        .eq("id", call.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Evaluation Saved",
        description: "Call evaluation has been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["recent-calls"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save evaluation",
      });
    },
  });

  // AI Evaluation mutation
  const aiEvaluation = useMutation({
    mutationFn: async () => {
      if (!call) throw new Error("No call selected");
      
      const transcriptSource = execution?.transcript || call.transcript;
      if (!transcriptSource) {
        throw new Error("No transcript available for evaluation");
      }

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            callId: call.id,
            transcript: transcriptSource,
            agentName: call.agent?.name,
            leadName: call.lead?.name,
            callDuration: call.duration_seconds,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "AI evaluation failed");
      }

      const data = await response.json();
      return data.evaluation;
    },
    onSuccess: (evaluationResult) => {
      setEvaluation({
        ...evaluationResult,
        ai_generated: true,
      });
      toast({
        title: "AI Evaluation Complete",
        description: "Call has been analyzed and scored by AI",
      });
      queryClient.invalidateQueries({ queryKey: ["recent-calls"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "AI Evaluation Failed",
        description: error instanceof Error ? error.message : "Failed to analyze call",
      });
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
        return "text-green-600";
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

  const updateEvaluationScore = (key: string, value: number) => {
    setEvaluation(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{call.connected || execution.status === "completed" ? "Connected" : "Not Connected"}</span>
            </div>
            
            {execution.telephony_data?.call_type && (
              <div className="flex items-center gap-2">
                {execution.telephony_data.call_type === "outbound" ? (
                  <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                ) : (
                  <PhoneIncoming className="h-4 w-4 text-green-600" />
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
              value="evaluation"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Star className="h-4 w-4" />
              Evaluation
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
                              ? "bg-blue-500/10 border-blue-500"
                              : "bg-green-500/10 border-green-500"
                          }`}
                        >
                          {isAgent ? (
                            <Bot className="h-4 w-4 text-blue-600" />
                          ) : (
                            <User className="h-4 w-4 text-green-600" />
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

          {/* Evaluation Tab */}
          <TabsContent value="evaluation" className="flex-1 min-h-0">
            <ScrollArea className="h-[300px]">
              <div className="space-y-6 p-4">
                {/* AI Evaluation Button */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 border border-primary/20">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">AI-Powered Evaluation</h4>
                      <p className="text-xs text-muted-foreground">
                        Automatically analyze transcript and score the call
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => aiEvaluation.mutate()}
                    disabled={aiEvaluation.isPending || (!call?.transcript && !execution?.transcript)}
                    variant="default"
                    className="gap-2"
                  >
                    {aiEvaluation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Run AI Evaluation
                      </>
                    )}
                  </Button>
                </div>

                {/* AI Badge */}
                {evaluation.ai_generated && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                    {evaluation.evaluated_at && (
                      <span className="text-xs opacity-70">
                        • {format(new Date(evaluation.evaluated_at), "MMM d, HH:mm")}
                      </span>
                    )}
                  </Badge>
                )}

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Overall Score */}
                  <div className="lg:col-span-1">
                    <OverallScoreDisplay score={evaluation.overall_score} />
                    
                    {/* Goal Achievement */}
                    <div className="mt-4 p-4 border-2 border-border">
                      <Label className="text-sm font-medium mb-3 block">Goal Achieved?</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={evaluation.goal_achieved ? "default" : "outline"}
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => setEvaluation(prev => ({ ...prev, goal_achieved: true }))}
                        >
                          <ThumbsUp className="h-4 w-4" />
                          Yes
                        </Button>
                        <Button
                          variant={!evaluation.goal_achieved ? "destructive" : "outline"}
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={() => setEvaluation(prev => ({ ...prev, goal_achieved: false }))}
                        >
                          <ThumbsDown className="h-4 w-4" />
                          No
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Scoring Criteria */}
                  <div className="lg:col-span-2 space-y-6">
                    {EVALUATION_CRITERIA.map((criterion) => (
                      <ScoreSlider
                        key={criterion.key}
                        value={evaluation[criterion.key as keyof CallEvaluation] as number}
                        onChange={(v) => updateEvaluationScore(criterion.key, v)}
                        label={criterion.label}
                        description={criterion.description}
                        icon={criterion.icon}
                      />
                    ))}
                  </div>
                </div>

                {/* AI Insights Section */}
                {(evaluation.key_moments?.length || evaluation.improvement_suggestions?.length) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Key Moments */}
                    {evaluation.key_moments && evaluation.key_moments.length > 0 && (
                      <div className="p-4 border-2 border-border bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <Label className="font-medium">Key Moments</Label>
                        </div>
                        <ul className="space-y-2">
                          {evaluation.key_moments.map((moment, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-primary font-bold">{i + 1}.</span>
                              <span className="text-muted-foreground">{moment}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvement Suggestions */}
                    {evaluation.improvement_suggestions && evaluation.improvement_suggestions.length > 0 && (
                      <div className="p-4 border-2 border-border bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="h-4 w-4 text-orange-500" />
                          <Label className="font-medium">Improvement Suggestions</Label>
                        </div>
                        <ul className="space-y-2">
                          {evaluation.improvement_suggestions.map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <TrendingUp className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                              <span className="text-muted-foreground">{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Evaluation Notes</Label>
                  <Textarea
                    placeholder="Add any observations or feedback about this call..."
                    value={evaluation.notes}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, notes: e.target.value }))}
                    className="min-h-[80px] border-2"
                  />
                </div>

                {/* Save Button */}
                <Button 
                  onClick={() => saveEvaluation.mutate()} 
                  disabled={saveEvaluation.isPending}
                  className="w-full"
                >
                  {saveEvaluation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Evaluation
                    </>
                  )}
                </Button>
              </div>
            </ScrollArea>
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
                            ? "bg-green-500"
                            : call.sentiment === "negative"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                        }`}
                      />
                      <span className="text-sm capitalize">{call.sentiment}</span>
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
