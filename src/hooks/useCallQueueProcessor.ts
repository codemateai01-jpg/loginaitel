import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface QueueProcessorOptions {
  enabled?: boolean;
  intervalMs?: number;
  onProcess?: (result: QueueProcessResult) => void;
  onError?: (error: Error) => void;
}

interface QueueProcessResult {
  success: boolean;
  processed: number;
  active_calls: number;
  results?: Array<{
    queue_item_id: string;
    call_id?: string;
    success: boolean;
    error?: string;
  }>;
}

export function useCallQueueProcessor(options: QueueProcessorOptions = {}) {
  const {
    enabled = true,
    intervalMs = 5000, // Process every 5 seconds
    onProcess,
    onError,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  // Get pending queue count - disabled since call_queue table was removed
  const pendingCount = 0;
  const refetchCount = () => {};

  // Get in-progress count - disabled since call_queue table was removed
  const inProgressCount = 0;
  const refetchInProgress = () => {};

  const processQueue = useCallback(async (): Promise<QueueProcessResult | null> => {
    if (isProcessingRef.current) {
      return null;
    }

    isProcessingRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke("process-call-queue", {
        method: "POST",
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as QueueProcessResult;
      
      if (result.processed > 0) {
        // Refetch counts after processing
        refetchCount();
        refetchInProgress();
      }

      onProcess?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      onError?.(err);
      return null;
    } finally {
      isProcessingRef.current = false;
    }
  }, [onProcess, onError, refetchCount, refetchInProgress]);

  // Auto-process when there are pending items
  useEffect(() => {
    if (!enabled || pendingCount === 0) {
      return;
    }

    // Process immediately when there are pending items
    processQueue();

    // Set up interval for continuous processing
    intervalRef.current = setInterval(() => {
      if (pendingCount > 0) {
        processQueue();
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pendingCount, intervalMs, processQueue]);

  // Manual trigger
  const triggerProcess = useCallback(() => {
    return processQueue();
  }, [processQueue]);

  return {
    pendingCount,
    inProgressCount,
    isProcessing: isProcessingRef.current,
    triggerProcess,
    refetch: () => {
      refetchCount();
      refetchInProgress();
    },
  };
}
