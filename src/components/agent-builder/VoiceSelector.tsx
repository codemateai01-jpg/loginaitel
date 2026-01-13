import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Volume2 } from "lucide-react";

// Cartesia voices (Aitel Voice)
const CARTESIA_VOICES = [
  { id: "a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbershop Man", gender: "male", accent: "American" },
  { id: "156fb8d2-335b-4950-9cb3-a2d33befec77", name: "Confident British Man", gender: "male", accent: "British" },
  { id: "79a125e8-cd45-4c13-8a67-188112f4dd22", name: "British Lady", gender: "female", accent: "British" },
  { id: "248be419-c632-4f23-adf1-5324ed7dbf1d", name: "Professional Woman", gender: "female", accent: "American" },
  { id: "c2ac25f9-ecc4-4f56-9095-651354df60c0", name: "Customer Service Lady", gender: "female", accent: "American" },
  { id: "f9836c6e-a0bd-460e-9d3c-f7299fa60f94", name: "Hindi Female", gender: "female", accent: "Indian" },
  { id: "638efaaa-4d0c-442e-b701-3fae16aad012", name: "Indian Male", gender: "male", accent: "Indian" },
];

// ElevenLabs voices (Rented Voice)
const ELEVENLABS_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", accent: "American" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", accent: "British" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "male", accent: "American" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", accent: "British" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", accent: "British" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", accent: "British" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "male", accent: "American" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", accent: "American" },
];

export type VoiceProvider = "cartesia" | "elevenlabs";

export interface VoiceConfig {
  provider: VoiceProvider;
  voiceId: string;
  voiceName: string;
}

interface VoiceSelectorProps {
  value: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
}

export function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const voices = value.provider === "cartesia" ? CARTESIA_VOICES : ELEVENLABS_VOICES;
  const selectedVoice = voices.find((v) => v.id === value.voiceId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Volume2 className="h-5 w-5" />
        <h2 className="font-bold">Voice Configuration</h2>
      </div>

      {/* Voice Type Selection */}
      <div className="space-y-2">
        <Label>Voice Type</Label>
        <RadioGroup
          value={value.provider}
          onValueChange={(provider: VoiceProvider) => {
            const newVoices = provider === "cartesia" ? CARTESIA_VOICES : ELEVENLABS_VOICES;
            onChange({
              provider,
              voiceId: newVoices[0].id,
              voiceName: newVoices[0].name,
            });
          }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="relative">
            <RadioGroupItem value="cartesia" id="cartesia" className="peer sr-only" />
            <label
              htmlFor="cartesia"
              className="flex flex-col items-center justify-center p-4 border-2 border-border cursor-pointer hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent transition-all"
            >
              <span className="font-bold text-sm">Aitel Voice</span>
              <Badge variant="secondary" className="mt-1 text-xs">
                Cartesia
              </Badge>
            </label>
          </div>
          <div className="relative">
            <RadioGroupItem value="elevenlabs" id="elevenlabs" className="peer sr-only" />
            <label
              htmlFor="elevenlabs"
              className="flex flex-col items-center justify-center p-4 border-2 border-border cursor-pointer hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-accent transition-all"
            >
              <span className="font-bold text-sm">Rented Voice</span>
              <Badge variant="secondary" className="mt-1 text-xs">
                ElevenLabs
              </Badge>
            </label>
          </div>
        </RadioGroup>
      </div>

      {/* Voice Selection */}
      <div className="space-y-2">
        <Label>Select Voice</Label>
        <Select
          value={value.voiceId}
          onValueChange={(voiceId) => {
            const voice = voices.find((v) => v.id === voiceId);
            if (voice) {
              onChange({
                ...value,
                voiceId,
                voiceName: voice.name,
              });
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
  );
}

export { CARTESIA_VOICES, ELEVENLABS_VOICES };
