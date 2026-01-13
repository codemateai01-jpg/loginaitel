import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { scheduleBatch, type Batch } from "@/lib/bolna";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ScheduleBatchDialogProps {
  batch: Batch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ScheduleBatchDialog({
  batch,
  open,
  onOpenChange,
  onSuccess,
}: ScheduleBatchDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSchedule = async () => {
    if (!batch || !selectedDate) {
      toast.error("Please select a date");
      return;
    }

    // Combine date and time
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    // Ensure the scheduled time is in the future
    if (scheduledDate <= new Date()) {
      toast.error("Please select a future date and time");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await scheduleBatch(batch.batch_id, scheduledDate.toISOString());

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Batch scheduled successfully!");
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setSelectedDate(undefined);
      setSelectedTime("09:00");
    } catch (error) {
      toast.error("Failed to schedule batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScheduledDateTime = () => {
    if (!selectedDate) return null;
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, minutes, 0, 0);
    return scheduledDate;
  };

  const scheduledDateTime = getScheduledDateTime();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Batch</DialogTitle>
          <DialogDescription>
            Choose when to run this batch calling campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Batch Info */}
          {batch && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">Batch ID</p>
              <p className="text-xs font-mono text-muted-foreground">
                {batch.batch_id}
              </p>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">Valid Contacts</p>
                  <p className="text-sm font-medium">{batch.valid_contacts || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Contacts</p>
                  <p className="text-sm font-medium">{batch.total_contacts || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label>Select Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Preview */}
          {scheduledDateTime && (
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <p className="text-sm font-medium text-primary">Scheduled for:</p>
              <p className="text-lg font-bold">
                {format(scheduledDateTime, "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-muted-foreground">
                at {format(scheduledDateTime, "h:mm a")}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={isSubmitting || !selectedDate}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Schedule Batch
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
