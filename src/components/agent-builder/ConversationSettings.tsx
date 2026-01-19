import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MessageSquare, ChevronDown } from "lucide-react";
import { useState } from "react";

export interface ConversationConfig {
  hangupAfterSilence: number;
  callTerminate: number;
  interruptionWords: number;
  voicemailDetection: boolean;
  backchanneling: boolean;
  ambientNoise: boolean;
  ambientNoiseTrack: "office-ambience" | "coffee-shop" | "call-center";
}

interface ConversationSettingsProps {
  value: ConversationConfig;
  onChange: (config: ConversationConfig) => void;
}

export function ConversationSettings({ value, onChange }: ConversationSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 border-2 border-border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <span className="font-bold">Conversation Settings</span>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="border-2 border-border border-t-0 bg-card p-4 space-y-6">
        {/* Timing Settings */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hangupSilence">Hangup After Silence (seconds)</Label>
            <Input
              id="hangupSilence"
              type="number"
              min={5}
              max={60}
              value={value.hangupAfterSilence}
              onChange={(e) =>
                onChange({ ...value, hangupAfterSilence: parseInt(e.target.value) || 10 })
              }
              className="border-2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="callTerminate">Max Call Duration (seconds)</Label>
            <Input
              id="callTerminate"
              type="number"
              min={30}
              max={600}
              value={value.callTerminate}
              onChange={(e) =>
                onChange({ ...value, callTerminate: parseInt(e.target.value) || 90 })
              }
              className="border-2"
            />
          </div>
        </div>

        {/* Interruption Words */}
        <div className="space-y-2">
          <Label htmlFor="interruptWords">Words Before Interruption</Label>
          <Input
            id="interruptWords"
            type="number"
            min={1}
            max={10}
            value={value.interruptionWords}
            onChange={(e) =>
              onChange({ ...value, interruptionWords: parseInt(e.target.value) || 2 })
            }
            className="border-2"
          />
          <p className="text-xs text-muted-foreground">
            How many words user must speak before agent can be interrupted
          </p>
        </div>

        {/* Toggle Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="voicemail">Voicemail Detection</Label>
              <p className="text-xs text-muted-foreground">
                Auto-disconnect if voicemail detected
              </p>
            </div>
            <Switch
              id="voicemail"
              checked={value.voicemailDetection}
              onCheckedChange={(checked) =>
                onChange({ ...value, voicemailDetection: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="backchanneling">Backchanneling</Label>
              <p className="text-xs text-muted-foreground">
                Agent acknowledges while user speaks
              </p>
            </div>
            <Switch
              id="backchanneling"
              checked={value.backchanneling}
              onCheckedChange={(checked) =>
                onChange({ ...value, backchanneling: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ambientNoise">Ambient Noise</Label>
              <p className="text-xs text-muted-foreground">
                Add background noise for naturalism
              </p>
            </div>
            <Switch
              id="ambientNoise"
              checked={value.ambientNoise}
              onCheckedChange={(checked) =>
                onChange({ ...value, ambientNoise: checked })
              }
            />
          </div>
        </div>

        {/* Ambient Noise Track */}
        {value.ambientNoise && (
          <div className="space-y-2">
            <Label>Ambient Noise Track</Label>
            <Select
              value={value.ambientNoiseTrack}
              onValueChange={(track: "office-ambience" | "coffee-shop" | "call-center") =>
                onChange({ ...value, ambientNoiseTrack: track })
              }
            >
              <SelectTrigger className="border-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office-ambience">Office Ambience</SelectItem>
                <SelectItem value="coffee-shop">Coffee Shop</SelectItem>
                <SelectItem value="call-center">Call Center</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
