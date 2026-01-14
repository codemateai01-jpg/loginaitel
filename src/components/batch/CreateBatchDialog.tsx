import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, X, Download } from "lucide-react";
import { toast } from "sonner";
import { createBatch, listPhoneNumbers, type PhoneNumber } from "@/lib/bolna";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateBatchDialog({ open, onOpenChange, onSuccess }: CreateBatchDialogProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch agents
  const { data: agents } = useQuery({
    queryKey: ["bolna-agents-for-batch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aitel_agents" as any)
        .select("id, agent_name, external_agent_id")
        .eq("status", "active");
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch phone numbers
  const { data: phoneNumbers } = useQuery({
    queryKey: ["phone-numbers"],
    queryFn: async () => {
      const result = await listPhoneNumbers();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setCsvFile(file);
    const content = await file.text();
    setCsvContent(content);
  };

  const handleRemoveFile = () => {
    setCsvFile(null);
    setCsvContent("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!csvContent || !selectedAgent) {
      toast.error("Please select an agent and upload a CSV file");
      return;
    }

    const agent = agents?.find((a: any) => a.id === selectedAgent);
    if (!agent?.external_agent_id) {
      toast.error("Invalid agent selected");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createBatch({
        agent_id: agent.external_agent_id,
        csv_content: csvContent,
        from_phone_number: selectedPhoneNumber || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Batch created successfully! ID: ${result.data?.batch_id}`);
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form
      handleRemoveFile();
      setSelectedAgent("");
      setSelectedPhoneNumber("");
    } catch (error) {
      toast.error("Failed to create batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadSampleCsv = () => {
    const sampleCsv = `contact_number,name,company
+919876543210,John Doe,Acme Corp
+919876543211,Jane Smith,Tech Inc
+919876543212,Bob Johnson,StartupXYZ`;
    
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Batch Call</DialogTitle>
          <DialogDescription>
            Upload a CSV file with phone numbers to create a batch calling campaign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Agent Selection */}
          <div className="space-y-2">
            <Label htmlFor="agent">Select Agent</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.agent_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone Number Selection */}
          <div className="space-y-2">
            <Label htmlFor="phone">From Phone Number (Optional)</Label>
            <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
              <SelectTrigger>
                <SelectValue placeholder="Select a phone number" />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers?.map((phone: PhoneNumber) => (
                  <SelectItem key={phone.id} value={phone.phone_number}>
                    {phone.phone_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CSV Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Upload CSV</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={downloadSampleCsv}
                className="text-xs"
              >
                <Download className="h-3 w-3 mr-1" />
                Sample CSV
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {!csvFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload CSV</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max file size: 5MB
                </p>
              </div>
            ) : (
              <div className="border-2 border-border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 flex items-center justify-center rounded">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{csvFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(csvFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleRemoveFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* CSV Preview */}
          {csvContent && (
            <div className="space-y-2">
              <Label>Preview (first 5 rows)</Label>
              <div className="bg-muted/50 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs font-mono whitespace-pre">
                  {csvContent.split("\n").slice(0, 6).join("\n")}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !csvFile || !selectedAgent}>
            {isSubmitting ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
