/**
 * Agent Builder Hook
 * Handles CRUD operations for agents via Bolna API with local DB sync
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  listAitelAgents,
  getAitelAgent,
  createAitelAgent,
  updateAitelAgent,
  deleteAitelAgent,
  type AitelAgent,
  type CreateAgentRequest,
  type AgentConfig,
  type TaskConfig,
  type SimpleLlmConfig,
  type SynthesizerConfig,
  type TranscriberConfig,
  type InputOutputConfig,
} from "@/lib/aitel";
import { logProviderAction } from "@/lib/provider-masking";

// Full agent configuration from the UI
export interface AgentFullConfig {
  agent: {
    welcomeMessage: string;
    systemPrompt: string;
  };
  llm: {
    model: string;
    provider: string;
    family: string;
    temperature: number;
    maxTokens: number;
  };
  audio: {
    language: string;
    transcriberProvider: string;
    transcriberModel: string;
    keywords: string;
    voiceProvider: string;
    voiceId: string;
    voiceName: string;
  };
  engine: {
    preciseTranscript: boolean;
    interruptWords: number;
    responseRate: string;
  };
  call: {
    telephonyProvider: string;
    enableDtmf: boolean;
    noiseCancellation: boolean;
    noiseCancellationLevel: number;
  };
  tools: {
    selectedFunctions: string[];
  };
  analytics: {
    autoReschedule: boolean;
    summarization: boolean;
    extraction: boolean;
    extractionPrompt: string;
  };
  inbound: {
    dataSource: string;
    restrictToDatabase: boolean;
  };
}

// Local agent record from aitel_agents table
interface LocalAgent {
  id: string;
  external_agent_id: string;
  agent_name: string;
  status: string;
  client_id: string | null;
  engineer_id: string | null;
  agent_config: unknown;
  current_system_prompt: string | null;
  original_system_prompt: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

// Convert UI config to Bolna API format
function convertToBolnaFormat(
  name: string,
  config: AgentFullConfig
): CreateAgentRequest {
  // Build LLM config
  const llmConfig: SimpleLlmConfig = {
    agent_flow_type: "streaming",
    provider: config.llm.provider,
    family: config.llm.family,
    model: config.llm.model,
    max_tokens: config.llm.maxTokens,
    temperature: config.llm.temperature,
  };

  // Handle Groq custom LLM
  if (config.llm.provider === "groq") {
    llmConfig.provider = "custom";
    llmConfig.family = "custom";
    llmConfig.base_url = "https://api.groq.com/openai/v1";
  }

  // Build synthesizer config based on voice provider
  let synthesizerConfig: SynthesizerConfig;
  if (config.audio.voiceProvider === "cartesia") {
    synthesizerConfig = {
      provider: "cartesia",
      provider_config: {
        voice: config.audio.voiceName,
        voice_id: config.audio.voiceId,
      },
      stream: true,
      buffer_size: 100,
      audio_format: "wav",
    };
  } else {
    synthesizerConfig = {
      provider: "elevenlabs",
      provider_config: {
        voice: config.audio.voiceName,
        voice_id: config.audio.voiceId,
        model: "eleven_turbo_v2_5",
      },
      stream: true,
      buffer_size: 100,
      audio_format: "wav",
    };
  }

  // Build transcriber config based on provider
  let transcriberConfig: TranscriberConfig;
  if (config.audio.transcriberProvider === "sarvam") {
    transcriberConfig = {
      provider: "sarvam",
      language: config.audio.language,
      stream: true,
      sampling_rate: 16000,
      encoding: "linear16",
    };
  } else if (config.audio.transcriberProvider === "deepgram") {
    transcriberConfig = {
      provider: "deepgram",
      model: "nova-3",
      language: config.audio.language,
      stream: true,
      sampling_rate: 16000,
      encoding: "linear16",
    };
  } else {
    // ElevenLabs transcriber - use deepgram as fallback since ElevenLabs STT may not be available
    transcriberConfig = {
      provider: "deepgram",
      model: "nova-3",
      language: config.audio.language,
      stream: true,
      sampling_rate: 16000,
      encoding: "linear16",
    };
  }

  // Build input/output config based on telephony provider
  const telephonyProvider = config.call.telephonyProvider as "plivo" | "exotel" | "twilio";
  const ioConfig: InputOutputConfig = {
    provider: telephonyProvider,
    format: "wav",
  };

  // Build task config
  const taskConfig: TaskConfig = {
    task_type: "conversation",
    toolchain: {
      execution: "parallel",
      pipelines: [["transcriber", "llm", "synthesizer"]],
    },
    tools_config: {
      llm_agent: {
        agent_type: "simple_llm_agent",
        agent_flow_type: "streaming",
        llm_config: llmConfig,
      },
      synthesizer: synthesizerConfig,
      transcriber: transcriberConfig,
      input: ioConfig,
      output: ioConfig,
    },
    task_config: {
      hangup_after_silence: 15,
      number_of_words_for_interruption: config.engine.interruptWords,
      call_terminate: 1800,
      ambient_noise: config.call.noiseCancellation,
    },
  };

  // Add summarization task if enabled
  const tasks: TaskConfig[] = [taskConfig];

  if (config.analytics.summarization) {
    tasks.push({
      task_type: "summarization",
      toolchain: {
        execution: "parallel",
        pipelines: [["llm"]],
      },
      tools_config: {
        llm_agent: {
          agent_type: "simple_llm_agent",
          llm_config: {
            provider: "openai",
            model: "gpt-4.1-nano",
            max_tokens: 500,
          },
        },
        synthesizer: synthesizerConfig,
        transcriber: transcriberConfig,
        input: ioConfig,
        output: ioConfig,
      },
    });
  }

  if (config.analytics.extraction && config.analytics.extractionPrompt) {
    tasks.push({
      task_type: "extraction",
      toolchain: {
        execution: "parallel",
        pipelines: [["llm"]],
      },
      tools_config: {
        llm_agent: {
          agent_type: "simple_llm_agent",
          llm_config: {
            provider: "openai",
            model: "gpt-4.1-nano",
            max_tokens: 500,
          },
        },
        synthesizer: synthesizerConfig,
        transcriber: transcriberConfig,
        input: ioConfig,
        output: ioConfig,
      },
    });
  }

  // Build agent config
  const agentConfig: AgentConfig = {
    agent_name: name,
    agent_welcome_message: config.agent.welcomeMessage,
    agent_type: "lead_qualification",
    tasks,
  };

  return {
    agent_config: agentConfig,
    agent_prompts: {
      task_1: {
        system_prompt: config.agent.systemPrompt,
      },
    },
  };
}

// Convert Bolna agent to UI config
function convertFromBolnaFormat(agent: AitelAgent): Partial<AgentFullConfig> {
  const config: Partial<AgentFullConfig> = {};

  // Extract welcome message and system prompt
  const agentAny = agent as unknown as Record<string, unknown>;
  config.agent = {
    welcomeMessage: (agentAny.agent_welcome_message as string) || "Hello",
    systemPrompt: agent.agent_prompts?.task_1?.system_prompt || "",
  };

  // Extract from first task if available
  if (agent.tasks && agent.tasks.length > 0) {
    const task = agent.tasks[0];
    const toolsConfig = task.tools_config;

    if (toolsConfig) {
      // LLM config
      const llmConfig = toolsConfig.llm_agent?.llm_config;
      if (llmConfig) {
        config.llm = {
          model: llmConfig.model || "gpt-4.1-nano",
          provider: llmConfig.provider || "openai",
          family: llmConfig.family || "openai",
          temperature: llmConfig.temperature || 0.2,
          maxTokens: llmConfig.max_tokens || 450,
        };
      }

      // Audio config
      const synthConfig = toolsConfig.synthesizer;
      const transConfig = toolsConfig.transcriber as unknown as Record<string, unknown> | undefined;
      const synthProviderConfig = synthConfig?.provider_config as unknown as Record<string, unknown> | undefined;
      
      if (synthConfig || transConfig) {
        config.audio = {
          language: (transConfig?.language as string) || "en",
          transcriberProvider: (transConfig?.provider as string) || "deepgram",
          transcriberModel: (transConfig?.model as string) || "nova-3",
          keywords: "",
          voiceProvider: synthConfig?.provider || "cartesia",
          voiceId: (synthProviderConfig?.voice_id as string) || "",
          voiceName: (synthProviderConfig?.voice as string) || "",
        };
      }

      // Call config
      const ioConfig = toolsConfig.input;
      if (ioConfig) {
        config.call = {
          telephonyProvider: ioConfig.provider || "plivo",
          enableDtmf: false,
          noiseCancellation: !!task.task_config?.ambient_noise,
          noiseCancellationLevel: 85,
        };
      }

      // Engine config
      if (task.task_config) {
        config.engine = {
          preciseTranscript: false,
          interruptWords: task.task_config.number_of_words_for_interruption || 2,
          responseRate: "rapid",
        };
      }
    }
  }

  return config;
}

export function useAgentBuilder() {
  const queryClient = useQueryClient();

  // Fetch agents from local database (synced with Bolna)
  const {
    data: agents = [],
    isLoading: isLoadingAgents,
    error: agentsError,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["aitel-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LocalAgent[];
    },
  });

  // Sync agents from Bolna API to local database
  const syncAgentsMutation = useMutation({
    mutationFn: async () => {
      logProviderAction("Syncing agents from API", "all", "telephony");
      
      const result = await listAitelAgents();
      if (result.error) throw new Error(result.error);
      if (!result.data) return [];

      // Upsert each agent to local database
      for (const agent of result.data) {
        const { error } = await supabase
          .from("aitel_agents")
          .upsert(
            {
              external_agent_id: agent.id,
              agent_name: agent.agent_name,
              status: agent.agent_status || "processed",
              current_system_prompt: agent.agent_prompts?.task_1?.system_prompt || null,
              agent_config: null, // Will be populated when editing
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "external_agent_id" }
          );

        if (error) {
          console.error("Failed to sync agent:", agent.id, error);
        }
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aitel-agents"] });
      toast.success("Agents synced successfully");
    },
    onError: (error) => {
      toast.error("Failed to sync agents: " + (error as Error).message);
    },
  });

  // Create a new agent
  const createAgentMutation = useMutation({
    mutationFn: async ({ name, config }: { name: string; config: AgentFullConfig }) => {
      logProviderAction("Creating agent", name, "telephony");

      const bolnaRequest = convertToBolnaFormat(name, config);
      const result = await createAitelAgent(bolnaRequest);

      if (result.error) throw new Error(result.error);
      if (!result.data) throw new Error("No response from API");

      // Save to local database
      const { data: localAgent, error: dbError } = await supabase
        .from("aitel_agents")
        .insert([{
          external_agent_id: result.data.agent_id,
          agent_name: name,
          status: "active",
          agent_config: JSON.parse(JSON.stringify(config)),
          current_system_prompt: config.agent.systemPrompt,
          original_system_prompt: config.agent.systemPrompt,
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      return localAgent as LocalAgent;
    },
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["aitel-agents"] });
      toast.success(`Agent "${agent.agent_name}" created successfully`);
    },
    onError: (error) => {
      toast.error("Failed to create agent: " + (error as Error).message);
    },
  });

  // Update an existing agent
  const updateAgentMutation = useMutation({
    mutationFn: async ({
      id,
      externalId,
      name,
      config,
    }: {
      id: string;
      externalId: string;
      name: string;
      config: AgentFullConfig;
    }) => {
      logProviderAction("Updating agent", name, "telephony");

      const bolnaRequest = convertToBolnaFormat(name, config);
      const result = await updateAitelAgent(externalId, bolnaRequest);

      if (result.error) throw new Error(result.error);

      // Update local database
      const { data: localAgent, error: dbError } = await supabase
        .from("aitel_agents")
        .update({
          agent_name: name,
          agent_config: JSON.parse(JSON.stringify(config)),
          current_system_prompt: config.agent.systemPrompt,
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (dbError) throw dbError;

      return localAgent as LocalAgent;
    },
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["aitel-agents"] });
      toast.success(`Agent "${agent.agent_name}" updated successfully`);
    },
    onError: (error) => {
      toast.error("Failed to update agent: " + (error as Error).message);
    },
  });

  // Delete an agent
  const deleteAgentMutation = useMutation({
    mutationFn: async ({ id, externalId }: { id: string; externalId: string }) => {
      logProviderAction("Deleting agent", id, "telephony");

      // Delete from Bolna first
      const result = await deleteAitelAgent(externalId);
      if (result.error) throw new Error(result.error);

      // Delete from local database
      const { error: dbError } = await supabase
        .from("aitel_agents")
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aitel-agents"] });
      toast.success("Agent deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete agent: " + (error as Error).message);
    },
  });

  // Make a test call with an agent
  const makeTestCall = useCallback(async (
    externalAgentId: string,
    phoneNumber: string
  ): Promise<{ success: boolean; message: string; executionId?: string }> => {
    logProviderAction("Making test call", externalAgentId, "telephony");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, message: "Not authenticated" };
      }

      // Call Bolna API directly for test calls (no credit deduction)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aitel-proxy?action=test-call`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agent_id: externalAgentId,
            phone_number: phoneNumber,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { 
          success: false, 
          message: data.error || "Failed to initiate test call" 
        };
      }

      return { 
        success: true, 
        message: "Call initiated successfully",
        executionId: data.execution_id,
      };
    } catch (error) {
      console.error("Test call error:", error);
      return { 
        success: false, 
        message: (error as Error).message || "Failed to initiate test call" 
      };
    }
  }, []);

  // Stop an active call
  const stopCall = useCallback(async (executionId: string): Promise<void> => {
    logProviderAction("Stopping call", executionId, "telephony");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aitel-proxy?action=stop-call&execution_id=${executionId}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to stop call");
      }
    } catch (error) {
      console.error("Stop call error:", error);
      throw error;
    }
  }, []);

  // Fetch a single agent with full config from Bolna
  const fetchAgentDetails = useCallback(async (externalId: string): Promise<AgentFullConfig | null> => {
    logProviderAction("Fetching agent details", externalId, "telephony");

    const result = await getAitelAgent(externalId);
    if (result.error || !result.data) {
      toast.error("Failed to fetch agent details");
      return null;
    }

    const partialConfig = convertFromBolnaFormat(result.data);
    
    // Merge with default config for missing fields
    return {
      agent: partialConfig.agent || { welcomeMessage: "Hello", systemPrompt: "" },
      llm: partialConfig.llm || { model: "gpt-4.1-nano", provider: "openai", family: "openai", temperature: 0.2, maxTokens: 450 },
      audio: partialConfig.audio || { language: "en", transcriberProvider: "elevenlabs", transcriberModel: "scribe_v2_realtime", keywords: "", voiceProvider: "cartesia", voiceId: "", voiceName: "" },
      engine: partialConfig.engine || { preciseTranscript: false, interruptWords: 2, responseRate: "rapid" },
      call: partialConfig.call || { telephonyProvider: "plivo", enableDtmf: false, noiseCancellation: true, noiseCancellationLevel: 85 },
      tools: { selectedFunctions: [] },
      analytics: { autoReschedule: false, summarization: false, extraction: false, extractionPrompt: "" },
      inbound: { dataSource: "none", restrictToDatabase: false },
    };
  }, []);

  return {
    agents,
    isLoadingAgents,
    agentsError,
    refetchAgents,
    syncAgents: syncAgentsMutation.mutate,
    isSyncing: syncAgentsMutation.isPending,
    createAgent: createAgentMutation.mutateAsync,
    isCreating: createAgentMutation.isPending,
    updateAgent: updateAgentMutation.mutateAsync,
    isUpdating: updateAgentMutation.isPending,
    deleteAgent: deleteAgentMutation.mutateAsync,
    isDeleting: deleteAgentMutation.isPending,
    fetchAgentDetails,
    makeTestCall,
    stopCall,
  };
}
