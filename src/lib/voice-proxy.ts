/**
 * VOICE PROXY CLIENT
 * 
 * Secure client for accessing voice-AI platform data.
 * All data is sanitized server-side - no raw provider responses exposed.
 * 
 * Features:
 * - Strict response types (only exposed fields)
 * - Secure recording access via signed URLs
 * - Multi-tenant support
 * - Encoded data decoded for display
 */

import { supabase } from "@/integrations/supabase/client";
import { decodeEncodedValue } from "@/lib/decode-utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// ==========================================
// RESPONSE TYPES (matches sanitized backend response)
// ==========================================

export interface SanitizedCall {
  call_id: string;
  status: string;
  duration: number | null;
  summary: string | null;  // Encoded, decode before display
  outcome: string | null;
  display_cost: string | null;
  timestamps: {
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
  };
  sentiment?: string | null;
  connected?: boolean;
  has_recording?: boolean;
  has_transcript?: boolean;
  // Extended fields for detail view
  transcript?: string | null;  // Encoded, decode before display
  recording_url?: string | null;  // Signed URL, short-lived
}

export interface SanitizedExecution {
  execution_id: string;
  status: string;
  duration: number | null;
  summary: string | null;
  outcome: string | null;
  display_cost: string | null;
  timestamps: {
    started_at: string | null;
    ended_at: string | null;
  };
  transcript?: string | null;
  has_recording?: boolean;
  recording_url?: string | null;
}

export interface TodayStats {
  total: number;
  completed: number;
  connected: number;
  failed: number;
  in_progress: number;
  connection_rate: number;
  avg_duration: number;
}

export interface RecordingUrlResponse {
  url: string;
  expires_in: number;
}

// ==========================================
// API CLIENT
// ==========================================

interface VoiceProxyOptions {
  action: string;
  params?: Record<string, string>;
  tenantId?: string;
}

async function callVoiceProxy<T>(options: VoiceProxyOptions): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  
  if (!token) {
    throw new Error("Not authenticated");
  }

  const queryParams = new URLSearchParams({ action: options.action, ...options.params });
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  
  // Add tenant context if provided
  if (options.tenantId) {
    headers["x-tenant-id"] = options.tenantId;
  }
  
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/voice-proxy?${queryParams}`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
}

// ==========================================
// DECODE UTILITIES
// ==========================================

/**
 * Decode encoded fields in call data for display
 */
function decodeCallData(call: SanitizedCall): SanitizedCall {
  return {
    ...call,
    summary: call.summary ? decodeEncodedValue(call.summary) : null,
    transcript: call.transcript ? decodeEncodedValue(call.transcript) : null,
  };
}

/**
 * Decode encoded fields in execution data for display
 */
function decodeExecutionData(execution: SanitizedExecution): SanitizedExecution {
  return {
    ...execution,
    summary: execution.summary ? decodeEncodedValue(execution.summary) : null,
    transcript: execution.transcript ? decodeEncodedValue(execution.transcript) : null,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Fetch list of calls (sanitized)
 */
export async function fetchCalls(options?: {
  clientId?: string;
  startDate?: string;
  status?: string;
}): Promise<SanitizedCall[]> {
  const params: Record<string, string> = {};
  if (options?.clientId) params.client_id = options.clientId;
  if (options?.startDate) params.start_date = options.startDate;
  if (options?.status) params.status = options.status;
  
  const calls = await callVoiceProxy<SanitizedCall[]>({
    action: "get-calls",
    params,
  });
  
  // Decode encoded fields for display
  return calls.map(decodeCallData);
}

/**
 * Fetch single call details (sanitized)
 */
export async function fetchCallDetails(callId: string): Promise<SanitizedCall> {
  const call = await callVoiceProxy<SanitizedCall>({
    action: "get-call",
    params: { call_id: callId },
  });
  
  return decodeCallData(call);
}

/**
 * Fetch execution details from provider (sanitized)
 */
export async function fetchExecutionDetails(executionId: string): Promise<SanitizedExecution> {
  const execution = await callVoiceProxy<SanitizedExecution>({
    action: "get-execution",
    params: { execution_id: executionId },
  });
  
  return decodeExecutionData(execution);
}

/**
 * Get a short-lived signed URL for recording playback
 */
export async function getRecordingUrl(callId: string): Promise<RecordingUrlResponse> {
  return callVoiceProxy<RecordingUrlResponse>({
    action: "get-recording-url",
    params: { call_id: callId },
  });
}

/**
 * Fetch today's stats (admin only)
 */
export async function fetchTodayStats(): Promise<TodayStats> {
  return callVoiceProxy<TodayStats>({
    action: "get-today-stats",
  });
}

/**
 * Create an audio element with secure recording URL
 * Automatically fetches a new signed URL if needed
 */
export async function createSecureAudioElement(callId: string): Promise<HTMLAudioElement> {
  const { url } = await getRecordingUrl(callId);
  const audio = new Audio(url);
  return audio;
}

/**
 * Get outcome display text
 */
export function getOutcomeDisplay(outcome: string | null): { label: string; variant: "default" | "success" | "destructive" | "secondary" } {
  switch (outcome) {
    case "interested":
      return { label: "Interested", variant: "success" };
    case "not_interested":
      return { label: "Not Interested", variant: "destructive" };
    case "contacted":
      return { label: "Contacted", variant: "default" };
    case "no_contact":
      return { label: "No Contact", variant: "secondary" };
    case "no_answer":
      return { label: "No Answer", variant: "secondary" };
    case "failed":
      return { label: "Failed", variant: "destructive" };
    default:
      return { label: "Pending", variant: "secondary" };
  }
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
