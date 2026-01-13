import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CSVUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedLead {
  name?: string;
  phone_number: string;
  email?: string;
  metadata?: Record<string, string>;
}

export function CSVUploadDialog({ open, onOpenChange, onSuccess }: CSVUploadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<ParsedLead[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((content: string): ParsedLead[] => {
    const lines = content.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row");
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const phoneIndex = headers.findIndex((h) => h.includes("phone") || h === "mobile" || h === "number");
    const nameIndex = headers.findIndex((h) => h.includes("name"));
    const emailIndex = headers.findIndex((h) => h.includes("email"));

    if (phoneIndex === -1) {
      throw new Error("CSV must have a column containing 'phone', 'mobile', or 'number'");
    }

    const leads: ParsedLead[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const phone = values[phoneIndex];
      
      if (!phone || phone.length < 10) continue;

      // Build metadata from other columns
      const metadata: Record<string, string> = {};
      headers.forEach((header, idx) => {
        if (idx !== phoneIndex && idx !== nameIndex && idx !== emailIndex && values[idx]) {
          metadata[header] = values[idx];
        }
      });

      leads.push({
        phone_number: phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`,
        name: nameIndex !== -1 ? values[nameIndex] : undefined,
        email: emailIndex !== -1 ? values[emailIndex] : undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });
    }

    return leads;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview([]);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    setFile(selectedFile);

    // Parse and preview
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = parseCSV(content);
        setPreview(parsed.slice(0, 5));
        if (parsed.length === 0) {
          setError("No valid leads found in CSV");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const content = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      const leads = parseCSV(content);

      // Insert leads in batches
      const batchSize = 100;
      let inserted = 0;

      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize).map((lead) => ({
          ...lead,
          client_id: user.id,
          uploaded_by: user.id,
          status: "pending",
        }));

        const { error: insertError } = await supabase.from("leads").insert(batch);
        if (insertError) throw insertError;
        inserted += batch.length;
      }

      toast({
        title: "Upload Successful!",
        description: `${inserted} leads have been imported.`,
      });

      onSuccess();
      onOpenChange(false);
      setFile(null);
      setPreview([]);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload leads");
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload leads",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Upload CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with your leads. Required column: phone number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="border-2"
                disabled={isUploading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Columns: name, phone (required), email, and any custom fields
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border-2 border-destructive text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 5 rows)</Label>
              <div className="border-2 border-border bg-muted/50 p-3 text-sm max-h-40 overflow-auto">
                {preview.map((lead, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span className="font-mono text-xs">{lead.phone_number}</span>
                    {lead.name && <span className="text-muted-foreground">- {lead.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !file || preview.length === 0}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {preview.length > 0 && `(${preview.length}+ leads)`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
