/**
 * Provider Masking Utility
 * Maps real provider IDs to display names for UI and console masking
 * Real provider names should NEVER be exposed to the frontend
 */

// Telephony Provider Masking
export const TELEPHONY_PROVIDERS = {
  plivo: { displayName: "Tata Tele", description: "Enterprise telephony" },
  exotel: { displayName: "AiTel", description: "India-focused" },
  twilio: { displayName: "Global Connect", description: "Global coverage" },
} as const;

// Transcriber (STT) Provider Masking
export const TRANSCRIBER_PROVIDERS = {
  sarvam: { displayName: "AiTel STT 01", description: "Regional languages (Tamil, Hindi)", languages: ["ta", "hi", "te", "kn", "ml", "mr", "bn", "gu", "pa", "or"] },
  elevenlabs: { displayName: "AiTel STT 02", description: "English optimized", languages: ["en"] },
  deepgram: { displayName: "AiTel STT Pro", description: "Nova-3 - Highest accuracy", languages: ["en", "hi", "ta"] },
} as const;

// Voice (TTS) Provider Masking
export const VOICE_PROVIDERS = {
  cartesia: { displayName: "AiTel Voice", description: "Low latency, natural voices" },
  elevenlabs: { displayName: "AiTel Voice Pro", description: "Premium quality voices" },
} as const;

// LLM Providers - No masking needed per user request
export const LLM_PROVIDERS = {
  openai: { displayName: "OpenAI", description: "GPT models" },
  groq: { displayName: "Groq", description: "Ultra-fast inference" },
  custom: { displayName: "Custom LLM", description: "Custom endpoint" },
} as const;

// Helper functions
export function getTelephonyDisplayName(providerId: string): string {
  return TELEPHONY_PROVIDERS[providerId as keyof typeof TELEPHONY_PROVIDERS]?.displayName || providerId;
}

export function getTranscriberDisplayName(providerId: string): string {
  return TRANSCRIBER_PROVIDERS[providerId as keyof typeof TRANSCRIBER_PROVIDERS]?.displayName || providerId;
}

export function getVoiceDisplayName(providerId: string): string {
  return VOICE_PROVIDERS[providerId as keyof typeof VOICE_PROVIDERS]?.displayName || providerId;
}

// Get transcriber based on selected language
export function getRecommendedTranscriber(language: string): keyof typeof TRANSCRIBER_PROVIDERS {
  const sarvamLangs = TRANSCRIBER_PROVIDERS.sarvam.languages as readonly string[];
  if (sarvamLangs.includes(language) && language !== "en") {
    return "sarvam";
  }
  return "elevenlabs";
}

// Console-safe logging that masks provider names
export function logProviderAction(action: string, providerId: string, category: "telephony" | "transcriber" | "voice" | "llm") {
  let displayName = providerId;
  switch (category) {
    case "telephony":
      displayName = getTelephonyDisplayName(providerId);
      break;
    case "transcriber":
      displayName = getTranscriberDisplayName(providerId);
      break;
    case "voice":
      displayName = getVoiceDisplayName(providerId);
      break;
    case "llm":
      displayName = providerId; // No masking for LLM
      break;
  }
  console.log(`[Agent Builder] ${action}: ${displayName}`);
}
