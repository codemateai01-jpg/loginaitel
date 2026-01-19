import { AgentConfig as BuilderConfig, GuardrailBlock } from "@/components/agent-builder/AgentBuilder";
import {
    CreateAgentRequest,
    AgentConfig,
    AgentPrompts,
    TaskConfig,
    ToolsConfig,
    SimpleLlmConfig,
    RouteConfig,
    RoutesConfig,
} from "@/lib/aitel";

/**
 * Transforms AgentBuilder config to Bolna API format
 */
export function transformToBolnaConfig(
    agentName: string,
    builderConfig: BuilderConfig
): CreateAgentRequest {
    // Build LLM config
    const llmConfig: SimpleLlmConfig = {
        agent_flow_type: "streaming",
        provider: mapProviderToBolna(builderConfig.llmProvider),
        model: builderConfig.llmModel,
        max_tokens: builderConfig.maxTokens,
        temperature: builderConfig.temperature,
    };

    // Build routes from guardrails
    const routes: RoutesConfig | undefined = builderConfig.guardrails.length > 0
        ? {
            embedding_model: "text-embedding-3-small",
            routes: builderConfig.guardrails.map(transformGuardrailToRoute),
        }
        : undefined;

    // Build tools config
    const toolsConfig: ToolsConfig = {
        llm_agent: {
            agent_type: "simple_llm_agent",
            agent_flow_type: "streaming",
            llm_config: llmConfig,
            routes,
        },
        synthesizer: {
            provider: mapVoiceProviderToBolna(builderConfig.voiceProvider) as "elevenlabs" | "cartesia" | "polly" | "deepgram",
            provider_config: {
                voice: builderConfig.voiceId || "rachel",
                voice_id: builderConfig.voiceId || "rachel",
                model: "eleven_turbo_v2_5",
            } as any,
            stream: true,
            buffer_size: 100,
        },
        transcriber: {
            provider: "deepgram",
            model: "nova-2-phonecall",
            language: "en",
            stream: true,
            endpointing: 400,
        },
        input: {
            provider: "twilio",
            format: "wav",
        },
        output: {
            provider: "twilio",
            format: "wav",
        },
    };

    // Build task config
    const tasks: TaskConfig[] = [
        {
            task_type: "conversation",
            tools_config: toolsConfig,
            toolchain: {
                execution: "parallel",
                pipelines: [
                    ["transcriber", "llm_agent", "synthesizer"],
                ],
            },
            task_config: {
                hangup_after_LLMCall: false,
                hangup_after_silence: 10,
                call_cancellation_prompt: null,
                backchanneling: false,
                ambient_noise: false,
                call_terminate: 30,
                voicemail: false,
            },
        },
    ];

    // Build agent config
    const agentConfig: AgentConfig = {
        agent_name: agentName,
        agent_welcome_message: builderConfig.welcomeMessage,
        webhook_url: `${window.location.origin}/api/webhooks/bolna`,
        agent_type: "other",
        tasks,
    };

    // Build agent prompts
    const agentPrompts: AgentPrompts = {
        task_1: {
            system_prompt: builderConfig.agentPrompt,
        },
    };

    return {
        agent_config: agentConfig,
        agent_prompts: agentPrompts,
    };
}

/**
 * Transform guardrail block to Bolna route
 */
function transformGuardrailToRoute(guardrail: GuardrailBlock): RouteConfig {
    return {
        route_name: guardrail.name,
        utterances: guardrail.utterances.filter(u => u.trim().length > 0),
        response: guardrail.response,
        score_threshold: guardrail.threshold,
    };
}

/**
 * Map UI provider names to Bolna provider names
 */
function mapProviderToBolna(provider: string): string {
    const mapping: Record<string, string> = {
        "azure": "azure",
        "openai": "openai",
        "anthropic": "anthropic",
        "together": "together",
    };
    return mapping[provider] || "openai";
}

/**
 * Map UI voice provider to Bolna voice provider
 */
function mapVoiceProviderToBolna(provider: string): string {
    const mapping: Record<string, string> = {
        "elevenlabs": "elevenlabs",
        "azure": "azure",
        "google": "google",
        "amazon": "polly",
    };
    return mapping[provider] || "elevenlabs";
}
