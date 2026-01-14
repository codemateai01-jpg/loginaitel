import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeCallsOptions {
  queryKey: string[];
  clientId?: string;
}

export function useRealtimeCalls({ queryKey, clientId }: UseRealtimeCallsOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Build filter based on clientId
    const filter = clientId ? `client_id=eq.${clientId}` : undefined;

    const channel = supabase
      .channel("calls-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter,
        },
        (payload) => {
          console.log("Realtime call update:", payload);
          // Invalidate the calls query to refetch data
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, clientId]);
}
