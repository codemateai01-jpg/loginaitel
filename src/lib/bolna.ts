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
// BOLNA V2 API TYPES
// ==========================================

// LLM Configuration
export interface SimpleLlmConfig {
  agent_flow_type?: "streaming";
  provider?: string;
  family?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  min_p?: number;
  top_k?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  base_url?: string;
  request_json?: boolean;
}

export interface VectorStoreConfig {
  provider: "lancedb";
  provider_config: {
    vector_id?: string;
    vector_ids?: string[];
  };
}

export interface KnowledgebaseLlmConfig extends SimpleLlmConfig {
  vector_store?: VectorStoreConfig;
}

export interface RouteConfig {
  route_name: string;
  utterances: string[];
  response: string | string[];
  score_threshold?: number;
}

export interface RoutesConfig {
  embedding_model?: string;
  routes?: RouteConfig[];
}

export interface LlmAgentConfig {
  agent_type?: "simple_llm_agent" | "knowledgebase_agent";
  agent_flow_type?: "streaming";
  llm_config: SimpleLlmConfig | KnowledgebaseLlmConfig;
  routes?: RoutesConfig;
}

// Synthesizer (TTS) Configuration
export interface ElevenLabsSynthConfig {
  voice: string;
  voice_id: string;
  model: "eleven_turbo_v2_5" | "eleven_flash_v2_5";
}

export interface CartesiaSynthConfig {
  voice: string;
  voice_id: string;
  model?: string;
}

export interface PollySynthConfig {
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
  provider: "elevenlabs" | "cartesia" | "polly" | "deepgram" | "styletts";
  provider_config: ElevenLabsSynthConfig | CartesiaSynthConfig | PollySynthConfig | DeepgramSynthConfig;
  stream?: boolean;
  buffer_size?: number;
  audio_format?: "wav";
}

// Transcriber (STT) Configuration
export interface DeepgramTranscriberConfig {
  provider: "deepgram";
  model: "nova-3" | "nova-2" | "nova-2-phonecall" | "nova-2-conversationalai";
  language: string;
  stream?: boolean;
  sampling_rate?: number;
  encoding?: "linear16";
  endpointing?: number;
}

export interface AzureTranscriberConfig {
  provider: "azure";
  language: string;
  stream?: boolean;
  sampling_rate?: number;
  encoding?: "linear16";
  endpointing?: number;
}

export interface SarvamTranscriberConfig {
  provider: "sarvam";
  language: string;
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

export type TranscriberConfig = DeepgramTranscriberConfig | AzureTranscriberConfig | SarvamTranscriberConfig | BodhiTranscriberConfig;

// Input/Output Configuration
export interface InputOutputConfig {
  provider: "twilio" | "plivo" | "exotel";
  format: "wav";
}

// Tools Configuration
export interface ToolsConfig {
  llm_agent: LlmAgentConfig;
  synthesizer: SynthesizerConfig;
  transcriber: TranscriberConfig;
  input: InputOutputConfig;
  output: InputOutputConfig;
  api_tools?: Record<string, unknown> | null;
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

// Agent Prompts (v2 API structure)
export interface AgentPrompts {
  task_1: {
    system_prompt: string;
  };
  [key: string]: { system_prompt: string };
}

// Agent Config (v2 API structure)
export interface AgentConfig {
  agent_name: string;
  agent_welcome_message?: string;
  webhook_url?: string;
  agent_type?: string;
  tasks: TaskConfig[];
  ingest_source_config?: {
    source_type: "api" | "csv" | "google_sheet";
    source_url?: string;
    source_auth_token?: string;
    source_name?: string;
  };
}

// Create Agent Request (v2 API - POST /v2/agent)
export interface CreateAgentRequest {
  agent_config: AgentConfig;
  agent_prompts: AgentPrompts;
}

// Create Agent Response
export interface CreateAgentResponse {
  agent_id: string;
  status: "created";
}

// Full Bolna Agent (GET /v2/agent/{id} response)
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

// ==========================================
// AGENT MANAGEMENT
// ==========================================

export async function listBolnaAgents(): Promise<BolnaResponse<BolnaAgent[]>> {
  return callBolnaProxy<BolnaAgent[]>("list-agents");
}

export async function getBolnaAgent(agentId: string): Promise<BolnaResponse<BolnaAgent>> {
  return callBolnaProxy<BolnaAgent>("get-agent", { agent_id: agentId });
}

export async function createBolnaAgent(config: CreateAgentRequest): Promise<BolnaResponse<CreateAgentResponse>> {
  return callBolnaProxy<CreateAgentResponse>("create-agent", undefined, config);
}

export async function updateBolnaAgent(
  agentId: string,
  config: Partial<CreateAgentRequest>
): Promise<BolnaResponse<BolnaAgent>> {
  return callBolnaProxy<BolnaAgent>("update-agent", { agent_id: agentId }, config);
}

// Update only the system prompt for an agent
export async function updateBolnaAgentPrompt(
  agentId: string,
  systemPrompt: string
): Promise<BolnaResponse<BolnaAgent>> {
  return callBolnaProxy<BolnaAgent>("update-agent", { agent_id: agentId }, {
    agent_prompts: {
      task_1: {
        system_prompt: systemPrompt,
      },
    },
  });
}

export async function deleteBolnaAgent(agentId: string): Promise<BolnaResponse<{ message: string; state: string }>> {
  return callBolnaProxy<{ message: string; state: string }>("delete-agent", { agent_id: agentId });
}

export interface StopAgentResponse {
  stopped_executions: string[];
}

export async function stopBolnaAgent(agentId: string): Promise<BolnaResponse<StopAgentResponse>> {
  return callBolnaProxy<StopAgentResponse>("stop-agent", { agent_id: agentId });
}

// ==========================================
// CALL MANAGEMENT (POST /call)
// ==========================================

export interface MakeCallRequest {
  lead_id: string;
  agent_id: string;
  client_id: string;
  from_phone_number?: string;
  user_data?: Record<string, string>;
}

export interface MakeCallResponse {
  success: boolean;
  execution_id: string;
  status: "queued";
  message: string;
}

export async function makeCall(options: MakeCallRequest): Promise<BolnaResponse<MakeCallResponse>> {
  return callBolnaProxy<MakeCallResponse>("make-call", undefined, options);
}

export async function getCallStatus(callId: string): Promise<BolnaResponse<Record<string, unknown>>> {
  return callBolnaProxy<Record<string, unknown>>("get-call-status", { call_id: callId });
}

export interface StopCallResponse {
  message: string;
  status: "stopped";
  execution_id: string;
}

export async function stopCall(executionId: string): Promise<BolnaResponse<StopCallResponse>> {
  return callBolnaProxy<StopCallResponse>("stop-call", { execution_id: executionId });
}

// ==========================================
// EXECUTION / CALL HISTORY
// ==========================================

export interface CostBreakdown {
  llm?: number;
  network?: number;
  platform?: number;
  synthesizer?: number;
  transcriber?: number;
}

export interface TelephonyData {
  duration?: string;
  to_number?: string;
  from_number?: string;
  recording_url?: string;
  hosted_telephony?: boolean;
  provider_call_id?: string;
  call_type?: "outbound" | "inbound";
  provider?: "twilio" | "plivo";
  hangup_by?: string;
  hangup_reason?: string;
  hangup_provider_code?: number;
}

export interface CallExecution {
  id: string;
  agent_id: string;
  batch_id?: string;
  conversation_time?: number;
  total_cost?: number;
  status: "completed" | "call-disconnected" | "no-answer" | "busy" | "failed" | "in-progress" | "canceled" | "balance-low" | "queued" | "ringing" | "initiated" | "stopped";
  error_message?: string;
  answered_by_voice_mail?: boolean;
  transcript?: string;
  created_at: string;
  updated_at?: string;
  cost_breakdown?: CostBreakdown;
  telephony_data?: TelephonyData;
  extracted_data?: Record<string, unknown>;
  context_details?: Record<string, unknown>;
}

export interface ExecutionLogEntry {
  created_at: string;
  type: "request" | "response";
  component: string;
  provider: string;
  data: string;
}

export interface ExecutionLogsResponse {
  data: ExecutionLogEntry[];
}

export interface ListExecutionsResponse {
  page_number: number;
  page_size: number;
  total: number;
  has_more: boolean;
  data: CallExecution[];
}

export interface ListExecutionsParams {
  agent_id: string;
  page_number?: number;
  page_size?: number;
  status?: string;
  call_type?: "inbound" | "outbound";
  provider?: "twilio" | "plivo" | "websocket" | "web-call";
  answered_by_voice_mail?: boolean;
  batch_id?: string;
  from?: string;
  to?: string;
}

export async function getExecution(executionId: string): Promise<BolnaResponse<CallExecution>> {
  return callBolnaProxy<CallExecution>("get-execution", { execution_id: executionId });
}

export async function getExecutionLogs(executionId: string): Promise<BolnaResponse<ExecutionLogsResponse>> {
  return callBolnaProxy<ExecutionLogsResponse>("get-execution-logs", { execution_id: executionId });
}

export async function listAgentExecutions(params: ListExecutionsParams): Promise<BolnaResponse<ListExecutionsResponse>> {
  const queryParams: Record<string, string> = { agent_id: params.agent_id };
  
  if (params.page_number !== undefined) queryParams.page_number = String(params.page_number);
  if (params.page_size !== undefined) queryParams.page_size = String(params.page_size);
  if (params.status) queryParams.status = params.status;
  if (params.call_type) queryParams.call_type = params.call_type;
  if (params.provider) queryParams.provider = params.provider;
  if (params.answered_by_voice_mail !== undefined) queryParams.answered_by_voice_mail = String(params.answered_by_voice_mail);
  if (params.batch_id) queryParams.batch_id = params.batch_id;
  if (params.from) queryParams.from = params.from;
  if (params.to) queryParams.to = params.to;
  
  return callBolnaProxy<ListExecutionsResponse>("list-agent-executions", queryParams);
}

// ==========================================
// BATCH MANAGEMENT
// ==========================================

export interface Batch {
  batch_id: string;
  humanized_created_at?: string;
  created_at: string;
  updated_at?: string;
  status: "scheduled" | "created" | "queued" | "executed";
  scheduled_at?: string;
  from_phone_number?: string;
  file_name?: string;
  valid_contacts?: number;
  total_contacts?: number;
  execution_status?: Record<string, number>;
}

export interface CreateBatchRequest {
  agent_id: string;
  csv_content: string;
  from_phone_number?: string;
}

export interface CreateBatchResponse {
  batch_id: string;
  state: "created";
}

export interface ScheduleBatchRequest {
  scheduled_at: string; // ISO 8601 format
}

export interface BatchActionResponse {
  message: string;
  state: string;
}

export async function createBatch(options: CreateBatchRequest): Promise<BolnaResponse<CreateBatchResponse>> {
  return callBolnaProxy<CreateBatchResponse>("create-batch", undefined, options);
}

export async function getBatch(batchId: string): Promise<BolnaResponse<Batch>> {
  return callBolnaProxy<Batch>("get-batch", { batch_id: batchId });
}

export async function listBatches(agentId: string): Promise<BolnaResponse<Batch[]>> {
  return callBolnaProxy<Batch[]>("list-batches", { agent_id: agentId });
}

export async function scheduleBatch(batchId: string, scheduledAt: string): Promise<BolnaResponse<BatchActionResponse>> {
  return callBolnaProxy<BatchActionResponse>("schedule-batch", { batch_id: batchId }, { scheduled_at: scheduledAt });
}

export async function stopBatch(batchId: string): Promise<BolnaResponse<BatchActionResponse>> {
  return callBolnaProxy<BatchActionResponse>("stop-batch", { batch_id: batchId });
}

export async function listBatchExecutions(batchId: string): Promise<BolnaResponse<CallExecution[]>> {
  return callBolnaProxy<CallExecution[]>("list-batch-executions", { batch_id: batchId });
}

export async function deleteBatch(batchId: string): Promise<BolnaResponse<BatchActionResponse>> {
  return callBolnaProxy<BatchActionResponse>("delete-batch", { batch_id: batchId });
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
// PHONE NUMBERS
// ==========================================

export interface AvailablePhoneNumber {
  region?: string;
  friendly_name?: string | null;
  locality?: string | null;
  phone_number: string;
  postal_code?: string | null;
  price: number;
}

export interface PhoneNumber {
  id: string;
  humanized_created_at?: string;
  created_at: string;
  humanized_updated_at?: string;
  updated_at?: string;
  renewal_at?: string;
  phone_number: string;
  agent_id?: string;
  price?: string;
  telephony_provider: "twilio" | "plivo" | "vonage";
  rented?: boolean;
}

export interface SearchPhoneNumbersParams {
  country: "US" | "IN";
  pattern?: string;
}

export async function searchPhoneNumbers(params: SearchPhoneNumbersParams): Promise<BolnaResponse<AvailablePhoneNumber[]>> {
  const queryParams: Record<string, string> = { country: params.country };
  if (params.pattern) queryParams.pattern = params.pattern;
  return callBolnaProxy<AvailablePhoneNumber[]>("search-phone-numbers", queryParams);
}

export async function listPhoneNumbers(): Promise<BolnaResponse<PhoneNumber[]>> {
  return callBolnaProxy<PhoneNumber[]>("list-phone-numbers");
}

export interface AssignPhoneNumberRequest {
  phone_number_id: string;
  agent_id: string | null; // null to unassign
}

export async function assignPhoneNumberToAgent(
  options: AssignPhoneNumberRequest
): Promise<BolnaResponse<{ message: string }>> {
  return callBolnaProxy<{ message: string }>("assign-phone-number", undefined, options);
}

// ==========================================
// HELPER: Build agent config for v2 API
// ==========================================

export interface BuildAgentOptions {
  name: string;
  systemPrompt: string;
  welcomeMessage?: string;
  // Voice config
  voiceProvider: "elevenlabs" | "cartesia";
  voiceId: string;
  voiceName: string;
  // LLM config
  llmProvider: string;
  llmFamily: string;
  llmModel: string;
  temperature: number;
  maxTokens: number;
  // Transcriber config
  transcriberProvider: "azure" | "sarvam";
  language: string;
  // Telephony config
  telephonyProvider: "twilio" | "plivo" | "exotel";
  // Conversation config
  hangupAfterSilence: number;
  callTerminate: number;
  interruptionWords: number;
  voicemailDetection: boolean;
  backchanneling: boolean;
  ambientNoise: boolean;
  ambientNoiseTrack: "office-ambience" | "coffee-shop" | "call-center";
  // Optional
  webhookUrl?: string;
}

export function buildAgentConfig(options: BuildAgentOptions): CreateAgentRequest {
  // Build synthesizer config based on provider
  const synthesizerConfig: SynthesizerConfig = options.voiceProvider === "cartesia"
    ? {
        provider: "cartesia",
        provider_config: {
          voice: options.voiceName,
          voice_id: options.voiceId,
          model: "sonic-2",
        } as CartesiaSynthConfig,
        stream: true,
        buffer_size: 250,
        audio_format: "wav",
      }
    : {
        provider: "elevenlabs",
        provider_config: {
          voice: options.voiceName,
          voice_id: options.voiceId,
          model: "eleven_turbo_v2_5",
        } as ElevenLabsSynthConfig,
        stream: true,
        buffer_size: 250,
        audio_format: "wav",
      };

  return {
    agent_config: {
      agent_name: options.name,
      agent_type: "other",
      agent_welcome_message: options.welcomeMessage,
      webhook_url: options.webhookUrl,
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
                agent_flow_type: "streaming",
                provider: options.llmProvider,
                family: options.llmFamily,
                model: options.llmModel,
                max_tokens: options.maxTokens,
                temperature: options.temperature,
              },
            },
            synthesizer: synthesizerConfig,
            transcriber: {
              provider: "deepgram",
              model: "nova-3",
              language: options.language,
              stream: true,
              sampling_rate: 16000,
              encoding: "linear16",
              endpointing: 250,
            },
            input: {
              provider: options.telephonyProvider,
              format: "wav",
            },
            output: {
              provider: options.telephonyProvider,
              format: "wav",
            },
          },
          task_config: {
            hangup_after_silence: options.hangupAfterSilence,
            call_terminate: options.callTerminate,
            voicemail: options.voicemailDetection,
            number_of_words_for_interruption: options.interruptionWords,
            backchanneling: options.backchanneling,
            ambient_noise: options.ambientNoise,
            ambient_noise_track: options.ambientNoiseTrack,
          },
        },
      ],
    },
    agent_prompts: {
      task_1: {
        system_prompt: options.systemPrompt,
      },
    },
  };
}
