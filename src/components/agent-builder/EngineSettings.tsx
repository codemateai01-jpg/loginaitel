import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cog } from "lucide-react";

const RESPONSE_RATES = [
  { id: "rapid", name: "Rapid", description: "Minimum latency, may interrupt users" },
  { id: "balanced", name: "Balanced", description: "Good balance of speed and accuracy" },
  { id: "careful", name: "Careful", description: "Waits for user to finish speaking" },
];

export interface EngineConfig {
  preciseTranscript: boolean;
  interruptWords: number;
  responseRate: string;
}

interface EngineSettingsProps {
  value: EngineConfig;
  onChange: (config: EngineConfig) => void;
}

export function EngineSettings({ value, onChange }: EngineSettingsProps) {
  const selectedRate = RESPONSE_RATES.find((r) => r.id === value.responseRate);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Cog className="h-5 w-5" />
        <h2 className="font-bold">Engine Settings</h2>
      </div>

      {/* Transcription & Interruptions Section */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">Transcription & Interruptions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Precise Transcript */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Generate precise transcript</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent will try to generate more precise transcripts during interruptions
                </p>
              </div>
              <Switch
                checked={value.preciseTranscript}
                onCheckedChange={(checked) => onChange({ ...value, preciseTranscript: checked })}
              />
            </div>
          </div>

          {/* Interrupt Words */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Number of words to wait for before interrupting</Label>
              <span className="text-sm font-mono bg-muted px-2 py-0.5">{value.interruptWords}</span>
            </div>
            <Slider
              value={[value.interruptWords]}
              onValueChange={([words]) => onChange({ ...value, interruptWords: words })}
              max={10}
              min={1}
              step={1}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Agent will not consider interruptions until {value.interruptWords} words are spoken. 
              (If recipient says "Stopwords" such as Stop, Wait, Hold On, agent will pause by default)
            </p>
          </div>
        </div>
      </div>

      {/* Voice Response Rate Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-sm">Voice Response Rate Configuration</h3>
        
        <div className="space-y-2">
          <Label>Response Rate</Label>
          <Select
            value={value.responseRate}
            onValueChange={(rate) => onChange({ ...value, responseRate: rate })}
          >
            <SelectTrigger className="border-2 w-[200px]">
              <SelectValue placeholder="Select rate" />
            </SelectTrigger>
            <SelectContent>
              {RESPONSE_RATES.map((rate) => (
                <SelectItem key={rate.id} value={rate.id}>
                  {rate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRate && (
          <div className="p-3 bg-muted/50 border border-border text-sm">
            <p className="text-muted-foreground">{selectedRate.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
