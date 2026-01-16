import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { getExecution, downloadRecording, CallExecution } from "@/lib/aitel";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Play,
  Pause,
  Download,
  Phone,
  User,
  Clock,
  Calendar,
  MessageSquare,
  FileText,
  Volume2,
  Loader2,
} from "lucide-react";

interface CampaignLead {
  id: string;
  name: string;
  phone_number: string;
  email: string | null;
  stage: string;
  interest_level: string | null;
  call_status: string | null;
  call_duration: number | null;
  call_summary: string | null;
  call_sentiment: string | null;
  notes: string | null;
  call_id: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadDetailsDialogProps {
  lead: CampaignLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailsDialog({ lead, open, onOpenChange }: LeadDetailsDialogProps) {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Fetch call details if call_id exists
  const { data: callData } = useQuery({
    queryKey: ["call-details", lead?.call_id],
    enabled: !!lead?.call_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .eq("id", lead!.call_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch execution details if external_call_id exists
  const { data: executionData } = useQuery({
    queryKey: ["execution-details", callData?.external_call_id],
    enabled: !!callData?.external_call_id && open,
    queryFn: async () => {
      const result = await getExecution(callData!.external_call_id!);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
  });

  // Get recording URL from execution or call data
  const recordingUrl = executionData?.telephony_data?.recording_url || callData?.recording_url;
  const transcript = executionData?.transcript || callData?.transcript;
  const summary = executionData?.summary || lead?.call_summary;

  // Load audio when recording URL is available
  useEffect(() => {
    const loadAudio = async () => {
      if (!recordingUrl || !open) {
        setAudioUrl(null);
        return;
      }

      setIsLoadingAudio(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aitel-proxy`);
        url.searchParams.set("action", "download-recording");
        url.searchParams.set("url", recordingUrl);

        const response = await fetch(url.toString(), {
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) throw new Error("Failed to load recording");

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      } catch (error) {
        console.error("Failed to load audio:", error);
        toast({
          title: "Error",
          description: "Failed to load call recording",
          variant: "destructive",
        });
      } finally {
        setIsLoadingAudio(false);
      }
    };

    loadAudio();

    // Cleanup
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [recordingUrl, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [open]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
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

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleDownload = async () => {
    if (!recordingUrl) return;
    setIsDownloading(true);
    try {
      await downloadRecording(recordingUrl, `${lead?.name || "call"}-recording.mp3`);
      toast({ title: "Recording downloaded" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download recording",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const parseTranscript = (transcriptText: string | null): { role: string; content: string }[] => {
    if (!transcriptText) return [];
    
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(transcriptText);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          role: item.role || item.speaker || "unknown",
          content: item.content || item.text || item.message || "",
        }));
      }
    } catch {
      // Parse plain text format
      const lines = transcriptText.split("\n").filter((line) => line.trim());
      return lines.map((line) => {
        const match = line.match(/^(AI|Human|Agent|User|assistant|user):\s*(.+)$/i);
        if (match) {
          return { role: match[1].toLowerCase(), content: match[2] };
        }
        return { role: "unknown", content: line };
      });
    }
    return [];
  };

  const transcriptMessages = parseTranscript(transcript || null);

  const getSentimentBadge = (sentiment: string | null) => {
    if (!sentiment) return null;
    const colors: Record<string, string> = {
      positive: "bg-green-500/10 text-green-600 border-green-500",
      negative: "bg-red-500/10 text-red-600 border-red-500",
      neutral: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge className={`border-2 ${colors[sentiment] || colors.neutral}`}>
        {sentiment}
      </Badge>
    );
  };

  const getInterestBadge = (interest: string | null) => {
    if (!interest) return null;
    const colors: Record<string, string> = {
      interested: "bg-green-500/10 text-green-600 border-green-500",
      not_interested: "bg-red-500/10 text-red-600 border-red-500",
      partially_interested: "bg-yellow-500/10 text-yellow-600 border-yellow-500",
    };
    return (
      <Badge className={`border-2 ${colors[interest] || "bg-muted"}`}>
        {interest?.replace(/_/g, " ")}
      </Badge>
    );
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {lead.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 pr-4">
            {/* Lead Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{lead.phone_number}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(lead.created_at), "MMM d, yyyy")}</span>
              </div>
              {lead.call_duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDuration(lead.call_duration)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {getInterestBadge(lead.interest_level)}
                {getSentimentBadge(lead.call_sentiment)}
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue={recordingUrl ? "recording" : "summary"} className="flex flex-col">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="recording" className="flex items-center gap-1">
                <Volume2 className="h-4 w-4" />
                Recording
              </TabsTrigger>
              <TabsTrigger value="transcript" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="summary" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recording" className="flex-1 mt-4">
              {!lead.call_id ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Phone className="h-10 w-10 mb-2 opacity-50" />
                  <p>No call made yet</p>
                </div>
              ) : isLoadingAudio ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading recording...</p>
                </div>
              ) : !recordingUrl ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Volume2 className="h-10 w-10 mb-2 opacity-50" />
                  <p>No recording available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Audio Element */}
                  {audioUrl && (
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                  )}

                  {/* Player Controls */}
                  <div className="bg-muted/50 border-2 border-border p-4 rounded-lg space-y-4">
                    <div className="flex items-center gap-4">
                      <Button
                        size="icon"
                        variant="default"
                        onClick={handlePlayPause}
                        disabled={!audioUrl}
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </Button>

                      <div className="flex-1 space-y-1">
                        <Slider
                          value={[currentTime]}
                          max={duration || 100}
                          step={0.1}
                          onValueChange={handleSeek}
                          disabled={!audioUrl}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatDuration(currentTime)}</span>
                          <span>{formatDuration(duration)}</span>
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleDownload}
                        disabled={isDownloading || !recordingUrl}
                      >
                        {isDownloading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Call Status Info */}
                  {callData && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant="outline" className="ml-2">{callData.status}</Badge>
                      </div>
                      {callData.duration_seconds && (
                        <div>
                          <span className="text-muted-foreground">Duration:</span>
                          <span className="ml-2">{formatDuration(callData.duration_seconds)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="transcript" className="flex-1 overflow-hidden mt-4">
              <ScrollArea className="h-[300px] border-2 border-border rounded-lg">
                {transcriptMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mb-2 opacity-50" />
                    <p>No transcript available</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {transcriptMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${
                          msg.role === "assistant" || msg.role === "ai" || msg.role === "agent"
                            ? "justify-start"
                            : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.role === "assistant" || msg.role === "ai" || msg.role === "agent"
                              ? "bg-muted"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <p className="text-xs font-medium mb-1 capitalize opacity-70">
                            {msg.role === "assistant" || msg.role === "ai" || msg.role === "agent"
                              ? "AI Agent"
                              : "Customer"}
                          </p>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="summary" className="flex-1 mt-4">
              <div className="space-y-4">
                {summary ? (
                  <div className="bg-muted/50 border-2 border-border p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{summary}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-2 opacity-50" />
                    <p>No summary available</p>
                  </div>
                )}

                {lead.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <div className="bg-muted/50 border-2 border-border p-4 rounded-lg">
                      <p className="text-sm">{lead.notes}</p>
                    </div>
                  </div>
                )}

                {/* Extracted Data from execution */}
                {executionData?.extracted_data && Object.keys(executionData.extracted_data).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Extracted Information</h4>
                    <div className="bg-muted/50 border-2 border-border p-4 rounded-lg">
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(executionData.extracted_data).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</dt>
                            <dd className="font-medium">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
          </div>
        </ScrollArea>
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
