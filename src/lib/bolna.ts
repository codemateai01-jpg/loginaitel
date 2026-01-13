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
// BOLNA V2 AGENT TYPES
// ==========================================

// LLM Configuration
export interface SimpleLlmAgent {
  agent_flow_type?: "streaming";
  provider?: string;
  family?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  base_url?: string;
}

export interface VectorStore {
  provider: "lancedb";
  provider_config: {
    vector_id?: string;
    vector_ids?: string[];
  };
}

export interface KnowledgebaseAgent extends SimpleLlmAgent {
  vector_store?: VectorStore;
}

export interface LlmAgentConfig {
  agent_type?: "simple_llm_agent" | "knowledgebase_agent";
  agent_flow_type?: "streaming";
  llm_config?: SimpleLlmAgent | KnowledgebaseAgent;
  routes?: {
    embedding_model?: string;
    routes?: Array<{
      route_name: string;
      utterances: string[];
      response: string | string[];
      score_threshold?: number;
    }>;
  };
}

// Synthesizer (TTS) Configuration
export interface ElevenLabsConfig {
  voice: string;
  voice_id: string;
  model: "eleven_turbo_v2_5" | "eleven_flash_v2_5";
}

export interface PollyConfig {
  voice: string;
  engine: string;
  language: string;
  sampling_rate?: string;
}

export interface DeepgramSynthConfig {
  voice: string;
  model: string;
  sampling_rate?: string;
}

export interface SynthesizerConfig {
  provider: "elevenlabs" | "polly" | "deepgram" | "styletts";
  provider_config: ElevenLabsConfig | PollyConfig | DeepgramSynthConfig;
  stream?: boolean;
  buffer_size?: number;
  audio_format?: "wav";
}

// Transcriber (STT) Configuration
export interface DeepgramTranscriberConfig {
  provider: "deepgram";
  model: "nova-3" | "nova-2" | "nova-2-phonecall" | "nova-2-conversationalai";
  language: "en" | "hi" | "es" | "fr";
  stream?: boolean;
  sampling_rate?: number;
  encoding?: "linear16";
  endpointing?: number;
}

export interface BodhiTranscriberConfig {
  provider: "bodhi";
  model: string;
  language: "hi" | "kn" | "mr" | "ta" | "bn";
  stream?: boolean;
  sampling_rate?: number;
  encoding?: "linear16";
  endpointing?: number;
}

export type TranscriberConfig = DeepgramTranscriberConfig | BodhiTranscriberConfig;

// Input/Output Configuration
export interface InputOutputConfig {
  provider: "twilio" | "plivo" | "exotel";
  format: "wav";
}

// API Tools Configuration
export interface TransferCallTool {
  name: string;
  key: "transfer_call";
  description: string;
  parameters?: Record<string, unknown>;
}

export interface ApiToolsConfig {
  tools?: TransferCallTool[];
  tools_params?: Record<string, {
    method?: "POST" | "GET";
    url?: string;
    api_token?: string;
    param?: string;
  }>;
}

// Tools Configuration
export interface ToolsConfig {
  llm_agent: LlmAgentConfig;
  synthesizer: SynthesizerConfig;
  transcriber: TranscriberConfig;
  input: InputOutputConfig;
  output: InputOutputConfig;
  api_tools?: ApiToolsConfig | null;
}

// Conversation Configuration
export interface ConversationConfig {
  hangup_after_silence?: number;
  incremental_delay?: number;
  number_of_words_for_interruption?: number;
  hangup_after_LLMCall?: boolean;
  call_cancellation_prompt?: string | null;
  backchanneling?: boolean;
  backchanneling_message_gap?: number;
  backchanneling_start_delay?: number;
  ambient_noise?: boolean;
  ambient_noise_track?: "office-ambience" | "coffee-shop" | "call-center";
  call_terminate?: number;
  voicemail?: boolean;
  inbound_limit?: number;
  whitelist_phone_numbers?: string[];
  disallow_unknown_numbers?: boolean;
}

// Toolchain Configuration
export interface ToolchainConfig {
  execution: "parallel" | "sequential";
  pipelines: string[][];
}

// Task Configuration
export interface TaskConfig {
  task_type: "conversation" | "extraction" | "summarization";
  tools_config: ToolsConfig;
  toolchain: ToolchainConfig;
  task_config?: ConversationConfig;
}

// Agent Prompts
export interface AgentPrompts {
  task_1?: {
    system_prompt: string;
  };
  [key: string]: { system_prompt: string } | undefined;
}

// Full Bolna Agent (V2 API)
export interface BolnaAgent {
  id: string;
  agent_name: string;
  agent_type: string;
  agent_status?: "seeding" | "processed";
  created_at?: string;
  updated_at?: string;
  tasks?: TaskConfig[];
  agent_prompts?: AgentPrompts;
  ingest_source_config?: {
    source_type: "api" | "csv" | "google_sheet";
    source_url?: string;
    source_auth_token?: string;
    source_name?: string;
  };
}

// Create Agent Request
export interface CreateAgentRequest {
  agent_name: string;
  agent_type?: string;
  agent_welcome_message?: string;
  tasks: TaskConfig[];
  agent_prompts?: AgentPrompts;
}

// ==========================================
// AGENT MANAGEMENT
// ==========================================

export async function listBolnaAgents(): Promise<BolnaResponse<BolnaAgent[]>> {
  return callBolnaProxy<BolnaAgent[]>("list-agents");
}

export async function getBolnaAgent(agentId: string): Promise<BolnaResponse<BolnaAgent>> {
  return callBolnaProxy<BolnaAgent>("get-agent", { agent_id: agentId });
}

export async function createBolnaAgent(config: CreateAgentRequest): Promise<BolnaResponse<{ agent_id: string }>> {
  return callBolnaProxy<{ agent_id: string }>("create-agent", undefined, config);
}

export async function updateBolnaAgent(
  agentId: string,
  config: Partial<CreateAgentRequest>
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

// ==========================================
// HELPER: Build default agent config
// ==========================================

export function buildDefaultAgentConfig(options: {
  name: string;
  systemPrompt: string;
  welcomeMessage?: string;
  voiceId?: string;
  voiceName?: string;
  language?: "en" | "hi" | "es" | "fr";
}): CreateAgentRequest {
  return {
    agent_name: options.name,
    agent_type: "other",
    agent_welcome_message: options.welcomeMessage,
    tasks: [
      {
        task_type: "conversation",
        toolchain: {
          execution: "parallel",
          pipelines: [["transcriber", "llm", "synthesizer"]],
        },
        tools_config: {
          llm_agent: {
            agent_type: "simple_llm_agent",
            agent_flow_type: "streaming",
            llm_config: {
              provider: "openai",
              family: "openai",
              model: "gpt-4.1-mini",
              max_tokens: 150,
              temperature: 0.1,
            },
          },
          synthesizer: {
            provider: "elevenlabs",
            provider_config: {
              voice: options.voiceName || "Nila",
              voice_id: options.voiceId || "V9LCAAi4tTlqe9JadbCo",
              model: "eleven_turbo_v2_5",
            },
            stream: true,
            buffer_size: 250,
            audio_format: "wav",
          },
          transcriber: {
            provider: "deepgram",
            model: "nova-3",
            language: options.language || "en",
            stream: true,
            sampling_rate: 16000,
            encoding: "linear16",
            endpointing: 250,
          },
          input: {
            provider: "plivo",
            format: "wav",
          },
          output: {
            provider: "plivo",
            format: "wav",
          },
        },
        task_config: {
          hangup_after_silence: 10,
          call_terminate: 90,
          voicemail: true,
          number_of_words_for_interruption: 2,
          backchanneling: true,
        },
      },
    ],
    agent_prompts: {
      task_1: {
        system_prompt: options.systemPrompt,
      },
    },
  };
}
