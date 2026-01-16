import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, PhoneOff, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type CallStatus = "idle" | "initiating" | "ringing" | "connected" | "ended" | "failed";

interface TelecallerCallLog {
  id: string;
  telecaller_id: string;
  lead_id: string;
  assignment_id: string | null;
  client_id: string;
  phone_number: string;
  call_type: string;
  provider: string;
  status: string;
  external_call_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  notes?: string | null;
  call_outcome?: string | null;
  created_at: string;
  updated_at: string;
}

interface ClickToCallButtonProps {
  phoneNumber: string;
  leadId: string;
  leadName: string;
  assignmentId: string;
  subUserId: string;
  clientId: string;
  onCallStarted?: () => void;
  onCallEnded?: (duration: number) => void;
}

export function ClickToCallButton({
  phoneNumber,
  leadId,
  leadName,
  assignmentId,
  subUserId,
  clientId,
  onCallStarted,
  onCallEnded,
}: ClickToCallButtonProps) {
  const { toast } = useToast();
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallLogId, setCurrentCallLogId] = useState<string | null>(null);

  // For now, use tel: link - Exotel SDK will replace this later
  const initiateCall = async () => {
    try {
      setCallStatus("initiating");
      setCallDialogOpen(true);

      // Log call attempt - using any type since table isn't in generated types yet
      const { data: callLog, error } = await supabase
        .from("telecaller_call_logs" as any)
        .insert({
          telecaller_id: subUserId,
          lead_id: leadId,
          assignment_id: assignmentId,
          client_id: clientId,
          phone_number: phoneNumber,
          call_type: "outbound",
          status: "initiated",
          provider: "exotel", // Ready for Exotel
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      setCurrentCallLogId((callLog as any)?.id || null);

      // TODO: Replace with Exotel SDK call
      // For now, open tel: link as fallback
      window.open(`tel:${phoneNumber}`, "_self");
      
      setCallStatus("ringing");
      setCallStartTime(new Date());
      onCallStarted?.();

      // Update assignment status
      await supabase
        .from("lead_assignments")
        .update({ 
          status: "in_progress", 
          last_action_at: new Date().toISOString() 
        })
        .eq("id", assignmentId);

    } catch (error: any) {
      console.error("Call initiation error:", error);
      setCallStatus("failed");
      toast({
        title: "Call failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const markCallConnected = async () => {
    setCallStatus("connected");
    setCallStartTime(new Date());

    if (currentCallLogId) {
      await supabase
        .from("telecaller_call_logs" as any)
        .update({ 
          status: "connected",
          started_at: new Date().toISOString(),
        } as any)
        .eq("id", currentCallLogId);
    }
  };

  const endCall = async () => {
    const endTime = new Date();
    const duration = callStartTime 
      ? Math.round((endTime.getTime() - callStartTime.getTime()) / 1000)
      : 0;

    setCallDuration(duration);
    setCallStatus("ended");

    if (currentCallLogId) {
      await supabase
        .from("telecaller_call_logs" as any)
        .update({ 
          status: "completed",
          ended_at: endTime.toISOString(),
          duration_seconds: duration,
        } as any)
        .eq("id", currentCallLogId);
    }

    onCallEnded?.(duration);
  };

  const closeDialog = () => {
    setCallDialogOpen(false);
    setCallStatus("idle");
    setCallStartTime(null);
    setCallDuration(0);
    setCurrentCallLogId(null);
  };

  const getStatusBadge = () => {
    switch (callStatus) {
      case "initiating":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Initiating...</Badge>;
      case "ringing":
        return <Badge className="bg-yellow-500"><Phone className="h-3 w-3 mr-1" />Ringing</Badge>;
      case "connected":
        return <Badge className="bg-green-500"><PhoneCall className="h-3 w-3 mr-1" />Connected</Badge>;
      case "ended":
        return <Badge variant="outline"><PhoneOff className="h-3 w-3 mr-1" />Ended</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <Button
        size="sm"
        variant="default"
        onClick={initiateCall}
        disabled={callStatus !== "idle" && callStatus !== "ended"}
      >
        <Phone className="h-3 w-3 mr-1" />
        Call
      </Button>

      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5" />
              Call: {leadName}
            </DialogTitle>
            <DialogDescription>
              {phoneNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-6 space-y-4">
            {getStatusBadge()}

            {callStatus === "connected" && (
              <div className="flex items-center gap-2 text-2xl font-mono">
                <Clock className="h-5 w-5" />
                <span>Call in progress</span>
              </div>
            )}

            {callStatus === "ended" && (
              <div className="text-center">
                <p className="text-lg font-medium">Call Duration</p>
                <p className="text-3xl font-mono">{formatDuration(callDuration)}</p>
              </div>
            )}

            {/* Call control buttons */}
            <div className="flex gap-2 mt-4">
              {callStatus === "ringing" && (
                <Button onClick={markCallConnected} className="bg-green-600 hover:bg-green-700">
                  <PhoneCall className="h-4 w-4 mr-2" />
                  Mark Connected
                </Button>
              )}
              
              {(callStatus === "ringing" || callStatus === "connected") && (
                <Button onClick={endCall} variant="destructive">
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              )}

              {(callStatus === "ended" || callStatus === "failed") && (
                <Button onClick={closeDialog} variant="outline">
                  Close
                </Button>
              )}
            </div>
          </div>

          {/* Exotel integration note */}
          <p className="text-xs text-muted-foreground text-center border-t pt-3">
            Using phone dialer. Exotel browser calling available after integration.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
