import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Loader2, CheckCircle2, XCircle, Clock, PhoneCall, PhoneOff } from "lucide-react";

interface TestCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  agentId: string;
  externalAgentId: string;
  onTestCall: (phoneNumber: string) => Promise<{ success: boolean; message: string; executionId?: string }>;
  onStopCall?: (executionId: string) => Promise<void>;
}

type CallStatus = "idle" | "initiating" | "ringing" | "in_progress" | "completed" | "failed";

export function TestCallDialog({
  open,
  onOpenChange,
  agentName,
  agentId,
  externalAgentId,
  onTestCall,
  onStopCall,
}: TestCallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [result, setResult] = useState<{ success: boolean; message: string; executionId?: string } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (callStatus === "in_progress" || callStatus === "ringing") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTestCall = async () => {
    if (!phoneNumber) return;

    setIsLoading(true);
    setResult(null);
    setCallStatus("initiating");
    setCallDuration(0);

    try {
      const res = await onTestCall(phoneNumber);
      setResult(res);
      
      if (res.success) {
        setCallStatus("ringing");
        setCurrentExecutionId(res.executionId || null);
        
        // Simulate call progression (in production, this would come from webhooks)
        setTimeout(() => {
          if (callStatus !== "completed" && callStatus !== "failed") {
            setCallStatus("in_progress");
          }
        }, 3000);
      } else {
        setCallStatus("failed");
      }
    } catch {
      setResult({ success: false, message: "Failed to initiate test call" });
      setCallStatus("failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopCall = async () => {
    if (currentExecutionId && onStopCall) {
      try {
        await onStopCall(currentExecutionId);
        setCallStatus("completed");
        setResult({ success: true, message: "Call ended successfully" });
      } catch {
        setResult({ success: false, message: "Failed to stop call" });
      }
    } else {
      setCallStatus("completed");
    }
  };

  const handleClose = () => {
    if (callStatus === "in_progress" || callStatus === "ringing") {
      // Don't close while call is active
      return;
    }
    setPhoneNumber("");
    setResult(null);
    setCallStatus("idle");
    setCallDuration(0);
    setCurrentExecutionId(null);
    onOpenChange(false);
  };

  const getStatusBadge = () => {
    switch (callStatus) {
      case "initiating":
        return <Badge variant="secondary" className="animate-pulse">Initiating...</Badge>;
      case "ringing":
        return <Badge variant="secondary" className="animate-pulse bg-amber-500/20 text-amber-600">Ringing</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-green-500">In Progress</Badge>;
      case "completed":
        return <Badge variant="secondary">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  const isCallActive = callStatus === "ringing" || callStatus === "in_progress";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Test Call
            {getStatusBadge()}
          </DialogTitle>
          <DialogDescription>
            Test your agent "{agentName}" by making a call to a phone number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="border-2"
              disabled={isLoading || isCallActive}
            />
            <p className="text-xs text-muted-foreground">
              Enter phone number with country code (e.g., +91 for India)
            </p>
          </div>

          {/* Call Status Display */}
          {callStatus !== "idle" && (
            <div className="p-4 border-2 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCallActive ? (
                    <PhoneCall className="h-5 w-5 text-green-600 animate-pulse" />
                  ) : callStatus === "completed" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : callStatus === "failed" ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {callStatus === "initiating" && "Connecting..."}
                    {callStatus === "ringing" && "Ringing recipient..."}
                    {callStatus === "in_progress" && "Call in progress"}
                    {callStatus === "completed" && "Call completed"}
                    {callStatus === "failed" && "Call failed"}
                  </span>
                </div>
                
                {isCallActive && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDuration(callDuration)}
                  </div>
                )}
              </div>
              
              {result?.message && (
                <p className={`mt-2 text-sm ${result.success ? "text-muted-foreground" : "text-destructive"}`}>
                  {result.message}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {isCallActive ? (
            <Button 
              variant="destructive" 
              onClick={handleStopCall}
              className="w-full gap-2"
            >
              <PhoneOff className="h-4 w-4" />
              End Call
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                {callStatus === "completed" || callStatus === "failed" ? "Close" : "Cancel"}
              </Button>
              <Button 
                onClick={handleTestCall} 
                disabled={isLoading || !phoneNumber || callStatus === "completed"}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calling...
                  </>
                ) : callStatus === "failed" ? (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Retry Call
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Make Test Call
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
