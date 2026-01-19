import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench, Plus, X, ExternalLink } from "lucide-react";

const AVAILABLE_FUNCTIONS = [
  { id: "check_slot_availability", name: "Check slot availability (using Cal.com)", description: "Check available time slots" },
  { id: "book_appointment", name: "Book appointments (using Cal.com)", description: "Schedule appointments" },
  { id: "transfer_call", name: "Transfer call to a human agent", description: "Hand off to human support" },
  { id: "custom", name: "Add your own custom function", description: "Define custom API endpoints" },
];

export interface ToolsConfig {
  selectedFunctions: string[];
}

interface ToolsSettingsProps {
  value: ToolsConfig;
  onChange: (config: ToolsConfig) => void;
}

export function ToolsSettings({ value, onChange }: ToolsSettingsProps) {
  const [selectedFunction, setSelectedFunction] = useState("");

  const handleAddFunction = () => {
    if (selectedFunction && !value.selectedFunctions.includes(selectedFunction)) {
      onChange({
        selectedFunctions: [...value.selectedFunctions, selectedFunction],
      });
      setSelectedFunction("");
    }
  };

  const handleRemoveFunction = (funcId: string) => {
    onChange({
      selectedFunctions: value.selectedFunctions.filter((f) => f !== funcId),
    });
  };

  const getFunction = (id: string) => AVAILABLE_FUNCTIONS.find((f) => f.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="h-5 w-5" />
        <h2 className="font-bold">Function Tools</h2>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Function Tools for LLM Models</h3>
          <a href="#" className="text-primary text-xs flex items-center gap-1 hover:underline">
            See examples and learn more <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect external tools or APIs that your language model can call during conversations.
          This allows the LLM to retrieve real-time data, perform calculations, or trigger actions dynamically.
        </p>
      </div>

      {/* Function Selection */}
      <div className="space-y-3">
        <Label>Choose functions</Label>
        <div className="flex gap-2">
          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="border-2 flex-1">
              <SelectValue placeholder="Select functions" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_FUNCTIONS.filter((f) => !value.selectedFunctions.includes(f.id)).map((func) => (
                <SelectItem key={func.id} value={func.id}>
                  {func.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddFunction} disabled={!selectedFunction} className="gap-1">
            <Plus className="h-4 w-4" />
            Add function
          </Button>
        </div>
      </div>

      {/* Selected Functions */}
      {value.selectedFunctions.length > 0 && (
        <div className="space-y-2">
          <Label>Active Functions</Label>
          <div className="flex flex-wrap gap-2">
            {value.selectedFunctions.map((funcId) => {
              const func = getFunction(funcId);
              return (
                <Badge
                  key={funcId}
                  variant="secondary"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  {func?.name || funcId}
                  <button
                    onClick={() => handleRemoveFunction(funcId)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {value.selectedFunctions.length === 0 && (
        <div className="p-4 border border-dashed border-border text-center text-sm text-muted-foreground">
          No functions added yet. Select functions above to enable them for your agent.
        </div>
      )}
    </div>
  );
}
