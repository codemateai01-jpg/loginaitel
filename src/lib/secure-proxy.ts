import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface SecureProxyOptions {
  action: string;
  params?: Record<string, string>;
}

export async function fetchSecureData<T>(options: SecureProxyOptions): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  if (!token) {
    throw new Error("Not authenticated");
  }

  const queryParams = new URLSearchParams({ action: options.action, ...options.params });
  
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/secure-data-proxy?${queryParams}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch data");
  }

  return response.json();
}

// Specific typed fetch functions
export async function fetchDemoCalls(engineerId?: string) {
  return fetchSecureData<any[]>({
    action: "demo_calls",
    params: engineerId ? { engineer_id: engineerId } : undefined,
  });
}

export async function fetchAdminDemoCalls() {
  return fetchSecureData<any[]>({
    action: "admin_demo_calls",
  });
}

export async function fetchCalls(options?: { startDate?: string; clientId?: string; status?: string }) {
  const params: Record<string, string> = {};
  if (options?.startDate) params.start_date = options.startDate;
  if (options?.clientId) params.client_id = options.clientId;
  if (options?.status) params.status = options.status;
  
  return fetchSecureData<any[]>({
    action: "calls",
    params,
  });
}

export async function fetchActiveCalls() {
  return fetchSecureData<any[]>({
    action: "active_calls",
  });
}

export async function fetchTodayStats() {
  return fetchSecureData<{
    total: number;
    completed: number;
    connected: number;
    failed: number;
    inProgress: number;
    connectionRate: number;
    avgDuration: number;
  }>({
    action: "today_stats",
  });
}

export async function fetchTasks(options?: { assignedTo?: string; status?: string }) {
  const params: Record<string, string> = {};
  if (options?.assignedTo) params.assigned_to = options.assignedTo;
  if (options?.status) params.status = options.status;
  
  return fetchSecureData<any[]>({
    action: "tasks",
    params,
  });
}
