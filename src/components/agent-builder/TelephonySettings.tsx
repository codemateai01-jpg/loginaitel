import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone } from "lucide-react";

const TELEPHONY_PROVIDERS = [
  { id: "plivo", name: "Plivo", description: "Default provider" },
  { id: "twilio", name: "Twilio", description: "Global coverage" },
  { id: "exotel", name: "Exotel", description: "India-focused" },
];

export interface TelephonyConfig {
  provider: "twilio" | "plivo" | "exotel";
}

interface TelephonySettingsProps {
  value: TelephonyConfig;
  onChange: (config: TelephonyConfig) => void;
}

export function TelephonySettings({ value, onChange }: TelephonySettingsProps) {
  const selectedProvider = TELEPHONY_PROVIDERS.find((p) => p.id === value.provider);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Phone className="h-5 w-5" />
        <h2 className="font-bold">Telephony</h2>
      </div>

      <div className="space-y-2">
        <Label>Provider</Label>
        <Select
          value={value.provider}
          onValueChange={(provider: "twilio" | "plivo" | "exotel") =>
            onChange({ provider })
          }
        >
          <SelectTrigger className="border-2">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {TELEPHONY_PROVIDERS.map((provider) => (
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

      {/* Provider Info */}
      {selectedProvider && (
        <div className="p-3 bg-muted/50 border border-border text-xs">
          <p className="text-muted-foreground">{selectedProvider.description}</p>
        </div>
      )}
    </div>
  );
}

export { TELEPHONY_PROVIDERS };
