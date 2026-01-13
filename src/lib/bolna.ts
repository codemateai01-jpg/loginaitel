import { supabase } from "@/integrations/supabase/client";

const BOLNA_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bolna-proxy`;

interface BolnaResponse<T> {
  data: T | null;
  error: string | null;
}

async function callBolnaProxy<T>(
  action: string,
  params?: Record<string, string>,
  body?: unknown
): Promise<BolnaResponse<T>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { data: null, error: "Not authenticated" };
    }

    const url = new URL(BOLNA_PROXY_URL);
    url.searchParams.set("action", action);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: body ? "POST" : "GET",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: data.error || "Request failed" };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ==========================================
// AGENT MANAGEMENT
// ==========================================

export interface BolnaAgent {
  id: string;
  agent_name: string;
  agent_type: string;
  agent_welcome_message?: string;
  created_at?: string;
}

export interface CreateAgentConfig {
  agent_name: string;
  agent_type: string;
  agent_welcome_message?: string;
  tasks?: Array<{
    task_type: string;
    toolchain: {
      execution: string;
      pipelines: string[][];
    };
    tools_config: Record<string, unknown>;
  }>;
}

export async function listBolnaAgents(): Promise<BolnaResponse<BolnaAgent[]>> {
  return callBolnaProxy<BolnaAgent[]>("list-agents");
}

export async function getBolnaAgent(agentId: string): Promise<BolnaResponse<BolnaAgent>> {
  return callBolnaProxy<BolnaAgent>("get-agent", { agent_id: agentId });
}

export async function createBolnaAgent(config: CreateAgentConfig): Promise<BolnaResponse<{ agent_id: string }>> {
  return callBolnaProxy<{ agent_id: string }>("create-agent", undefined, config);
}

export async function updateBolnaAgent(
  agentId: string,
  config: Partial<CreateAgentConfig>
): Promise<BolnaResponse<BolnaAgent>> {
  return callBolnaProxy<BolnaAgent>("update-agent", { agent_id: agentId }, config);
}

export async function deleteBolnaAgent(agentId: string): Promise<BolnaResponse<{ success: boolean }>> {
  return callBolnaProxy<{ success: boolean }>("delete-agent", { agent_id: agentId });
}

// ==========================================
// CALL MANAGEMENT
// ==========================================

export interface MakeCallOptions {
  lead_id: string;
  agent_id: string;
  client_id: string;
  call_options?: {
    max_duration?: number;
    webhook_url?: string;
  };
}

export interface CallResult {
  success: boolean;
  call_id: string;
}

export async function makeCall(options: MakeCallOptions): Promise<BolnaResponse<CallResult>> {
  return callBolnaProxy<CallResult>("make-call", undefined, options);
}

export async function getCallStatus(callId: string): Promise<BolnaResponse<Record<string, unknown>>> {
  return callBolnaProxy<Record<string, unknown>>("get-call-status", { call_id: callId });
}

export async function endCall(callId: string): Promise<BolnaResponse<{ success: boolean }>> {
  return callBolnaProxy<{ success: boolean }>("end-call", { call_id: callId });
}

// ==========================================
// EXECUTION / CALL HISTORY
// ==========================================

export interface CallExecution {
  id: string;
  agent_id: string;
  duration: number;
  status: string;
  transcript?: string;
  recording_url?: string;
  created_at: string;
}

export async function getExecution(executionId: string): Promise<BolnaResponse<CallExecution>> {
  return callBolnaProxy<CallExecution>("get-execution", { execution_id: executionId });
}

export async function listExecutions(agentId?: string): Promise<BolnaResponse<CallExecution[]>> {
  const params = agentId ? { agent_id: agentId } : undefined;
  return callBolnaProxy<CallExecution[]>("list-executions", params);
}

// ==========================================
// VOICES
// ==========================================

export interface BolnaVoice {
  id: string;
  name: string;
  provider: string;
  language?: string;
  gender?: string;
}

export async function listVoices(): Promise<BolnaResponse<BolnaVoice[]>> {
  return callBolnaProxy<BolnaVoice[]>("list-voices");
}
