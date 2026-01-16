import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
const LAST_ACTIVITY_KEY = "aitel_last_activity";
const REMEMBER_ME_KEY = "aitel_remember_me";

// Legacy functions for backward compatibility with login pages
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

export function getLastActivity(): number {
  const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
  return stored ? parseInt(stored, 10) : Date.now();
}

export function setLastActivity(timestamp: number = Date.now()) {
  localStorage.setItem(LAST_ACTIVITY_KEY, timestamp.toString());
}

export function clearLastActivity() {
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function useSessionTimeout() {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    clearLastActivity();
    toast.warning("Session expired due to 24 hours of inactivity. Please log in again.");
    await supabase.auth.signOut();
    navigate("/login");
  }, [navigate]);

  const checkSessionExpiry = useCallback(() => {
    const lastActivity = getLastActivity();
    const timeSinceLastActivity = Date.now() - lastActivity;
    
    if (timeSinceLastActivity >= SESSION_TIMEOUT_MS) {
      handleLogout();
      return true;
    }
    return false;
  }, [handleLogout]);

  const resetTimeout = useCallback(() => {
    setLastActivity();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, SESSION_TIMEOUT_MS);
  }, [handleLogout]);

  const handleActivity = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  useEffect(() => {
    // Check if session already expired on mount
    if (checkSessionExpiry()) {
      return;
    }

    // Initial timeout setup
    resetTimeout();

    // Add activity listeners
    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Periodic check for session expiry (handles case where tab was inactive)
    intervalRef.current = setInterval(() => {
      checkSessionExpiry();
    }, ACTIVITY_CHECK_INTERVAL);

    // Check session on visibility change (when user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (checkSessionExpiry()) {
          return;
        }
        resetTimeout();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Check session on focus (when user switches back to window)
    const handleFocus = () => {
      if (checkSessionExpiry()) {
        return;
      }
      resetTimeout();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [handleActivity, handleLogout, resetTimeout, checkSessionExpiry]);

  return { resetTimeout, checkSessionExpiry };
}
