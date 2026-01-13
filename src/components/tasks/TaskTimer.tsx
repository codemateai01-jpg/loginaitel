import { useState, useEffect } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskTimerProps {
  pickedAt: string | null;
  timeLimitMinutes?: number;
}

export function TaskTimer({ pickedAt, timeLimitMinutes = 10 }: TaskTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!pickedAt) return;

    const calculateTimeLeft = () => {
      const pickedTime = new Date(pickedAt).getTime();
      const deadline = pickedTime + timeLimitMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = deadline - now;

      if (remaining <= 0) {
        setIsExpired(true);
        setTimeLeft(0);
      } else {
        setIsExpired(false);
        setTimeLeft(remaining);
      }
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [pickedAt, timeLimitMinutes]);

  if (!pickedAt || timeLeft === null) return null;

  const totalSeconds = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const percentageLeft = (timeLeft / (timeLimitMinutes * 60 * 1000)) * 100;
  const isUrgent = percentageLeft < 30; // Less than 30% time remaining
  const isWarning = percentageLeft < 50 && !isUrgent; // Between 30-50%

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/20 border-2 border-destructive text-destructive">
        <AlertTriangle className="h-4 w-4 animate-pulse" />
        <span className="text-sm font-bold">Time Expired!</span>
        <span className="text-xs">Start working now</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-2 transition-all",
        isUrgent
          ? "bg-destructive/20 border-destructive text-destructive animate-pulse"
          : isWarning
          ? "bg-chart-5/20 border-chart-5 text-chart-5"
          : "bg-chart-4/20 border-chart-4 text-chart-4"
      )}
    >
      <Clock className={cn("h-4 w-4", isUrgent && "animate-pulse")} />
      <div className="flex items-baseline gap-1">
        <span className="font-mono font-bold text-lg">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <span className="text-xs opacity-80">to start</span>
      </div>
      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-background/50 overflow-hidden ml-2 min-w-[60px]">
        <div
          className={cn(
            "h-full transition-all duration-1000",
            isUrgent
              ? "bg-destructive"
              : isWarning
              ? "bg-chart-5"
              : "bg-chart-4"
          )}
          style={{ width: `${percentageLeft}%` }}
        />
      </div>
    </div>
  );
}
