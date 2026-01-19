import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneIncoming, ExternalLink } from "lucide-react";

const DATA_SOURCES = [
  { id: "none", name: "Select data source" },
  { id: "google_sheets", name: "Google Sheets" },
  { id: "api", name: "Custom API" },
  { id: "csv", name: "CSV Upload" },
];

export interface InboundConfig {
  dataSource: string;
  restrictToDatabase: boolean;
}

interface InboundSettingsProps {
  value: InboundConfig;
  onChange: (config: InboundConfig) => void;
}

export function InboundSettings({ value, onChange }: InboundSettingsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <PhoneIncoming className="h-5 w-5" />
        <h2 className="font-bold">Inbound Agent Settings</h2>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground">
        Tweak your inbound agents and add your call settings for receiving incoming calls.
      </p>

      {/* Database Section */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-center">
          <div className="border-t border-border flex-1" />
          <span className="px-4 text-xs text-muted-foreground uppercase tracking-wider">
            Database for inbound phone numbers
          </span>
          <div className="border-t border-border flex-1" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">
              Match incoming calls to users and preload their data before the call starts
            </p>
            <a href="#" className="text-primary text-xs flex items-center gap-1 hover:underline">
              See examples and learn more <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          <Select
            value={value.dataSource}
            onValueChange={(source) => onChange({ ...value, dataSource: source })}
          >
            <SelectTrigger className="border-2 w-[250px]">
              <SelectValue placeholder="Select data source" />
            </SelectTrigger>
            <SelectContent>
              {DATA_SOURCES.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Restrict Calls */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Allow incoming phone calls only from the chosen database</p>
            <p className="text-xs text-muted-foreground">
              Only allow incoming calls from the numbers you'll source from above.
              All other phone calls will be blocked.
            </p>
          </div>
          <Switch
            checked={value.restrictToDatabase}
            onCheckedChange={(checked) => onChange({ ...value, restrictToDatabase: checked })}
          />
        </div>
      </div>
    </div>
  );
}
