import { supabase } from "@/integrations/supabase/client";
import { decodeTranscript, decodeSummary, decodeExtractedData, decodeNotes } from "@/lib/decode-utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface SecureProxyOptions {
  action: string;
  params?: Record<string, string>;
}

/**
 * Decode encoded fields in call/demo_call objects from the secure proxy.
 * These are base64-encoded for network obfuscation but need to be decoded for UI display.
 */
function decodeCallData<T>(data: T): T {
  if (!data) return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => decodeCallData(item)) as T;
  }
  
  // Handle objects with encoded fields
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const decoded = { ...obj };
    
    if (typeof decoded.transcript === "string") {
      decoded.transcript = decodeTranscript(decoded.transcript) || decoded.transcript;
    }
    if (typeof decoded.summary === "string") {
      decoded.summary = decodeSummary(decoded.summary) || decoded.summary;
    }
    if (typeof decoded.notes === "string") {
      decoded.notes = decodeNotes(decoded.notes) || decoded.notes;
    }
    
    // Handle metadata.extracted_data
    if (decoded.metadata && typeof decoded.metadata === "object") {
      const metadata = decoded.metadata as Record<string, unknown>;
      if (typeof metadata.extracted_data === "string") {
        metadata.extracted_data = decodeExtractedData(metadata.extracted_data);
        decoded.metadata = metadata;
      }
    }
    
    return decoded as T;
  }
  
  return data;
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

  const rawData = await response.json();
  
  // Decode encoded fields for UI display
  return decodeCallData(rawData);
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
