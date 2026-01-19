import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mic } from "lucide-react";

// Transcriber providers - using Deepgram nova-3 for best quality
const TRANSCRIBER_PROVIDERS = [
  { id: "deepgram", name: "Aitel Transcriber Pro", description: "Nova-3 - Highest accuracy", model: "nova-3" },
  { id: "deepgram-phonecall", name: "Aitel Transcriber Phonecall", description: "Optimized for phone audio", model: "nova-2-phonecall" },
];

// Regional + English languages
const LANGUAGES = [
  { id: "en", name: "English" },
  { id: "hi", name: "Hindi (हिन्दी)" },
  { id: "ta", name: "Tamil (தமிழ்)" },
  { id: "te", name: "Telugu (తెలుగు)" },
  { id: "kn", name: "Kannada (ಕನ್ನಡ)" },
  { id: "ml", name: "Malayalam (മലയാളം)" },
  { id: "mr", name: "Marathi (मराठी)" },
  { id: "bn", name: "Bengali (বাংলা)" },
  { id: "gu", name: "Gujarati (ગુજરાતી)" },
  { id: "pa", name: "Punjabi (ਪੰਜਾਬੀ)" },
  { id: "or", name: "Odia (ଓଡ଼ିଆ)" },
];

export interface TranscriberConfig {
  provider: string;
  model: string;
  language: string;
}

interface TranscriberSettingsProps {
  value: TranscriberConfig;
  onChange: (config: TranscriberConfig) => void;
}

export function TranscriberSettings({ value, onChange }: TranscriberSettingsProps) {
  const selectedProvider = TRANSCRIBER_PROVIDERS.find((p) => p.id === value.provider);
  const selectedLanguage = LANGUAGES.find((l) => l.id === value.language);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Mic className="h-5 w-5" />
        <h2 className="font-bold">Transcriber (STT)</h2>
      </div>

      {/* Provider Selection */}
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select
          value={value.provider}
          onValueChange={(providerId) => {
            const provider = TRANSCRIBER_PROVIDERS.find(p => p.id === providerId);
            onChange({ ...value, provider: "deepgram", model: provider?.model || "nova-3" });
          }}
        >
          <SelectTrigger className="border-2">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {TRANSCRIBER_PROVIDERS.map((provider) => (
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

      {/* Language Selection */}
      <div className="space-y-2">
        <Label>Language</Label>
        <Select
          value={value.language}
          onValueChange={(language) => onChange({ ...value, language })}
        >
          <SelectTrigger className="border-2">
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

      {/* Provider Info */}
      {selectedProvider && selectedLanguage && (
        <div className="p-3 bg-muted/50 border border-border text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Provider:</span>
            <Badge variant="secondary">{selectedProvider.name}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Language:</span>
            <span className="font-medium">{selectedLanguage.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { TRANSCRIBER_PROVIDERS, LANGUAGES };
