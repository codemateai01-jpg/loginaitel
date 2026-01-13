import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { stopCall } from "@/lib/bolna";
import { useToast } from "@/hooks/use-toast";

interface ActiveCall {
  id: string;
  status: string;
  created_at: string;
  lead_name?: string;
  phone_number?: string;
  agent_name?: string;
  external_call_id?: string;
  duration_seconds?: number;
}

interface CallProgressTrackerProps {
  activeCalls: ActiveCall[];
  onCallEnded?: (callId: string) => void;
}

// Status progression order
const STATUS_ORDER = [
  "initiated",
  "queued", 
  "ringing",
  "in-progress",
  "completed",
];

const TERMINAL_STATUSES = ["completed", "failed", "no-answer", "busy", "canceled", "call-disconnected"];

const statusConfig: Record<string, { 
  label: string; 
  icon: React.ReactNode; 
  color: string;
  bgColor: string;
  step: number;
}> = {
  initiated: { 
    label: "Initiated", 
    icon: <Phone className="h-4 w-4" />, 
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    step: 1,
  },
  queued: { 
    label: "Queued", 
    icon: <Clock className="h-4 w-4" />, 
    color: "text-muted-foreground",
    bgColor: "bg-muted-foreground",
    step: 2,
  },
  ringing: { 
    label: "Ringing", 
    icon: <PhoneCall className="h-4 w-4 animate-pulse" />, 
    color: "text-yellow-600",
    bgColor: "bg-yellow-500",
    step: 3,
  },
  "in-progress": { 
    label: "In Progress", 
    icon: <PhoneCall className="h-4 w-4" />, 
    color: "text-green-600",
    bgColor: "bg-green-500",
    step: 4,
  },
  completed: { 
    label: "Completed", 
    icon: <CheckCircle className="h-4 w-4" />, 
    color: "text-green-600",
    bgColor: "bg-green-500",
    step: 5,
  },
  failed: { 
    label: "Failed", 
    icon: <XCircle className="h-4 w-4" />, 
    color: "text-destructive",
    bgColor: "bg-destructive",
    step: 5,
  },
  "no-answer": { 
    label: "No Answer", 
    icon: <AlertCircle className="h-4 w-4" />, 
    color: "text-yellow-600",
    bgColor: "bg-yellow-500",
    step: 5,
  },
  busy: { 
    label: "Busy", 
    icon: <PhoneOff className="h-4 w-4" />, 
    color: "text-yellow-600",
    bgColor: "bg-yellow-500",
    step: 5,
  },
  canceled: { 
    label: "Canceled", 
    icon: <XCircle className="h-4 w-4" />, 
    color: "text-muted-foreground",
    bgColor: "bg-muted-foreground",
    step: 5,
  },
  "call-disconnected": { 
    label: "Disconnected", 
    icon: <PhoneOff className="h-4 w-4" />, 
    color: "text-destructive",
    bgColor: "bg-destructive",
    step: 5,
  },
};

function CallTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="font-mono text-sm">
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function SingleCallProgress({ call, onCallEnded }: { call: ActiveCall; onCallEnded?: (id: string) => void }) {
  const { toast } = useToast();
  const [isStopping, setIsStopping] = useState(false);
  
  const status = statusConfig[call.status] || statusConfig.initiated;
  const isTerminal = TERMINAL_STATUSES.includes(call.status);
  const progressValue = (status.step / 5) * 100;

  const handleStopCall = async () => {
    if (!call.external_call_id) {
      toast({
        variant: "destructive",
        title: "Cannot Stop",
        description: "No execution ID available",
      });
      return;
    }

    setIsStopping(true);
    try {
      const { error } = await stopCall(call.external_call_id);
      if (error) throw new Error(error);
      
      toast({
        title: "Call Stopped",
        description: "The call has been terminated",
      });
      onCallEnded?.(call.id);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to Stop",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className={cn(
      "p-4 border-2 border-border transition-all",
      call.status === "in-progress" && "border-green-500 bg-green-500/5",
      call.status === "ringing" && "border-yellow-500 bg-yellow-500/5 animate-pulse",
      isTerminal && call.status === "completed" && "border-green-500/50",
      isTerminal && call.status !== "completed" && "border-destructive/50 opacity-75"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 flex items-center justify-center",
            status.bgColor,
            "text-white"
          )}>
            {status.icon}
          </div>
          <div>
            <p className="font-medium">{call.lead_name || call.phone_number || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">{call.agent_name || "AI Agent"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("gap-1", status.color, "bg-transparent border-2")}>
            {status.icon}
            {status.label}
          </Badge>
          {!isTerminal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10"
              onClick={handleStopCall}
              disabled={isStopping}
            >
              {isStopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress 
          value={progressValue} 
          className="h-2"
        />
        
        {/* Status Steps */}
        <div className="flex justify-between text-xs text-muted-foreground">
          {STATUS_ORDER.map((s, i) => {
            const stepStatus = statusConfig[s];
            const currentStep = status.step;
            const isActive = i + 1 <= currentStep;
            const isCurrent = s === call.status;
            
            return (
              <div 
                key={s}
                className={cn(
                  "flex flex-col items-center gap-1",
                  isActive && stepStatus.color,
                  isCurrent && "font-medium"
                )}
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isActive ? stepStatus.bgColor : "bg-muted"
                )} />
                <span className="hidden sm:block">{stepStatus.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timer for active calls */}
      {(call.status === "in-progress" || call.status === "ringing") && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Duration:</span>
          <CallTimer startTime={call.created_at} />
        </div>
      )}

      {/* Final duration for completed calls */}
      {isTerminal && call.duration_seconds !== undefined && call.duration_seconds > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total Duration:</span>
          <span className="font-mono">
            {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  );
}

export function CallProgressTracker({ activeCalls, onCallEnded }: CallProgressTrackerProps) {
  if (activeCalls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <h3 className="font-medium text-sm">Live Call Status</h3>
        <Badge variant="secondary" className="text-xs">
          {activeCalls.length} active
        </Badge>
      </div>
      
      <div className="space-y-3">
        {activeCalls.map((call) => (
          <SingleCallProgress 
            key={call.id} 
            call={call} 
            onCallEnded={onCallEnded}
          />
        ))}
      </div>
    </div>
  );
}
