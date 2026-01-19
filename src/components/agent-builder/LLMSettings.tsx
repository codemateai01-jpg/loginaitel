import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

// LLM Models available
const LLM_MODELS = [
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai", family: "openai", description: "Fast & cost-effective (Default)" },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai", family: "openai", description: "Balanced performance" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", family: "openai", description: "High accuracy" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", family: "openai", description: "Multimodal capable" },
];

export interface LLMConfig {
  model: string;
  provider: string;
  family: string;
  temperature: number;
  maxTokens: number;
}

interface LLMSettingsProps {
  value: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

export function LLMSettings({ value, onChange }: LLMSettingsProps) {
  const selectedModel = LLM_MODELS.find((m) => m.id === value.model);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5" />
        <h2 className="font-bold">LLM Settings</h2>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={value.model}
          onValueChange={(modelId) => {
            const model = LLM_MODELS.find((m) => m.id === modelId);
            if (model) {
              onChange({
                ...value,
                model: model.id,
                provider: model.provider,
                family: model.family,
              });
            }
          }}
        >
          <SelectTrigger className="border-2">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {LLM_MODELS.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.id === "gpt-4.1-nano" && (
                      <Badge variant="default" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Temperature */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Temperature</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5">
            {value.temperature.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[value.temperature]}
          onValueChange={([temp]) => onChange({ ...value, temperature: temp })}
          max={1}
          min={0}
          step={0.1}
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          Lower = more focused, Higher = more creative
        </p>
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <Label htmlFor="maxTokens">Max Tokens</Label>
        <Input
          id="maxTokens"
          type="number"
          min={50}
          max={4000}
          value={value.maxTokens}
          onChange={(e) => onChange({ ...value, maxTokens: parseInt(e.target.value) || 150 })}
          className="border-2"
        />
        <p className="text-xs text-muted-foreground">
          Maximum response length (50-4000)
        </p>
      </div>

      {/* Model Info */}
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

export { LLM_MODELS };
