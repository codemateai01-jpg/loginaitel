import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Project { id: string; name: string; }
interface Props { open: boolean; onOpenChange: (open: boolean) => void; projects: Project[]; onSuccess: () => void; }

export function REAddLeadDialog({ open, onOpenChange, projects, onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", source: "", projectId: "" });

  const handleSave = async () => {
    if (!user || !form.phone.trim()) { toast({ title: "Error", description: "Phone is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("real_estate_leads").insert({
        client_id: user.id, name: form.name || null, phone_number: form.phone, email: form.email || null,
        source: form.source || null, project_id: form.projectId || null, stage: "new",
      });
      if (error) throw error;
      toast({ title: "Success", description: "Lead added" });
      onOpenChange(false);
      setForm({ name: "", phone: "", email: "", source: "", projectId: "" });
      onSuccess();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Lead</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm(p => ({ ...p, source: e.target.value }))} placeholder="e.g., Facebook" /></div>
          <div><Label>Project</Label><Select value={form.projectId} onValueChange={(v) => setForm(p => ({ ...p, projectId: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Add"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
