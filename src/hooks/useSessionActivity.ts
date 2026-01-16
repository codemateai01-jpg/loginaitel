import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setLastActivity } from "./useSessionTimeout";

const ACTIVITY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_INTERVAL = 60 * 1000; // 1 minute debounce

/**
 * Hook to track session activity and update last_activity_at for single-device enforcement.
 * Also syncs with local storage for 24-hour session expiry.
 * Only tracks for main clients (not sub-users).
 */
export function useSessionActivity() {
  const { user, role, isSubUser } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Only track for main clients (not sub-users)
    if (!user || role !== "client" || isSubUser) {
      return;
    }

    const updateActivity = async () => {
      const now = Date.now();
      
      // Debounce: only update if last update was > 1 minute ago
      if (now - lastUpdateRef.current < DEBOUNCE_INTERVAL) {
        return;
      }
      
      lastUpdateRef.current = now;
      setLastActivity(now); // Sync with local storage for session timeout

      try {
        await supabase
          .from("client_active_sessions" as any)
          .update({ last_activity_at: new Date().toISOString() })
          .eq("client_id", user.id)
          .eq("is_active", true);
      } catch (error) {
        console.error("Failed to update session activity:", error);
      }
    };

    // Update immediately on mount
    updateActivity();

    // Update every 5 minutes
    intervalRef.current = setInterval(updateActivity, ACTIVITY_UPDATE_INTERVAL);

    // Also update on user interactions (debounced)
    const handleActivity = () => {
      updateActivity();
    };

    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [user, role, isSubUser]);
}
