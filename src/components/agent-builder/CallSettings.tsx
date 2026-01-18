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
import { Phone, Volume2 } from "lucide-react";
import { TELEPHONY_PROVIDERS, logProviderAction } from "@/lib/provider-masking";

const TELEPHONY_OPTIONS = Object.entries(TELEPHONY_PROVIDERS).map(([id, info]) => ({
  id,
  name: info.displayName,
  description: info.description,
}));

// Available ambient noise tracks from Bolna API
const AMBIENT_NOISE_TRACKS = [
  { id: "office-ambience", name: "Office Ambience", description: "Professional office background sounds" },
  { id: "cafe-ambience", name: "Café Ambience", description: "Coffee shop background noise" },
  { id: "call-center", name: "Call Center", description: "Busy call center environment" },
  { id: "outdoor-ambience", name: "Outdoor", description: "Light outdoor ambient sounds" },
];

export interface CallConfig {
  telephonyProvider: string;
  enableDtmf: boolean;
  noiseCancellation: boolean;
  noiseCancellationLevel: number;
  ambientNoise: boolean;
  ambientNoiseTrack: string;
}

interface CallSettingsProps {
  value: CallConfig;
  onChange: (config: CallConfig) => void;
}

export function CallSettings({ value, onChange }: CallSettingsProps) {
  const handleProviderChange = (provider: string) => {
    logProviderAction("Telephony provider changed", provider, "telephony");
    onChange({ ...value, telephonyProvider: provider });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Phone className="h-5 w-5" />
        <h2 className="font-bold">Call Settings</h2>
      </div>

      {/* Telephony Provider */}
      <div className="space-y-2">
        <Label>Telephony Provider</Label>
        <Select
          value={value.telephonyProvider}
          onValueChange={handleProviderChange}
        >
          <SelectTrigger className="border-2 w-[250px]">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {TELEPHONY_OPTIONS.map((provider) => (
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

      {/* DTMF Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-sm">Enable Keypad Inputs (DTMF)</h3>
        
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Allow caller to interact using keypad inputs.</p>
            <p className="text-xs text-muted-foreground">
              The agent can collect input from the caller using their phone keypad.
              The caller will be able to enter their input and press # to submit.
            </p>
          </div>
          <Switch
            checked={value.enableDtmf}
            onCheckedChange={(checked) => onChange({ ...value, enableDtmf: checked })}
          />
        </div>
      </div>

      {/* Noise Cancellation Section */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-semibold text-sm">Noise Cancellation</h3>
        
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Enables noise cancellation during the call</p>
            <p className="text-xs text-muted-foreground">
              Choose a noise cancellation level (default: 85)
            </p>
          </div>
          <Switch
            checked={value.noiseCancellation}
            onCheckedChange={(checked) => onChange({ ...value, noiseCancellation: checked })}
          />
        </div>

        {value.noiseCancellation && (
          <div className="space-y-3 pl-4">
            <div className="flex items-center justify-between">
              <Label>Noise cancellation level</Label>
              <span className="text-sm font-mono bg-muted px-2 py-0.5">{value.noiseCancellationLevel}</span>
            </div>
            <Slider
              value={[value.noiseCancellationLevel]}
              onValueChange={([level]) => onChange({ ...value, noiseCancellationLevel: level })}
              max={100}
              min={0}
              step={5}
              className="cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Ambient Background Noise Section */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          <h3 className="font-semibold text-sm">Background Noise</h3>
        </div>
        
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm">Add ambient background noise to calls</p>
            <p className="text-xs text-muted-foreground">
              Makes the agent sound more natural by adding realistic background sounds 
              like an office or call center environment.
            </p>
          </div>
          <Switch
            checked={value.ambientNoise}
            onCheckedChange={(checked) => onChange({ ...value, ambientNoise: checked })}
          />
        </div>

        {value.ambientNoise && (
          <div className="space-y-3 pl-4">
            <Label>Background Noise Type</Label>
            <Select
              value={value.ambientNoiseTrack}
              onValueChange={(track) => onChange({ ...value, ambientNoiseTrack: track })}
            >
              <SelectTrigger className="border-2 w-full">
                <SelectValue placeholder="Select ambient noise type" />
              </SelectTrigger>
              <SelectContent>
                {AMBIENT_NOISE_TRACKS.map((track) => (
                  <SelectItem key={track.id} value={track.id}>
                    <div className="flex flex-col">
                      <span>{track.name}</span>
                      <span className="text-xs text-muted-foreground">{track.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This background noise will be played on the agent's side during the call.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
