import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain } from "lucide-react";

// LLM Models - No masking needed per user request
const LLM_MODELS = [
  // OpenAI Models
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", provider: "openai", family: "openai", description: "Fast & cost-effective", isDefault: true },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai", family: "openai", description: "Balanced performance" },
  { id: "gpt-4.1", name: "GPT-4.1", provider: "openai", family: "openai", description: "High accuracy" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", family: "openai", description: "Multimodal capable" },
  // Groq Models (Custom LLM)
  { id: "llama-maverick-17b-128e-instruct", name: "Llama Maverick 17B 128E", provider: "groq", family: "custom", description: "Ultra-fast inference via Groq" },
];

export interface LLMConfigAdvanced {
  model: string;
  provider: string;
  family: string;
  temperature: number;
  maxTokens: number;
}

interface LLMSettingsAdvancedProps {
  value: LLMConfigAdvanced;
  onChange: (config: LLMConfigAdvanced) => void;
}

export function LLMSettingsAdvanced({ value, onChange }: LLMSettingsAdvancedProps) {
  const selectedModel = LLM_MODELS.find((m) => m.id === value.model);

  // Group models by provider
  const openaiModels = LLM_MODELS.filter((m) => m.provider === "openai");
  const groqModels = LLM_MODELS.filter((m) => m.provider === "groq");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5" />
        <h2 className="font-bold">LLM Configuration</h2>
      </div>

      {/* Provider & Model Selection */}
      <div className="space-y-4">
        <Label>Choose LLM model</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            value={selectedModel?.provider || "openai"}
            onValueChange={(provider) => {
              const models = provider === "openai" ? openaiModels : groqModels;
              const firstModel = models[0];
              if (firstModel) {
                onChange({
                  ...value,
                  model: firstModel.id,
                  provider: firstModel.provider,
                  family: firstModel.family,
                });
              }
            }}
          >
            <SelectTrigger className="border-2">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="groq">Groq</SelectItem>
            </SelectContent>
          </Select>

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
              {(selectedModel?.provider === "groq" ? groqModels : openaiModels).map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.isDefault && (
                      <Badge variant="default" className="text-xs">Default</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedModel && (
          <p className="text-xs text-muted-foreground">{selectedModel.description}</p>
        )}
      </div>

      {/* Max Tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Tokens generated on each LLM output</Label>
            <span className="text-sm font-mono bg-muted px-2 py-0.5">{value.maxTokens}</span>
          </div>
          <Slider
            value={[value.maxTokens]}
            onValueChange={([tokens]) => onChange({ ...value, maxTokens: tokens })}
            max={2000}
            min={50}
            step={50}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Increasing tokens enables longer responses to be queued for speech generation but increases latency
          </p>
        </div>

        {/* Temperature */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <span className="text-sm font-mono bg-muted px-2 py-0.5">{value.temperature.toFixed(1)}</span>
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
            Increasing temperature enables heightened creativity, but increases chance of deviation from prompt
          </p>
        </div>
      </div>

      {/* Knowledge Base Section - Placeholder */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-sm">Add knowledge base (Multi-select)</h3>
        <Select disabled>
          <SelectTrigger className="border-2 w-[300px]">
            <SelectValue placeholder="Select knowledge bases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No knowledge bases available</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* FAQs & Guardrails - Placeholder */}
      <div className="space-y-2 pt-4 border-t">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Add FAQs & Guardrails</h3>
          <a href="#" className="text-primary text-xs hover:underline">Learn more</a>
        </div>
      </div>
    </div>
  );
}

export { LLM_MODELS };
