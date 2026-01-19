import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Headphones, Volume2 } from "lucide-react";
import { TRANSCRIBER_PROVIDERS, VOICE_PROVIDERS, getTranscriberDisplayName, getVoiceDisplayName, logProviderAction } from "@/lib/provider-masking";

// Languages with auto-selection of STT provider
const LANGUAGES = [
  { id: "en", name: "English", sttProvider: "elevenlabs" },
  { id: "hi", name: "Hindi (हिन्दी)", sttProvider: "sarvam" },
  { id: "ta", name: "Tamil (தமிழ்)", sttProvider: "sarvam" },
  { id: "te", name: "Telugu (తెలుగు)", sttProvider: "sarvam" },
  { id: "kn", name: "Kannada (ಕನ್ನಡ)", sttProvider: "sarvam" },
  { id: "ml", name: "Malayalam (മലയാളം)", sttProvider: "sarvam" },
  { id: "mr", name: "Marathi (मराठी)", sttProvider: "sarvam" },
  { id: "bn", name: "Bengali (বাংলা)", sttProvider: "sarvam" },
  { id: "gu", name: "Gujarati (ગુજરાતી)", sttProvider: "sarvam" },
  { id: "pa", name: "Punjabi (ਪੰਜਾਬੀ)", sttProvider: "sarvam" },
  { id: "or", name: "Odia (ଓଡ଼ିଆ)", sttProvider: "sarvam" },
];

// Transcriber options with masked names
const TRANSCRIBER_OPTIONS = [
  { id: "sarvam", name: TRANSCRIBER_PROVIDERS.sarvam.displayName, description: TRANSCRIBER_PROVIDERS.sarvam.description, model: "saarika:v2" },
  { id: "elevenlabs", name: TRANSCRIBER_PROVIDERS.elevenlabs.displayName, description: TRANSCRIBER_PROVIDERS.elevenlabs.description, model: "scribe_v2_realtime" },
];

// Voice provider options with masked names
const VOICE_OPTIONS = [
  { id: "cartesia", name: VOICE_PROVIDERS.cartesia.displayName, description: VOICE_PROVIDERS.cartesia.description },
  { id: "elevenlabs", name: VOICE_PROVIDERS.elevenlabs.displayName, description: VOICE_PROVIDERS.elevenlabs.description },
];

// Cartesia voices (AiTel Voice)
const CARTESIA_VOICES = [
  { id: "a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbershop Man", gender: "male", accent: "American" },
  { id: "156fb8d2-335b-4950-9cb3-a2d33befec77", name: "Confident British Man", gender: "male", accent: "British" },
  { id: "79a125e8-cd45-4c13-8a67-188112f4dd22", name: "British Lady", gender: "female", accent: "British" },
  { id: "248be419-c632-4f23-adf1-5324ed7dbf1d", name: "Professional Woman", gender: "female", accent: "American" },
  { id: "c2ac25f9-ecc4-4f56-9095-651354df60c0", name: "Customer Service Lady", gender: "female", accent: "American" },
  { id: "f9836c6e-a0bd-460e-9d3c-f7299fa60f94", name: "Hindi Female", gender: "female", accent: "Indian" },
  { id: "638efaaa-4d0c-442e-b701-3fae16aad012", name: "Indian Male", gender: "male", accent: "Indian" },
];

// ElevenLabs voices (AiTel Voice Pro)
const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", accent: "American" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", accent: "British" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "male", accent: "American" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", accent: "British" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", accent: "British" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", accent: "British" },
];

export interface AudioConfig {
  language: string;
  transcriberProvider: string;
  transcriberModel: string;
  keywords: string;
  voiceProvider: string;
  voiceId: string;
  voiceName: string;
}

interface AudioSettingsProps {
  value: AudioConfig;
  onChange: (config: AudioConfig) => void;
}

export function AudioSettings({ value, onChange }: AudioSettingsProps) {
  const selectedLanguage = LANGUAGES.find((l) => l.id === value.language);
  const selectedTranscriber = TRANSCRIBER_OPTIONS.find((t) => t.id === value.transcriberProvider);
  const selectedVoiceProvider = VOICE_OPTIONS.find((v) => v.id === value.voiceProvider);
  const voices = value.voiceProvider === "cartesia" ? CARTESIA_VOICES : ELEVENLABS_VOICES;
  const selectedVoice = voices.find((v) => v.id === value.voiceId);

  const handleLanguageChange = (langId: string) => {
    const lang = LANGUAGES.find((l) => l.id === langId);
    if (lang) {
      const newProvider = lang.sttProvider as string;
      const transcriber = TRANSCRIBER_OPTIONS.find((t) => t.id === newProvider);
      logProviderAction("Language changed, auto-selecting transcriber", newProvider, "transcriber");
      onChange({
        ...value,
        language: langId,
        transcriberProvider: newProvider,
        transcriberModel: transcriber?.model || "scribe_v2_realtime",
      });
    }
  };

  const handleTranscriberChange = (providerId: string) => {
    const transcriber = TRANSCRIBER_OPTIONS.find((t) => t.id === providerId);
    logProviderAction("Transcriber changed", providerId, "transcriber");
    onChange({
      ...value,
      transcriberProvider: providerId,
      transcriberModel: transcriber?.model || "scribe_v2_realtime",
    });
  };

  const handleVoiceProviderChange = (providerId: string) => {
    const newVoices = providerId === "cartesia" ? CARTESIA_VOICES : ELEVENLABS_VOICES;
    logProviderAction("Voice provider changed", providerId, "voice");
    onChange({
      ...value,
      voiceProvider: providerId,
      voiceId: newVoices[0].id,
      voiceName: newVoices[0].name,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="h-5 w-5" />
        <h2 className="font-bold">Audio Configuration</h2>
      </div>

      {/* Language Selection */}
      <div className="space-y-2">
        <Label>Language</Label>
        <Select value={value.language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="border-2 w-[250px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.id} value={lang.id}>
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transcriber Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-sm">Select Transcriber</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={value.transcriberProvider} onValueChange={handleTranscriberChange}>
              <SelectTrigger className="border-2">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {TRANSCRIBER_OPTIONS.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex flex-col">
                      <span>{provider.name}</span>
                      <span className="text-xs text-muted-foreground">{provider.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={value.transcriberModel} disabled>
              <SelectTrigger className="border-2">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={value.transcriberModel}>
                  {selectedTranscriber?.model || value.transcriberModel}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Keywords */}
        <div className="space-y-2">
          <Label htmlFor="keywords">Keywords</Label>
          <Input
            id="keywords"
            placeholder="Bruce:100"
            value={value.keywords}
            onChange={(e) => onChange({ ...value, keywords: e.target.value })}
            className="border-2"
          />
          <p className="text-xs text-muted-foreground">
            Enter certain keywords/proper nouns you'd want to boost while understanding user speech
          </p>
        </div>
      </div>

      {/* Voice Section */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <h3 className="font-semibold text-sm">Select Voice</h3>
        </div>

        {/* Voice Provider Selection */}
        <RadioGroup
          value={value.voiceProvider}
          onValueChange={handleVoiceProviderChange}
          className="grid grid-cols-2 gap-3"
        >
          {VOICE_OPTIONS.map((provider) => (
            <div key={provider.id} className="relative">
              <RadioGroupItem value={provider.id} id={provider.id} className="peer sr-only" />
              <label
                htmlFor={provider.id}
                className="flex flex-col items-center justify-center p-4 border-2 border-border cursor-pointer hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent transition-all"
              >
                <span className="font-bold text-sm">{provider.name}</span>
                <span className="text-xs text-muted-foreground mt-1">{provider.description}</span>
              </label>
            </div>
          ))}
        </RadioGroup>

        {/* Voice Selection */}
        <div className="space-y-2">
          <Label>Select Voice</Label>
          <Select
            value={value.voiceId}
            onValueChange={(voiceId) => {
              const voice = voices.find((v) => v.id === voiceId);
              if (voice) {
                onChange({ ...value, voiceId, voiceName: voice.name });
              }
            }}
          >
            <SelectTrigger className="border-2">
              <SelectValue placeholder="Select a voice" />
            </SelectTrigger>
            <SelectContent>
              {voices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div className="flex items-center gap-2">
                    <span>{voice.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({voice.gender}, {voice.accent})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Voice Info */}
        {selectedVoice && (
          <div className="p-3 bg-muted/50 border border-border text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedVoice.name}</span>
              <div className="flex gap-2">
                <Badge variant="outline">{selectedVoice.gender}</Badge>
                <Badge variant="outline">{selectedVoice.accent}</Badge>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
