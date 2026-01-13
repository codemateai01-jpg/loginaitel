import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { format } from "date-fns";
import { Slider } from "@/components/ui/slider";

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

  // Parse transcript into messages if it's a conversation format
  const parseTranscript = (transcript: string | null) => {
    if (!transcript) return [];
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, try to parse as text with speaker labels
    }

    // Parse text format like "Agent: Hello\nUser: Hi"
    const lines = transcript.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      const match = line.match(/^(Agent|User|Lead|Bot):\s*(.*)$/i);
      if (match) {
        return {
          role: match[1].toLowerCase(),
          content: match[2],
        };
      }
      return { role: "unknown", content: line };
    });
  };

  const transcriptMessages = parseTranscript(call.transcript);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Details
          </DialogTitle>
        </DialogHeader>

        {/* Call Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/50 border-2 border-border">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Lead</p>
              <p className="font-medium text-sm">{call.lead?.name || "Unknown"}</p>
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
                {formatDuration(call.duration_seconds)}
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

        {/* Status & Sentiment */}
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            {call.connected ? (
              <CheckCircle className="h-4 w-4 text-chart-2" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {call.connected ? "Connected" : "Not Connected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-4 w-4 ${getSentimentColor(call.sentiment)}`} />
            <span className={`text-sm capitalize ${getSentimentColor(call.sentiment)}`}>
              {call.sentiment || "Neutral"} Sentiment
            </span>
          </div>
        </div>

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
              disabled={!call.recording_url}
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

          <TabsContent value="transcript" className="flex-1 min-h-0">
            <ScrollArea className="h-[300px] border-2 border-border p-4">
              {transcriptMessages.length > 0 ? (
                <div className="space-y-4">
                  {transcriptMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.role === "agent" || message.role === "bot"
                          ? ""
                          : "flex-row-reverse"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 flex items-center justify-center border-2 shrink-0 ${
                          message.role === "agent" || message.role === "bot"
                            ? "bg-chart-1/10 border-chart-1"
                            : "bg-chart-2/10 border-chart-2"
                        }`}
                      >
                        {message.role === "agent" || message.role === "bot" ? (
                          <Bot className="h-4 w-4 text-chart-1" />
                        ) : (
                          <User className="h-4 w-4 text-chart-2" />
                        )}
                      </div>
                      <div
                        className={`flex-1 p-3 border-2 border-border ${
                          message.role === "agent" || message.role === "bot"
                            ? "bg-muted/50"
                            : "bg-card"
                        }`}
                      >
                        <p className="text-xs text-muted-foreground mb-1 capitalize">
                          {message.role === "bot" ? "Agent" : message.role}
                        </p>
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
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

          <TabsContent value="recording" className="flex-1">
            <div className="border-2 border-border p-6 space-y-6">
              {call.recording_url ? (
                <>
                  <audio
                    ref={audioRef}
                    src={call.recording_url}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Player Controls */}
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
                  </div>

                  {/* Progress Bar */}
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

          <TabsContent value="summary" className="flex-1">
            <ScrollArea className="h-[300px] border-2 border-border p-4">
              {call.summary ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Call Summary</h4>
                    <p className="text-sm text-muted-foreground">{call.summary}</p>
                  </div>
                  
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
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2" />
                  <p>No summary available</p>
                  <p className="text-xs">AI summary will appear here after processing</p>
                </div>
              )}
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
