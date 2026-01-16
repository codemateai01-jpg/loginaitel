import { supabase } from "@/integrations/supabase/client";
import { decodeTranscript, decodeSummary, decodeExtractedData, decodeNotes } from "@/lib/decode-utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface SecureProxyOptions {
  action: string;
  params?: Record<string, string>;
}

export interface MaskedProfile {
  user_id: string;
  display_id: string;
  display_name: string;
  display_email: string;
  display_phone?: string;
  avatar_url?: string | null;
  created_at?: string;
  role?: string;
  // Only for own profile
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
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

// ==========================================
// PROFILE FETCHING (SECURE, MASKED)
// ==========================================

/**
 * Fetch all profiles (admin only) - returns masked data
 */
export async function fetchProfiles(): Promise<MaskedProfile[]> {
  return fetchSecureData<MaskedProfile[]>({
    action: "profiles",
  });
}

/**
 * Fetch single profile - own profile returns full data, others masked
 */
export async function fetchProfile(userId?: string): Promise<MaskedProfile> {
  return fetchSecureData<MaskedProfile>({
    action: "get-profile",
    params: userId ? { user_id: userId } : undefined,
  });
}

/**
 * Fetch all clients (admin only) - returns masked data
 */
export async function fetchClients(): Promise<MaskedProfile[]> {
  return fetchSecureData<MaskedProfile[]>({
    action: "clients",
  });
}

/**
 * Fetch all engineers (admin only) - returns masked data
 */
export async function fetchEngineers(): Promise<MaskedProfile[]> {
  return fetchSecureData<MaskedProfile[]>({
    action: "engineers",
  });
}

// ==========================================
// CLIENTS/ENGINEERS WITH STATS (ADMIN DASHBOARDS)
// ==========================================

export interface ClientWithStats {
  user_id: string;
  display_id: string;
  display_name: string;
  display_email: string;
  display_phone?: string;
  created_at: string;
  credits: number;
  agents_count: number;
  calls_count: number;
}

export interface EngineerWithStats {
  user_id: string;
  display_id: string;
  display_name: string;
  display_email: string;
  created_at: string;
  total_points: number;
  tasks_completed: number;
  tasks_in_progress: number;
  hours_this_month: number;
}

/**
 * Fetch all clients with stats (admin only) - returns masked data with credits/agents/calls
 */
export async function fetchClientsWithStats(): Promise<ClientWithStats[]> {
  return fetchSecureData<ClientWithStats[]>({
    action: "clients-with-stats",
  });
}

/**
 * Fetch all engineers with stats (admin only) - returns masked data with points/tasks/hours
 */
export async function fetchEngineersWithStats(): Promise<EngineerWithStats[]> {
  return fetchSecureData<EngineerWithStats[]>({
    action: "engineers-with-stats",
  });
}

// ==========================================
// DEMO CALLS (ENCRYPTED TRANSCRIPTS)
// ==========================================

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

// ==========================================
// CALLS (ADMIN VIEW)
// ==========================================

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

// ==========================================
// RECORDING URL RESOLUTION
// ==========================================

/**
 * Resolves a demo call recording proxy URL to an actual playable URL
 */
export async function getDemoRecordingUrl(callId: string): Promise<{ url: string; call_id: string }> {
  return fetchSecureData<{ url: string; call_id: string }>({
    action: "get_demo_recording",
    params: { call_id: callId },
  });
}

/**
 * Resolves a call recording proxy URL to an actual playable URL
 */
export async function getCallRecordingUrl(callId: string): Promise<{ url: string; call_id: string }> {
  return fetchSecureData<{ url: string; call_id: string }>({
    action: "get_call_recording",
    params: { call_id: callId },
  });
}

/**
 * Check if a recording URL is a proxy URL that needs resolution
 */
export function isProxyRecordingUrl(url: string | null): boolean {
  return !!url && url.startsWith("proxy:recording:");
}

/**
 * Extract call ID from a proxy recording URL
 */
export function extractCallIdFromProxyUrl(url: string): string | null {
  if (!url.startsWith("proxy:recording:")) return null;
  return url.replace("proxy:recording:", "");
}

// ==========================================
// TASKS
// ==========================================

export async function fetchTasks(options?: { assignedTo?: string; status?: string }) {
  const params: Record<string, string> = {};
  if (options?.assignedTo) params.assigned_to = options.assignedTo;
  if (options?.status) params.status = options.status;
  
  return fetchSecureData<any[]>({
    action: "tasks",
    params,
  });
}
