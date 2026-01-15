import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Clock, PhoneOff, Info } from "lucide-react";

interface RetrySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  currentRetryDelay: number;
  currentMaxRetries: number;
}

export function RetrySettingsDialog({
  open,
  onOpenChange,
  campaignId,
  currentRetryDelay,
  currentMaxRetries,
}: RetrySettingsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [retryDelay, setRetryDelay] = useState(currentRetryDelay);
  const [maxRetries, setMaxRetries] = useState(currentMaxRetries);

  useEffect(() => {
    setRetryDelay(currentRetryDelay);
    setMaxRetries(currentMaxRetries);
  }, [currentRetryDelay, currentMaxRetries]);

  const updateSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaigns")
        .update({
          retry_delay_minutes: retryDelay,
          max_daily_retries: maxRetries,
        })
        .eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      toast({ title: "Retry settings updated" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Auto-Retry Settings
          </DialogTitle>
          <DialogDescription>
            Configure how the system retries calls when leads don't answer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Info Alert */}
          <div className="flex gap-3 p-3 bg-muted/50 border border-border text-sm">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <p className="text-muted-foreground">
              When a call is not answered, the system will automatically retry calling the lead 
              based on these settings. Retry counts reset daily.
            </p>
          </div>

          {/* Retry Delay */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Retry After (minutes)
              </Label>
              <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1">
                {retryDelay} min
              </span>
            </div>
            <Slider
              value={[retryDelay]}
              onValueChange={(value) => setRetryDelay(value[0])}
              min={1}
              max={30}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Wait time before retrying an unanswered call (1-30 minutes)
            </p>
          </div>

          {/* Max Daily Retries */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <PhoneOff className="h-4 w-4 text-muted-foreground" />
                Max Daily Retries
              </Label>
              <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1">
                {maxRetries} attempts
              </span>
            </div>
            <Slider
              value={[maxRetries]}
              onValueChange={(value) => setMaxRetries(value[0])}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum retry attempts per lead per day (1-10 attempts)
            </p>
          </div>

          {/* Summary */}
          <div className="bg-card border border-border p-4 space-y-2">
            <h4 className="font-medium text-sm">Summary</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• If lead doesn't answer, retry after <strong>{retryDelay} minutes</strong></li>
              <li>• Maximum <strong>{maxRetries} attempts</strong> per lead per day</li>
              <li>• Retry count resets at midnight</li>
              <li>• Connected calls won't be retried</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
