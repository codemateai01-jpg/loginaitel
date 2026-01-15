import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Project { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  onSuccess: () => void;
}

export function RELeadUploadDialog({ open, onOpenChange, projects, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [source, setSource] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!user || !file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].toLowerCase().split(",").map(h => h.trim());
      
      const nameIdx = headers.findIndex(h => h.includes("name"));
      const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile"));
      const emailIdx = headers.findIndex(h => h.includes("email"));

      if (phoneIdx === -1) {
        throw new Error("CSV must have a phone/mobile column");
      }

      const leads = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        return {
          client_id: user.id,
          name: nameIdx >= 0 ? cols[nameIdx] || null : null,
          phone_number: cols[phoneIdx],
          email: emailIdx >= 0 ? cols[emailIdx] || null : null,
          source: source || "csv_upload",
          project_id: projectId || null,
          stage: "new" as const,
        };
      }).filter(l => l.phone_number);

      const { error } = await supabase.from("real_estate_leads").insert(leads);
      if (error) throw error;

      toast({ title: "Success", description: `Uploaded ${leads.length} leads` });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Leads CSV</DialogTitle>
          <DialogDescription>Upload a CSV file with columns: name, phone, email</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>CSV File</Label>
            <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g., Facebook, Google" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
