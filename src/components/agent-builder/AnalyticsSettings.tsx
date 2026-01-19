import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3 } from "lucide-react";

export interface AnalyticsConfig {
  autoReschedule: boolean;
  summarization: boolean;
  extraction: boolean;
  extractionPrompt: string;
}

interface AnalyticsSettingsProps {
  value: AnalyticsConfig;
  onChange: (config: AnalyticsConfig) => void;
}

export function AnalyticsSettings({ value, onChange }: AnalyticsSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5" />
        <h2 className="font-bold">Analytics & Post Call Tasks</h2>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <h3 className="font-semibold text-sm">Post call tasks</h3>
        <p className="text-sm text-muted-foreground">
          Choose tasks to get executed after the agent conversation is complete
        </p>
      </div>

      {/* Auto Reschedule */}
      <div className="space-y-4 pt-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Auto reschedule</p>
            <p className="text-xs text-muted-foreground">
              Automatically reschedule the call if the user asks to be called at a specific time
            </p>
          </div>
          <Switch
            checked={value.autoReschedule}
            onCheckedChange={(checked) => onChange({ ...value, autoReschedule: checked })}
          />
        </div>
      </div>

      {/* Summarization */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Summarization</p>
            <p className="text-xs text-muted-foreground">
              Generate a summary of the conversation automatically.
            </p>
          </div>
          <Switch
            checked={value.summarization}
            onCheckedChange={(checked) => onChange({ ...value, summarization: checked })}
          />
        </div>
      </div>

      {/* Extraction */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <p className="font-medium text-sm">Extraction</p>
            <p className="text-xs text-muted-foreground">
              Extract structured data from the conversation based on your custom prompt
            </p>
          </div>
          <Switch
            checked={value.extraction}
            onCheckedChange={(checked) => onChange({ ...value, extraction: checked })}
          />
        </div>

        {value.extraction && (
          <div className="space-y-2 pl-4">
            <Label htmlFor="extractionPrompt">Extraction Prompt</Label>
            <Textarea
              id="extractionPrompt"
              placeholder={`user_name : Yield the name of the user.\n\npayment_mode : If user is paying by cash, yield cash. If they are paying by card...`}
              value={value.extractionPrompt}
              onChange={(e) => onChange({ ...value, extractionPrompt: e.target.value })}
              className="border-2 min-h-[120px] font-mono text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
}
