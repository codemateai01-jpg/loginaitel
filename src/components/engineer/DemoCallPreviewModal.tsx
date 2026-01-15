import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Pause,
  Send,
  Clock,
  Phone,
  Bot,
  FileText,
  Headphones,
  CheckCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef, useEffect } from "react";

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

interface DemoCallPreviewModalProps {
  call: DemoCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (callId: string) => void;
  isSubmitting: boolean;
}

export function DemoCallPreviewModal({
  call,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: DemoCallPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
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

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  if (!call) return null;

  const isSelected = call.tasks?.selected_demo_call_id === call.id;
  const canSubmit = call.status === "completed" && call.recording_url && !isSelected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Demo Call Preview
          </DialogTitle>
          <DialogDescription>
            Review the recording and transcript before submitting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Call Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 border-2 border-border">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">Phone:</span>{" "}
                <span className="font-mono">{call.phone_number}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">Agent:</span>{" "}
                {call.aitel_agents?.agent_name || "Unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">Duration:</span>{" "}
                <span className="font-mono">
                  {call.duration_seconds ? `${call.duration_seconds}s` : "—"}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">Task:</span>{" "}
                {call.tasks?.title || "Unknown"}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge
              className={
                call.status === "completed"
                  ? "bg-chart-2/20 text-chart-2 border-chart-2"
                  : "bg-muted text-muted-foreground"
              }
            >
              {call.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
              {call.status}
            </Badge>
            {isSelected && (
              <Badge variant="outline" className="bg-chart-2/20 text-chart-2 border-chart-2">
                Already Submitted
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
            </span>
          </div>

          <Separator />

          {/* Audio Player */}
          {call.recording_url ? (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Headphones className="h-4 w-4" />
                Recording
              </h4>
              <div className="flex items-center gap-3 p-3 bg-muted/30 border-2 border-border">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={togglePlayPause}
                  className="h-10 w-10 shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1 space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={call.recording_url}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/30 border-2 border-border text-center text-muted-foreground">
              <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recording available</p>
              <p className="text-xs">Sync the recording first to preview</p>
            </div>
          )}

          {/* Transcript */}
          <div className="space-y-2 flex-1 min-h-0">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Transcript
            </h4>
            {call.transcript ? (
              <ScrollArea className="h-48 border-2 border-border bg-muted/30 p-3">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {call.transcript}
                </pre>
              </ScrollArea>
            ) : (
              <div className="h-32 border-2 border-border bg-muted/30 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No transcript available</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {canSubmit && (
            <Button
              onClick={() => onSubmit(call.id)}
              disabled={isSubmitting}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Submitting..." : "Submit for Review"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
