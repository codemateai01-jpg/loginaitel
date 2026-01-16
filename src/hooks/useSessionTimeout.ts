import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SESSION_TIMEOUT_SHORT_MS = 20 * 60 * 1000; // 20 minutes
const SESSION_TIMEOUT_LONG_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
const REMEMBER_ME_KEY = "aitel_remember_me";

export function setRememberMe(value: boolean) {
  if (value) {
    localStorage.setItem(REMEMBER_ME_KEY, "true");
  } else {
    localStorage.removeItem(REMEMBER_ME_KEY);
  }
}

export function getRememberMe(): boolean {
  return localStorage.getItem(REMEMBER_ME_KEY) === "true";
}

export function clearRememberMe() {
  localStorage.removeItem(REMEMBER_ME_KEY);
}

export function useSessionTimeout() {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const getTimeoutDuration = useCallback(() => {
    return getRememberMe() ? SESSION_TIMEOUT_LONG_MS : SESSION_TIMEOUT_SHORT_MS;
  }, []);

  const handleLogout = useCallback(async () => {
    clearRememberMe();
    toast.warning("Session expired due to inactivity. Please log in again.");
    await supabase.auth.signOut();
    navigate("/login");
  }, [navigate]);

  const resetTimeout = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, getTimeoutDuration());
  }, [handleLogout, getTimeoutDuration]);

  const handleActivity = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  useEffect(() => {
    // Initial timeout setup
    resetTimeout();

    // Add activity listeners
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Check session on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= getTimeoutDuration()) {
          handleLogout();
        } else {
          resetTimeout();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [handleActivity, handleLogout, resetTimeout, getTimeoutDuration]);

  return { resetTimeout };
}
