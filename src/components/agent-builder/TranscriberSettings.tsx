import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mic } from "lucide-react";

const TRANSCRIBER_MODELS = [
  { id: "nova-3", name: "Nova 3", provider: "deepgram", description: "Latest & most accurate" },
  { id: "nova-2", name: "Nova 2", provider: "deepgram", description: "High quality" },
  { id: "nova-2-phonecall", name: "Nova 2 (Phone Call)", provider: "deepgram", description: "Optimized for phone calls" },
  { id: "nova-2-conversationalai", name: "Nova 2 (Conversational AI)", provider: "deepgram", description: "Optimized for AI conversations" },
];

const LANGUAGES = [
  { id: "en", name: "English" },
  { id: "hi", name: "Hindi" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
];

export interface TranscriberConfig {
  model: string;
  language: string;
}

interface TranscriberSettingsProps {
  value: TranscriberConfig;
  onChange: (config: TranscriberConfig) => void;
}

export function TranscriberSettings({ value, onChange }: TranscriberSettingsProps) {
  const selectedModel = TRANSCRIBER_MODELS.find((m) => m.id === value.model);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Mic className="h-5 w-5" />
        <h2 className="font-bold">Transcriber (STT)</h2>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={value.model}
          onValueChange={(model) => onChange({ ...value, model })}
        >
          <SelectTrigger className="border-2">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {TRANSCRIBER_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <span>{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
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
      {selectedModel && (
        <div className="p-3 bg-muted/50 border border-border text-xs">
          <p className="text-muted-foreground">
            Provider: <span className="font-medium capitalize">{selectedModel.provider}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export { TRANSCRIBER_MODELS, LANGUAGES };
